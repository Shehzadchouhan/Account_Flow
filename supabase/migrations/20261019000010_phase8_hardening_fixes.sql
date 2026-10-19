-- =============================================================================
-- Migration 10: Phase 8 Hardening & Trigger Defenses
--
-- Ensures trg_validate_dispatch_item allows deactivating items on void,
-- and void_dispatch deactivates items cleanly before marking dispatches voided.
-- =============================================================================

-- 1. Fix Dispatch Items Validation Trigger
CREATE OR REPLACE FUNCTION public.trg_validate_dispatch_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_dispatch_case_id uuid;
  v_dispatch_voided_at timestamptz;
  v_doc_case_id uuid;
  v_received_at timestamptz;
  v_removed_at timestamptz;
BEGIN
  -- When an existing item is simply being deactivated (e.g. during void_dispatch), allow it through
  IF TG_OP = 'UPDATE' AND NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  SELECT case_id, voided_at INTO v_dispatch_case_id, v_dispatch_voided_at
  FROM public.dispatches WHERE id = NEW.dispatch_id;

  SELECT case_id, received_at, removed_at INTO v_doc_case_id, v_received_at, v_removed_at
  FROM public.case_documents WHERE id = NEW.case_document_id;

  IF v_dispatch_case_id IS NULL OR v_doc_case_id IS NULL THEN
    RAISE EXCEPTION 'Referenced dispatch or case document does not exist.';
  END IF;

  -- Reject adding or reactivating items for a voided dispatch
  IF v_dispatch_voided_at IS NOT NULL AND NEW.is_active = true THEN
    RAISE EXCEPTION 'Cannot add dispatch item: Dispatch % is voided.', NEW.dispatch_id;
  END IF;

  -- Case cross-check
  IF v_dispatch_case_id <> v_doc_case_id THEN
    RAISE EXCEPTION 'Case mismatch: Document % belongs to case %, but dispatch % belongs to case %',
      NEW.case_document_id, v_doc_case_id, NEW.dispatch_id, v_dispatch_case_id;
  END IF;

  -- Document eligibility when active
  IF NEW.is_active = true THEN
    IF v_received_at IS NULL THEN
      RAISE EXCEPTION 'Document % cannot be dispatched because it has not been received yet.', NEW.case_document_id;
    END IF;
    IF v_removed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Document % cannot be dispatched because it has been soft-deleted/removed.', NEW.case_document_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Update Atomic void_dispatch()
CREATE OR REPLACE FUNCTION public.void_dispatch(p_dispatch_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_case_id uuid;
  v_voided_at timestamptz;
BEGIN
  -- 1. Security Check: Admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can void dispatches.';
  END IF;

  -- 2. Validate reason
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A non-empty void reason is required.';
  END IF;

  -- 3. Retrieve and lock dispatch
  SELECT case_id, voided_at INTO v_case_id, v_voided_at
  FROM public.dispatches
  WHERE id = p_dispatch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispatch % not found.', p_dispatch_id;
  END IF;

  IF v_voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Dispatch % has already been voided.', p_dispatch_id;
  END IF;

  -- 4. Deactivate associated dispatch items first (while voided_at is still null)
  UPDATE public.dispatch_items
  SET is_active = false,
      updated_at = now()
  WHERE dispatch_id = p_dispatch_id;

  -- 5. Mark dispatch voided
  UPDATE public.dispatches
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = trim(p_reason),
      updated_at = now()
  WHERE id = p_dispatch_id;

  -- 6. Record append-only activity log
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'VOID_DISPATCH',
    'dispatches',
    p_dispatch_id,
    jsonb_build_object(
      'case_id', v_case_id,
      'reason', trim(p_reason)
    )
  );
END;
$$;
