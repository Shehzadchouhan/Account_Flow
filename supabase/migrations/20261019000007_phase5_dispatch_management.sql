-- =============================================================================
-- Migration 7: Phase 5 Outward Dispatch Management
-- Idempotency, Atomic create_dispatch(), and Dispatch Locking
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add idempotency_key to public.dispatches
-- -----------------------------------------------------------------------------
ALTER TABLE public.dispatches ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS dispatches_idempotency_key_uniq
  ON public.dispatches (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Drop direct client INSERT policies on dispatches and dispatch_items
-- Guarantees that all dispatches are created strictly via create_dispatch()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS dispatches_insert_admin ON public.dispatches;
DROP POLICY IF EXISTS dispatch_items_insert_admin ON public.dispatch_items;

-- -----------------------------------------------------------------------------
-- 3. Atomic create_dispatch() Function
-- Validates documents, enforces single active dispatch per document,
-- checks idempotency, records auth.uid() as recorder, and logs activity.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_dispatch(
  p_case_id uuid,
  p_recipient text,
  p_case_document_ids uuid[],
  p_sent_at timestamptz DEFAULT now(),
  p_email_reference text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_existing_id uuid;
  v_new_dispatch_id uuid;
  v_doc_id uuid;
  v_doc_case_id uuid;
  v_doc_received_at timestamptz;
  v_doc_removed_at timestamptz;
  v_is_already_dispatched boolean;
BEGIN
  -- 1. Security Check: Active users only
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: Active user required.';
  END IF;

  -- 2. Idempotency Check: Return existing dispatch if duplicate key
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT id INTO v_existing_id
    FROM public.dispatches
    WHERE idempotency_key = trim(p_idempotency_key);

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'dispatch_id', v_existing_id,
        'is_duplicate', true
      );
    END IF;
  END IF;

  -- 3. Input Validations
  IF p_recipient IS NULL OR length(trim(p_recipient)) = 0 THEN
    RAISE EXCEPTION 'Recipient is required.';
  END IF;

  IF p_case_document_ids IS NULL OR array_length(p_case_document_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one document must be selected for dispatch.';
  END IF;

  IF p_sent_at IS NOT NULL AND p_sent_at > (now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'Dispatch sent_at timestamp cannot be in the future.';
  END IF;

  -- 4. Verify case exists
  IF NOT EXISTS (SELECT 1 FROM public.cases WHERE id = p_case_id) THEN
    RAISE EXCEPTION 'Case % not found.', p_case_id;
  END IF;

  -- 5. Validate each document in the selected array
  FOR v_doc_id IN SELECT unnest(p_case_document_ids)
  LOOP
    SELECT case_id, received_at, removed_at
    INTO v_doc_case_id, v_doc_received_at, v_doc_removed_at
    FROM public.case_documents
    WHERE id = v_doc_id
    FOR UPDATE;

    IF NOT FOUND OR v_doc_removed_at IS NOT NULL OR v_doc_case_id <> p_case_id THEN
      RAISE EXCEPTION 'Document % does not belong to case % or has been removed.', v_doc_id, p_case_id;
    END IF;

    IF v_doc_received_at IS NULL THEN
      RAISE EXCEPTION 'Document % is not received. Only received documents can be dispatched.', v_doc_id;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.dispatch_items di
      JOIN public.dispatches d ON d.id = di.dispatch_id
      WHERE di.case_document_id = v_doc_id
        AND di.is_active = true
        AND d.voided_at IS NULL
    ) INTO v_is_already_dispatched;

    IF v_is_already_dispatched THEN
      RAISE EXCEPTION 'Document % is already part of an active dispatch.', v_doc_id;
    END IF;
  END LOOP;

  -- 6. Insert into dispatches (recorded_by forced to auth.uid())
  INSERT INTO public.dispatches (
    case_id,
    recipient,
    sent_at,
    recorded_by,
    email_reference,
    idempotency_key
  )
  VALUES (
    p_case_id,
    trim(p_recipient),
    COALESCE(p_sent_at, now()),
    auth.uid(),
    NULLIF(trim(p_email_reference), ''),
    NULLIF(trim(p_idempotency_key), '')
  )
  RETURNING id INTO v_new_dispatch_id;

  -- 7. Insert items into dispatch_items
  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
  SELECT v_new_dispatch_id, unnest(p_case_document_ids), true;

  -- 8. Append activity log
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'CREATE_DISPATCH',
    'dispatches',
    v_new_dispatch_id,
    jsonb_build_object(
      'case_id', p_case_id,
      'recipient', trim(p_recipient),
      'document_count', array_length(p_case_document_ids, 1),
      'document_ids', p_case_document_ids,
      'sent_at', COALESCE(p_sent_at, now()),
      'email_reference', trim(p_email_reference)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'dispatch_id', v_new_dispatch_id,
    'is_duplicate', false
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Helper Function: get_distinct_recipients()
-- Returns distinct previous recipient names for UI datalist suggestions.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_distinct_recipients()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT COALESCE(array_agg(r.recipient ORDER BY r.recipient), ARRAY[]::text[])
  FROM (
    SELECT DISTINCT recipient
    FROM public.dispatches
    WHERE length(trim(recipient)) > 0
    ORDER BY recipient
    LIMIT 100
  ) r;
$$;

-- -----------------------------------------------------------------------------
-- 5. Security & Permission Hardening
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_dispatch(uuid, text, uuid[], timestamptz, text, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.get_distinct_recipients() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_dispatch(uuid, text, uuid[], timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_recipients() TO authenticated;
