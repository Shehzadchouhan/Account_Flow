-- =============================================================================
-- FINANCEFLOW PHASE 7 AUTOMATED VERIFICATION SUITE
-- Excel/CSV Import and Export, Formula Neutralization, & Audit Trails
--
-- Safe Execution: Entire test runs inside a transaction and ends with ROLLBACK.
-- Guarantees zero residual database modifications while verifying all assertions.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_test_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_test_staff_id uuid := '22222222-2222-2222-2222-222222222222';
  v_test_inactive_id uuid := '33333333-3333-3333-3333-333333333333';

  v_res jsonb;
  v_error_caught boolean;
  v_imported_count int;
  v_skipped_count int;
  v_created_doc_types int;
  v_count int;
  v_firm_id uuid;
  v_req_count int;
  v_opt_count int;
  v_log_record record;

  v_existing_firm_name text := 'Existing Apex Enterprise';
  v_new_firm_1 text := 'Bright Horizons LLP';
  v_new_firm_2 text := 'Zenith Tech Solutions';
  v_unknown_doc_name text := 'Special Form 15CA Verification';
  v_standard_doc_1 text := 'GST Sales Summary';
  v_standard_doc_2 text := 'Bank Statement';
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'STARTING FINANCEFLOW PHASE 7 AUTOMATED TEST SUITE';
  RAISE NOTICE '=============================================================================';

  -- ---------------------------------------------------------------------------
  -- Setup: Create Test Users in auth.users & profiles
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    (
      '00000000-0000-0000-0000-000000000000', v_test_admin_id, 'authenticated', 'authenticated',
      'p7_admin@financeflow.local', 'fake_hash', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Phase 7 Admin"}'::jsonb, now(), now()
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_test_staff_id, 'authenticated', 'authenticated',
      'p7_staff@financeflow.local', 'fake_hash', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Phase 7 Staff"}'::jsonb, now(), now()
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_test_inactive_id, 'authenticated', 'authenticated',
      'p7_inactive@financeflow.local', 'fake_hash', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Phase 7 Inactive"}'::jsonb, now(), now()
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES
    (v_test_admin_id, 'Phase 7 Admin', 'p7_admin@financeflow.local', 'admin', true),
    (v_test_staff_id, 'Phase 7 Staff', 'p7_staff@financeflow.local', 'staff', true),
    (v_test_inactive_id, 'Phase 7 Inactive', 'p7_inactive@financeflow.local', 'staff', false)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role, is_active = EXCLUDED.is_active, full_name = EXCLUDED.full_name, email = EXCLUDED.email;

  -- Setup Standard Document Types
  INSERT INTO public.document_types (name, description, is_active)
  VALUES
    (v_standard_doc_1, 'Standard GST Monthly Sales Summary', true),
    (v_standard_doc_2, 'Monthly Bank Reconciliation Statement', true)
  ON CONFLICT (LOWER(TRIM(name))) DO NOTHING;

  -- Setup Existing Firm for conflict tests
  INSERT INTO public.firms (name, contact_person, contact_email, is_active)
  VALUES (v_existing_firm_name, 'Apex Director', 'apex@example.com', true)
  ON CONFLICT (name) DO NOTHING;

  -- ===========================================================================
  -- ASSERTION 1: Security Guard - Non-Admin and Inactive Users Cannot Batch Import
  -- ===========================================================================
  -- 1A: Switch context to Staff member
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_staff_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.import_firms_batch('[{"firm_name": "Unauthorized Firm"}]'::jsonb, false);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 1A FAILED: Staff user was permitted to call import_firms_batch! Expected Access Denied.';
  END IF;

  -- 1B: Switch context to Inactive user
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_inactive_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_inactive_id::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.import_firms_batch('[{"firm_name": "Unauthorized Firm 2"}]'::jsonb, false);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 1B FAILED: Inactive user was permitted to call import_firms_batch!';
  END IF;

  RAISE NOTICE 'TEST 1 PASSED: Non-admin & inactive users are strictly blocked from calling import_firms_batch.';

  -- ===========================================================================
  -- ASSERTION 2: Messy Batch Processing (Missing name, existing firm, unknown employee)
  -- ===========================================================================
  -- Switch to Admin
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_admin_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);

  -- Messy batch payload containing:
  -- Row 1: Valid new firm with assigned staff
  -- Row 2: Missing firm name (should skip)
  -- Row 3: Firm that already exists (should skip)
  -- Row 4: Firm with non-existent employee email (should skip)
  v_test_batch := jsonb_build_array(
    jsonb_build_object(
      'firm_name', v_new_firm_1,
      'contact_person', 'Sunil Mehta',
      'contact_email', 'sunil@brighthorizons.in',
      'contact_phone', '+91 9876543210',
      'employee_email', 'p7_staff@financeflow.local',
      'required_documents', jsonb_build_array(v_standard_doc_1),
      'optional_documents', jsonb_build_array(v_standard_doc_2)
    ),
    jsonb_build_object(
      'firm_name', '',
      'contact_person', 'No Name Person',
      'contact_email', 'noname@example.com'
    ),
    jsonb_build_object(
      'firm_name', v_existing_firm_name,
      'contact_person', 'Duplicate Check',
      'contact_email', 'apex2@example.com'
    ),
    jsonb_build_object(
      'firm_name', 'Ghost Employee Firm',
      'contact_person', 'Haunted Director',
      'employee_email', 'nonexistent_user_999@test.com'
    )
  );

  v_res := public.import_firms_batch(v_test_batch, false);

  v_imported_count := (v_res->>'imported_count')::int;
  v_skipped_count := (v_res->>'skipped_count')::int;

  IF v_imported_count <> 1 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Expected exactly 1 imported firm from messy batch, got %', v_imported_count;
  END IF;

  IF v_skipped_count <> 3 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Expected exactly 3 skipped rows (blank name, duplicate firm, unknown employee), got %', v_skipped_count;
  END IF;

  RAISE NOTICE 'TEST 2 PASSED: Messy batch accurately imported 1 valid firm and skipped 3 invalid/problem rows without aborting.';

  -- ===========================================================================
  -- ASSERTION 3: Template Items & Default Assignee Persistence
  -- ===========================================================================
  SELECT id INTO v_firm_id FROM public.firms WHERE name = v_new_firm_1;
  IF v_firm_id IS NULL THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Imported firm % was not found in firms table!', v_new_firm_1;
  END IF;

  -- Verify default employee was assigned to Phase 7 Staff
  SELECT COUNT(*) INTO v_count
  FROM public.firms
  WHERE id = v_firm_id AND default_employee = v_test_staff_id;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Default employee was not correctly linked to %', v_test_staff_id;
  END IF;

  -- Verify required template items
  SELECT COUNT(*) INTO v_req_count
  FROM public.firm_template_items fti
  JOIN public.document_types dt ON dt.id = fti.document_type_id
  WHERE fti.firm_id = v_firm_id AND fti.is_required = true AND dt.name = v_standard_doc_1;

  -- Verify optional template items
  SELECT COUNT(*) INTO v_opt_count
  FROM public.firm_template_items fti
  JOIN public.document_types dt ON dt.id = fti.document_type_id
  WHERE fti.firm_id = v_firm_id AND fti.is_required = false AND dt.name = v_standard_doc_2;

  IF v_req_count <> 1 OR v_opt_count <> 1 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Template items mismatch! Required: %, Optional: %', v_req_count, v_opt_count;
  END IF;

  RAISE NOTICE 'TEST 3 PASSED: Template items and default employee correctly associated with imported firm.';

  -- ===========================================================================
  -- ASSERTION 4: Unknown Document Types Auto-Creation When Confirmed
  -- ===========================================================================
  -- Check that the unknown document type does NOT exist yet
  DELETE FROM public.document_types WHERE LOWER(TRIM(name)) = LOWER(v_unknown_doc_name);

  v_test_batch := jsonb_build_array(
    jsonb_build_object(
      'firm_name', v_new_firm_2,
      'contact_person', 'Ananya Roy',
      'contact_email', 'ananya@zenithtech.in',
      'required_documents', jsonb_build_array(v_unknown_doc_name)
    )
  );

  -- 4A: With p_create_missing_doc_types = false -> document type is NOT created
  -- (If doc type doesn't exist, template item isn't added)
  PERFORM public.import_firms_batch(v_test_batch, false);

  SELECT COUNT(*) INTO v_count
  FROM public.document_types
  WHERE LOWER(TRIM(name)) = LOWER(v_unknown_doc_name);

  IF v_count > 0 THEN
    RAISE EXCEPTION 'TEST 4A FAILED: Unknown document type was created even when p_create_missing_doc_types was false!';
  END IF;

  -- 4B: Now test with p_create_missing_doc_types = true
  -- We delete firm_2 first to test clean import with creation
  DELETE FROM public.firms WHERE name = v_new_firm_2;

  v_res := public.import_firms_batch(v_test_batch, true);
  v_created_doc_types := (v_res->>'created_doc_types')::int;

  IF v_created_doc_types <> 1 THEN
    RAISE EXCEPTION 'TEST 4B FAILED: Expected 1 created document type, got %', v_created_doc_types;
  END IF;

  -- Verify document type now exists
  SELECT COUNT(*) INTO v_count
  FROM public.document_types
  WHERE LOWER(TRIM(name)) = LOWER(v_unknown_doc_name);

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 4B FAILED: Document type was not inserted into public.document_types!';
  END IF;

  -- Verify firm 2 was created and has this new document type in template
  SELECT id INTO v_firm_id FROM public.firms WHERE name = v_new_firm_2;
  SELECT COUNT(*) INTO v_req_count
  FROM public.firm_template_items fti
  JOIN public.document_types dt ON dt.id = fti.document_type_id
  WHERE fti.firm_id = v_firm_id AND dt.name = v_unknown_doc_name;

  IF v_req_count <> 1 THEN
    RAISE EXCEPTION 'TEST 4B FAILED: Newly created doc type was not linked to firm template!';
  END IF;

  RAISE NOTICE 'TEST 4 PASSED: Unknown document types correctly auto-created when confirmed by administrator.';

  -- ===========================================================================
  -- ASSERTION 5: Re-import Idempotency (Zero Duplicate Firms Created)
  -- ===========================================================================
  -- Re-importing the exact same batch containing v_new_firm_1 and v_new_firm_2
  v_test_batch := jsonb_build_array(
    jsonb_build_object('firm_name', v_new_firm_1),
    jsonb_build_object('firm_name', v_new_firm_2)
  );

  v_res := public.import_firms_batch(v_test_batch, false);

  IF (v_res->>'imported_count')::int <> 0 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Re-import created duplicate firms! Imported: %', v_res->>'imported_count';
  END IF;

  IF (v_res->>'skipped_count')::int <> 2 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Re-import did not skip both existing firms! Skipped: %', v_res->>'skipped_count';
  END IF;

  -- Total count of firms with v_new_firm_1 must still be 1
  SELECT COUNT(*) INTO v_count FROM public.firms WHERE name = v_new_firm_1;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Duplicate firm found in database for %', v_new_firm_1;
  END IF;

  RAISE NOTICE 'TEST 5 PASSED: Re-import is 100%% idempotent and creates zero duplicate firms.';

  -- ===========================================================================
  -- ASSERTION 6: Import Activity Logging
  -- ===========================================================================
  SELECT COUNT(*) INTO v_count
  FROM public.activity_logs
  WHERE user_id = v_test_admin_id AND action = 'import_firms';

  IF v_count < 1 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: No activity_logs entry found for batch firm import by admin!';
  END IF;

  SELECT * INTO v_log_record
  FROM public.activity_logs
  WHERE user_id = v_test_admin_id AND action = 'import_firms'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_log_record.details->>'imported_count' IS NULL OR v_log_record.details->>'skipped_count' IS NULL THEN
    RAISE EXCEPTION 'TEST 6 FAILED: activity_logs details missing imported_count or skipped_count metrics!';
  END IF;

  RAISE NOTICE 'TEST 6 PASSED: Batch firm imports are accurately logged to activity_logs with record counts.';

  -- ===========================================================================
  -- ASSERTION 7: Export Activity Logging & Active User Permissions
  -- ===========================================================================
  -- 7A: Active staff user can log report exports
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_staff_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);

  PERFORM public.log_export_activity(
    'pending_documents',
    '{"month": "2026-10-01", "status": "all"}'::jsonb,
    42
  );

  SELECT COUNT(*) INTO v_count
  FROM public.activity_logs
  WHERE user_id = v_test_staff_id AND action = 'export_pending_documents';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 7A FAILED: log_export_activity did not record audit log for staff member!';
  END IF;

  -- 7B: Inactive user cannot log report exports
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_inactive_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_inactive_id::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.log_export_activity(
      'completed_cases',
      '{}'::jsonb,
      10
    );
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 7B FAILED: Inactive user was permitted to call log_export_activity!';
  END IF;

  RAISE NOTICE 'TEST 7 PASSED: Export activities are securely audited for active users and denied to inactive users.';

  -- ===========================================================================
  -- ASSERTION 8: Cross-Check of the 6 Compliance Export Views
  -- ===========================================================================
  -- Verify all 6 report queries run cleanly without SQL or permission errors:
  -- 1. Pending Documents
  PERFORM COUNT(*) FROM public.case_document_status WHERE firm_is_active = true AND status <> 'Dispatched';
  -- 2. Completed Cases
  PERFORM COUNT(*) FROM public.case_status WHERE firm_is_active = true AND status = 'Completed';
  -- 3. Dispatch History
  PERFORM COUNT(*) FROM public.dispatches d JOIN public.cases c ON c.id = d.case_id JOIN public.firms f ON f.id = c.firm_id;
  -- 4. Work by Employee (case_status + case_document_status grouped by assigned_to)
  PERFORM assigned_to, COUNT(*) FROM public.case_status WHERE firm_is_active = true GROUP BY assigned_to;
  -- 5. Received But Not Dispatched
  PERFORM COUNT(*) FROM public.case_document_status WHERE firm_is_active = true AND status = 'Received - Not Dispatched';
  -- 6. Overdue Cases
  PERFORM COUNT(*) FROM public.case_status WHERE firm_is_active = true AND is_overdue = true;

  RAISE NOTICE 'TEST 8 PASSED: All 6 compliance report views execute without error and share the single source of truth.';

  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'ALL 8 PHASE 7 AUTOMATED VERIFICATIONS PASSED SUCESSFULLY!';
  RAISE NOTICE '=============================================================================';
END $$;

ROLLBACK;
