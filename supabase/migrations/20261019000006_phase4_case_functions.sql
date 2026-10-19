-- =============================================================================
-- Migration 6: Phase 4 Case Functions & Procedures
-- Case Generator, Document Receipt, Checklist Management, and Optimistic Lock
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. generate_cases()
-- Generates monthly cases for active firms with checklist templates.
-- Dry-run supported, idempotent via unique (firm_id, period_month, cycle).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_cases(
  p_month date,
  p_cycle text,
  p_due_date date,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_firm record;
  v_template_count int;
  v_case_exists boolean;
  v_new_case_id uuid;
  v_created_firms jsonb := '[]'::jsonb;
  v_skipped_existing_firms jsonb := '[]'::jsonb;
  v_skipped_no_template_firms jsonb := '[]'::jsonb;
BEGIN
  -- 1. Authorization check: Admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can generate cases.';
  END IF;

  -- 2. Validate input parameters
  IF p_month IS NULL OR p_month <> date_trunc('month', p_month)::date THEN
    RAISE EXCEPTION 'Invalid period month: p_month must be the 1st of the month (YYYY-MM-01).';
  END IF;

  IF p_cycle NOT IN ('A_11th', 'B_20th') THEN
    RAISE EXCEPTION 'Invalid cycle: p_cycle must be either A_11th or B_20th.';
  END IF;

  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Due date is required.';
  END IF;

  -- 3. Iterate through all active firms
  FOR v_firm IN
    SELECT f.id, f.name, f.default_employee
    FROM public.firms f
    WHERE f.is_active = true
    ORDER BY f.name
  LOOP
    -- Check if firm has any active document types in its checklist template
    SELECT COUNT(*) INTO v_template_count
    FROM public.firm_template_items fti
    JOIN public.document_types dt ON dt.id = fti.document_type_id
    WHERE fti.firm_id = v_firm.id AND dt.is_active = true;

    IF v_template_count = 0 THEN
      v_skipped_no_template_firms := v_skipped_no_template_firms || jsonb_build_object(
        'firm_id', v_firm.id,
        'firm_name', v_firm.name
      );
    ELSE
      -- Check if case already exists for this firm + period + cycle
      SELECT EXISTS (
        SELECT 1 FROM public.cases
        WHERE firm_id = v_firm.id AND period_month = p_month AND cycle = p_cycle
      ) INTO v_case_exists;

      IF v_case_exists THEN
        v_skipped_existing_firms := v_skipped_existing_firms || jsonb_build_object(
          'firm_id', v_firm.id,
          'firm_name', v_firm.name
        );
      ELSE
        -- Firm qualifies for new case generation
        v_created_firms := v_created_firms || jsonb_build_object(
          'firm_id', v_firm.id,
          'firm_name', v_firm.name,
          'assigned_to', v_firm.default_employee,
          'template_items_count', v_template_count
        );

        -- If not dry run, insert the case and copy template items
        IF NOT p_dry_run THEN
          INSERT INTO public.cases (
            firm_id,
            period_month,
            cycle,
            due_date,
            assigned_to
          )
          VALUES (
            v_firm.id,
            p_month,
            p_cycle,
            p_due_date,
            v_firm.default_employee
          )
          ON CONFLICT (firm_id, period_month, cycle) DO NOTHING
          RETURNING id INTO v_new_case_id;

          IF v_new_case_id IS NOT NULL THEN
            -- Copy template items into case_documents
            INSERT INTO public.case_documents (
              case_id,
              document_type_id,
              is_required
            )
            SELECT
              v_new_case_id,
              fti.document_type_id,
              fti.is_required
            FROM public.firm_template_items fti
            JOIN public.document_types dt ON dt.id = fti.document_type_id
            WHERE fti.firm_id = v_firm.id AND dt.is_active = true;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 4. Audit logging if mutations were made
  IF NOT p_dry_run AND jsonb_array_length(v_created_firms) > 0 THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'GENERATE_CASES',
      'cases',
      NULL,
      jsonb_build_object(
        'period_month', p_month,
        'cycle', p_cycle,
        'due_date', p_due_date,
        'created_count', jsonb_array_length(v_created_firms),
        'skipped_existing_count', jsonb_array_length(v_skipped_existing_firms),
        'skipped_no_template_count', jsonb_array_length(v_skipped_no_template_firms)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'period_month', p_month,
    'cycle', p_cycle,
    'due_date', p_due_date,
    'created_count', jsonb_array_length(v_created_firms),
    'skipped_existing_count', jsonb_array_length(v_skipped_existing_firms),
    'skipped_no_template_count', jsonb_array_length(v_skipped_no_template_firms),
    'created_firms', v_created_firms,
    'skipped_existing_firms', v_skipped_existing_firms,
    'skipped_no_template_firms', v_skipped_no_template_firms
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. receive_document()
-- Marks a single document received.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_document(p_case_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_case_id uuid;
  v_doc_type_id uuid;
  v_received_at timestamptz;
  v_removed_at timestamptz;
BEGIN
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: Active user required.';
  END IF;

  SELECT case_id, document_type_id, received_at, removed_at
  INTO v_case_id, v_doc_type_id, v_received_at, v_removed_at
  FROM public.case_documents
  WHERE id = p_case_document_id
  FOR UPDATE;

  IF NOT FOUND OR v_removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Document not found or has been removed from this case.';
  END IF;

  IF v_received_at IS NOT NULL THEN
    RAISE EXCEPTION 'Document is already marked as received.';
  END IF;

  UPDATE public.case_documents
  SET received_at = now(),
      received_by = auth.uid(),
      updated_at = now()
  WHERE id = p_case_document_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'RECEIVE_DOCUMENT',
    'case_documents',
    p_case_document_id,
    jsonb_build_object(
      'case_id', v_case_id,
      'document_type_id', v_doc_type_id,
      'received_by', auth.uid()
    )
  );

  RETURN jsonb_build_object('success', true, 'case_document_id', p_case_document_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. unreceive_document()
-- Undoes receipt. Blocked if document is part of an active dispatch.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unreceive_document(p_case_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_case_id uuid;
  v_doc_type_id uuid;
  v_received_at timestamptz;
  v_removed_at timestamptz;
  v_is_dispatched boolean;
BEGIN
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: Active user required.';
  END IF;

  SELECT case_id, document_type_id, received_at, removed_at
  INTO v_case_id, v_doc_type_id, v_received_at, v_removed_at
  FROM public.case_documents
  WHERE id = p_case_document_id
  FOR UPDATE;

  IF NOT FOUND OR v_removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Document not found or has been removed from this case.';
  END IF;

  IF v_received_at IS NULL THEN
    RAISE EXCEPTION 'Document is not currently marked as received.';
  END IF;

  -- Block if part of an active dispatch item
  SELECT EXISTS (
    SELECT 1 FROM public.dispatch_items di
    JOIN public.dispatches d ON d.id = di.dispatch_id
    WHERE di.case_document_id = p_case_document_id
      AND di.is_active = true
      AND d.voided_at IS NULL
  ) INTO v_is_dispatched;

  IF v_is_dispatched THEN
    RAISE EXCEPTION 'Cannot un-receive document: It is currently part of an active dispatch. Void the dispatch first.';
  END IF;

  UPDATE public.case_documents
  SET received_at = NULL,
      received_by = NULL,
      updated_at = now()
  WHERE id = p_case_document_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'UNRECEIVE_DOCUMENT',
    'case_documents',
    p_case_document_id,
    jsonb_build_object(
      'case_id', v_case_id,
      'document_type_id', v_doc_type_id
    )
  );

  RETURN jsonb_build_object('success', true, 'case_document_id', p_case_document_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. bulk_receive_documents()
-- Bulk receives documents strictly scoped to a single case.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_receive_documents(
  p_case_id uuid,
  p_case_document_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_invalid_count int;
  v_updated_count int;
BEGIN
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: Active user required.';
  END IF;

  IF p_case_document_ids IS NULL OR array_length(p_case_document_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one document must be selected.';
  END IF;

  -- Ensure all selected document IDs belong strictly to p_case_id and are not removed
  SELECT COUNT(*) INTO v_invalid_count
  FROM unnest(p_case_document_ids) AS doc_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.case_documents
    WHERE id = doc_id AND case_id = p_case_id AND removed_at IS NULL
  );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'All selected documents must belong strictly to case % and be active.', p_case_id;
  END IF;

  -- Update documents
  UPDATE public.case_documents
  SET received_at = now(),
      received_by = auth.uid(),
      updated_at = now()
  WHERE id = ANY(p_case_document_ids)
    AND case_id = p_case_id
    AND received_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'BULK_RECEIVE_DOCUMENTS',
    'cases',
    p_case_id,
    jsonb_build_object(
      'case_id', p_case_id,
      'received_count', v_updated_count,
      'document_ids', p_case_document_ids
    )
  );

  RETURN jsonb_build_object('success', true, 'received_count', v_updated_count);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. add_case_document()
-- Admin addition of a document type to a specific case.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_case_document(
  p_case_id uuid,
  p_document_type_id uuid,
  p_is_required boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_new_id uuid;
  v_existing_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can add documents to cases.';
  END IF;

  -- Check if document type is already active in this case
  SELECT id INTO v_existing_id
  FROM public.case_documents
  WHERE case_id = p_case_id AND document_type_id = p_document_type_id AND removed_at IS NULL;

  IF FOUND THEN
    RAISE EXCEPTION 'This document type is already present in this case.';
  END IF;

  INSERT INTO public.case_documents (case_id, document_type_id, is_required)
  VALUES (p_case_id, p_document_type_id, COALESCE(p_is_required, true))
  RETURNING id INTO v_new_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'ADD_CASE_DOCUMENT',
    'case_documents',
    v_new_id,
    jsonb_build_object(
      'case_id', p_case_id,
      'document_type_id', p_document_type_id,
      'is_required', COALESCE(p_is_required, true)
    )
  );

  RETURN v_new_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. remove_case_document()
-- Admin soft-deletion of a document from a case. Blocked if dispatched.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_case_document(p_case_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_case_id uuid;
  v_doc_type_id uuid;
  v_is_dispatched boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can remove documents from cases.';
  END IF;

  SELECT case_id, document_type_id INTO v_case_id, v_doc_type_id
  FROM public.case_documents
  WHERE id = p_case_document_id AND removed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or already removed.';
  END IF;

  -- Block if part of an active dispatch
  SELECT EXISTS (
    SELECT 1 FROM public.dispatch_items di
    JOIN public.dispatches d ON d.id = di.dispatch_id
    WHERE di.case_document_id = p_case_document_id
      AND di.is_active = true
      AND d.voided_at IS NULL
  ) INTO v_is_dispatched;

  IF v_is_dispatched THEN
    RAISE EXCEPTION 'Cannot remove document: It is part of an active dispatch. Void the dispatch first.';
  END IF;

  UPDATE public.case_documents
  SET removed_at = now(),
      updated_at = now()
  WHERE id = p_case_document_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'REMOVE_CASE_DOCUMENT',
    'case_documents',
    p_case_document_id,
    jsonb_build_object(
      'case_id', v_case_id,
      'document_type_id', v_doc_type_id
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. set_document_required()
-- Admin toggle of document requirement rule.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_document_required(
  p_case_document_id uuid,
  p_is_required boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_case_id uuid;
  v_doc_type_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can modify document requirements.';
  END IF;

  SELECT case_id, document_type_id INTO v_case_id, v_doc_type_id
  FROM public.case_documents
  WHERE id = p_case_document_id AND removed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or already removed.';
  END IF;

  UPDATE public.case_documents
  SET is_required = p_is_required,
      updated_at = now()
  WHERE id = p_case_document_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'SET_DOCUMENT_REQUIRED',
    'case_documents',
    p_case_document_id,
    jsonb_build_object(
      'case_id', v_case_id,
      'document_type_id', v_doc_type_id,
      'is_required', p_is_required
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. update_case_document_notes()
-- Updates notes on a checklist item.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_case_document_notes(
  p_case_document_id uuid,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_case_id uuid;
BEGIN
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: Active user required.';
  END IF;

  SELECT case_id INTO v_case_id
  FROM public.case_documents
  WHERE id = p_case_document_id AND removed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or already removed.';
  END IF;

  UPDATE public.case_documents
  SET notes = trim(p_notes),
      updated_at = now()
  WHERE id = p_case_document_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'UPDATE_DOCUMENT_NOTES',
    'case_documents',
    p_case_document_id,
    jsonb_build_object(
      'case_id', v_case_id,
      'notes', trim(p_notes)
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. update_case_details()
-- Updates due date and assignee using optimistic concurrency control.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_case_details(
  p_case_id uuid,
  p_due_date date,
  p_assigned_to uuid,
  p_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_updated_count int;
  v_new_version int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can update case details.';
  END IF;

  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Due date is required.';
  END IF;

  UPDATE public.cases
  SET due_date = p_due_date,
      assigned_to = p_assigned_to
  WHERE id = p_case_id AND version = p_version
  RETURNING version INTO v_new_version;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'Concurrency conflict: This case was modified by another user. Please reload the page.';
  END IF;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'UPDATE_CASE_DETAILS',
    'cases',
    p_case_id,
    jsonb_build_object(
      'due_date', p_due_date,
      'assigned_to', p_assigned_to,
      'new_version', v_new_version
    )
  );

  RETURN jsonb_build_object('success', true, 'new_version', v_new_version);
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. Security: Revoke from anon/PUBLIC, Grant EXECUTE to authenticated
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.generate_cases(date, text, date, boolean) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.receive_document(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.unreceive_document(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_receive_documents(uuid, uuid[]) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.add_case_document(uuid, uuid, boolean) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.remove_case_document(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.set_document_required(uuid, boolean) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.update_case_document_notes(uuid, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.update_case_details(uuid, date, uuid, integer) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_cases(date, text, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unreceive_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_receive_documents(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_case_document(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_case_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_document_required(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_case_document_notes(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_case_details(uuid, date, uuid, integer) TO authenticated;
