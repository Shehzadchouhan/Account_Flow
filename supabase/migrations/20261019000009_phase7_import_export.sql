-- =============================================================================
-- Migration 9: Batch Import and Export Audit Functions
-- Phase 7: Excel/CSV Import and Export
--
-- Provides atomic batch import with administrative validation and audit logging,
-- and export activity logging strictly adhering to append-only security rules.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Batch Firm Import Function
-- Inserts valid firms and their template items in a single transaction.
-- Rows with issues are skipped by caller or handled here.
-- Logs the event in activity_logs with counts.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_firms_batch(
  p_rows jsonb,
  p_create_missing_doc_types boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_imported_count int := 0;
  v_skipped_count int := 0;
  v_created_doc_types int := 0;

  v_row jsonb;
  v_firm_name text;
  v_contact_person text;
  v_contact_email text;
  v_contact_phone text;
  v_employee_email text;
  v_default_employee_id uuid;
  v_firm_id uuid;

  v_req_docs jsonb;
  v_opt_docs jsonb;
  v_doc_name text;
  v_dt_id uuid;
BEGIN
  -- 1. Admin Authorization Guard
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Administrator role required to import firms.';
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required.';
  END IF;

  -- 2. Optional: Auto-create unknown document types if admin confirmed
  IF p_create_missing_doc_types THEN
    FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
      -- Check required doc names
      FOR v_doc_name IN SELECT jsonb_array_elements_text(COALESCE(v_row->'required_documents', '[]'::jsonb)) LOOP
        v_doc_name := trim(v_doc_name);
        IF length(v_doc_name) > 0 THEN
          SELECT id INTO v_dt_id FROM public.document_types WHERE LOWER(TRIM(name)) = LOWER(v_doc_name);
          IF v_dt_id IS NULL THEN
            INSERT INTO public.document_types (name, description, is_active)
            VALUES (v_doc_name, 'Created automatically during batch import', true)
            ON CONFLICT (LOWER(TRIM(name))) DO NOTHING;
            v_created_doc_types := v_created_doc_types + 1;
          END IF;
        END IF;
      END LOOP;

      -- Check optional doc names
      FOR v_doc_name IN SELECT jsonb_array_elements_text(COALESCE(v_row->'optional_documents', '[]'::jsonb)) LOOP
        v_doc_name := trim(v_doc_name);
        IF length(v_doc_name) > 0 THEN
          SELECT id INTO v_dt_id FROM public.document_types WHERE LOWER(TRIM(name)) = LOWER(v_doc_name);
          IF v_dt_id IS NULL THEN
            INSERT INTO public.document_types (name, description, is_active)
            VALUES (v_doc_name, 'Created automatically during batch import', true)
            ON CONFLICT (LOWER(TRIM(name))) DO NOTHING;
            v_created_doc_types := v_created_doc_types + 1;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- 3. Loop through validated firm rows and insert atomically
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_firm_name := trim(COALESCE(v_row->>'firm_name', ''));
    v_contact_person := nullif(trim(COALESCE(v_row->>'contact_person', '')), '');
    v_contact_email := nullif(trim(COALESCE(v_row->>'contact_email', '')), '');
    v_contact_phone := nullif(trim(COALESCE(v_row->>'contact_phone', '')), '');
    v_employee_email := nullif(trim(COALESCE(v_row->>'employee_email', '')), '');

    -- Validate firm name non-empty
    IF length(v_firm_name) = 0 THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Skip if firm already exists (ensures re-import idempotency)
    IF EXISTS (
      SELECT 1 FROM public.firms WHERE LOWER(TRIM(name)) = LOWER(v_firm_name)
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Lookup default employee UUID if email was supplied
    v_default_employee_id := NULL;
    IF v_employee_email IS NOT NULL THEN
      SELECT p.id INTO v_default_employee_id
      FROM public.profiles p
      WHERE LOWER(TRIM(p.email)) = LOWER(v_employee_email) AND p.is_active = true;

      -- If employee email was specified but not found, skip row
      IF v_default_employee_id IS NULL THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Insert firm
    INSERT INTO public.firms (
      name,
      contact_person,
      contact_email,
      contact_phone,
      default_employee,
      is_active
    )
    VALUES (
      v_firm_name,
      v_contact_person,
      v_contact_email,
      v_contact_phone,
      v_default_employee_id,
      true
    )
    RETURNING id INTO v_firm_id;

    -- Insert required template items
    FOR v_doc_name IN SELECT jsonb_array_elements_text(COALESCE(v_row->'required_documents', '[]'::jsonb)) LOOP
      v_doc_name := trim(v_doc_name);
      IF length(v_doc_name) > 0 THEN
        SELECT id INTO v_dt_id FROM public.document_types WHERE LOWER(TRIM(name)) = LOWER(v_doc_name);
        IF v_dt_id IS NOT NULL THEN
          INSERT INTO public.firm_template_items (firm_id, document_type_id, is_required)
          VALUES (v_firm_id, v_dt_id, true)
          ON CONFLICT (firm_id, document_type_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;

    -- Insert optional template items
    FOR v_doc_name IN SELECT jsonb_array_elements_text(COALESCE(v_row->'optional_documents', '[]'::jsonb)) LOOP
      v_doc_name := trim(v_doc_name);
      IF length(v_doc_name) > 0 THEN
        SELECT id INTO v_dt_id FROM public.document_types WHERE LOWER(TRIM(name)) = LOWER(v_doc_name);
        IF v_dt_id IS NOT NULL THEN
          INSERT INTO public.firm_template_items (firm_id, document_type_id, is_required)
          VALUES (v_firm_id, v_dt_id, false)
          ON CONFLICT (firm_id, document_type_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;

    v_imported_count := v_imported_count + 1;
  END LOOP;

  -- 4. Audit Log Entry
  INSERT INTO public.activity_logs (
    user_id,
    action,
    entity_type,
    details
  )
  VALUES (
    v_user_id,
    'import_firms',
    'firms',
    jsonb_build_object(
      'imported_count', v_imported_count,
      'skipped_count', v_skipped_count,
      'created_doc_types', v_created_doc_types
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'imported_count', v_imported_count,
    'skipped_count', v_skipped_count,
    'created_doc_types', v_created_doc_types
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Export Activity Logging Function
-- Writes audit trail for report exports by any active user.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_export_activity(
  p_report_name text,
  p_filters jsonb,
  p_row_count int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: Active user authentication required.';
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User authentication required.';
  END IF;

  INSERT INTO public.activity_logs (
    user_id,
    action,
    entity_type,
    details
  )
  VALUES (
    v_user_id,
    'export_' || p_report_name,
    'report',
    jsonb_build_object(
      'report', p_report_name,
      'filters', COALESCE(p_filters, '{}'::jsonb),
      'row_count', p_row_count
    )
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_firms_batch(jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_export_activity(text, jsonb, int) TO authenticated;
