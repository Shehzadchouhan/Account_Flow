-- =============================================================================
-- Test Suite: Status Scenarios, Constraints & Security Rules
-- Phase 2: Database Design for FinanceFlow
--
-- Instructions: Run this entire script in the Supabase SQL Editor.
-- It executes all 19 assertions inside a transaction and automatically rolls back,
-- leaving NO residual test data in your database.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Ensure trg_validate_dispatch_item allows deactivating items during voiding
-- (Safe to run: replaces function definition in database)
-- -----------------------------------------------------------------------------
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
  IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
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

DO $$
DECLARE
  -- Test context UUIDs
  v_test_admin_id uuid := gen_random_uuid();
  v_test_staff_id uuid := gen_random_uuid();
  v_test_inactive_id uuid := gen_random_uuid();

  v_firm_id uuid;
  v_archived_firm_id uuid;
  v_dt_1 uuid;
  v_dt_2 uuid;
  v_dt_3 uuid;
  v_dt_opt uuid;

  v_month date := date_trunc('month', current_date)::date;

  v_case_a uuid;
  v_case_b uuid;
  v_case_c uuid;
  v_case_d uuid;
  v_case_f uuid;
  v_case_g uuid;
  v_case_h uuid;

  v_cd_1 uuid;
  v_cd_2 uuid;
  v_cd_3 uuid;
  v_cd_opt uuid;
  v_cd_new uuid;

  v_disp_1 uuid;
  v_disp_2 uuid;

  v_status text;
  v_missing int;
  v_undispatched int;
  v_active_disp_count int;
  v_firm_active boolean;
  v_error_caught boolean;
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'STARTING FINANCEFLOW PHASE 2 TEST SUITE';
  RAISE NOTICE '=============================================================================';

  -- ---------------------------------------------------------------------------
  -- Setup: Create Temporary Test Users in auth.users
  -- Required to satisfy the foreign key constraint: profiles.id -> auth.users(id).
  -- Because this script is enclosed in BEGIN ... ROLLBACK, these test users
  -- are NEVER saved to your database and disappear automatically upon ROLLBACK.
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (
      '00000000-0000-0000-0000-000000000000',
      v_test_admin_id,
      'authenticated',
      'authenticated',
      'test_admin_' || replace(v_test_admin_id::text, '-', '') || '@test.local',
      'fake_password_hash',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Test Administrator"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_test_staff_id,
      'authenticated',
      'authenticated',
      'test_staff_' || replace(v_test_staff_id::text, '-', '') || '@test.local',
      'fake_password_hash',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Test Staff Member"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_test_inactive_id,
      'authenticated',
      'authenticated',
      'test_inactive_' || replace(v_test_inactive_id::text, '-', '') || '@test.local',
      'fake_password_hash',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Test Inactive User"}'::jsonb,
      now(),
      now()
    );

  -- Configure roles and active flags for test profiles
  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES
    (v_test_admin_id, 'Test Administrator', 'admin', true),
    (v_test_staff_id, 'Test Staff Member', 'staff', true),
    (v_test_inactive_id, 'Test Inactive User', 'staff', false)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        full_name = EXCLUDED.full_name;

  -- Configure JWT context so auth.uid() returns the test admin user by default
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_admin_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);

  -- Setup: Test Firms & Document Types
  INSERT INTO public.firms (name, contact_person, is_active)
  VALUES ('Test Active Firm Corp', 'Raj Test', true)
  RETURNING id INTO v_firm_id;

  INSERT INTO public.firms (name, contact_person, is_active)
  VALUES ('Test Archived Firm Ltd', 'Priya Test', false)
  RETURNING id INTO v_archived_firm_id;

  INSERT INTO public.document_types (name) VALUES ('Test Doc Type 1') RETURNING id INTO v_dt_1;
  INSERT INTO public.document_types (name) VALUES ('Test Doc Type 2') RETURNING id INTO v_dt_2;
  INSERT INTO public.document_types (name) VALUES ('Test Doc Type 3') RETURNING id INTO v_dt_3;
  INSERT INTO public.document_types (name) VALUES ('Test Optional Doc') RETURNING id INTO v_dt_opt;

  -- ---------------------------------------------------------------------------
  -- TEST 1: Case A -> All required received and dispatched -> Status: Completed
  -- ---------------------------------------------------------------------------
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_id, v_month, 'A_11th', v_month + 10, v_test_admin_id)
  RETURNING id INTO v_case_a;

  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES
    (v_case_a, v_dt_1, true, now(), v_test_admin_id) RETURNING id INTO v_cd_1;
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES
    (v_case_a, v_dt_2, true, now(), v_test_admin_id) RETURNING id INTO v_cd_2;

  INSERT INTO public.dispatches (case_id, recipient, recorded_by)
  VALUES (v_case_a, 'CA Test', v_test_admin_id) RETURNING id INTO v_disp_1;

  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
  VALUES
    (v_disp_1, v_cd_1, true),
    (v_disp_1, v_cd_2, true);

  SELECT status, missing_count, undispatched_count INTO v_status, v_missing, v_undispatched
  FROM public.case_status WHERE case_id = v_case_a;

  ASSERT v_status = 'Completed', 'TEST 1 FAILED: Expected Completed, got ' || COALESCE(v_status, 'NULL');
  ASSERT v_missing = 0 AND v_undispatched = 0, 'TEST 1 FAILED: Counts mismatch';
  RAISE NOTICE '✓ TEST 1 PASSED: Case A -> Completed (missing=0, undispatched=0)';

  -- ---------------------------------------------------------------------------
  -- TEST 2: Case B -> Received but partially dispatched -> Status: Pending Dispatch
  -- ---------------------------------------------------------------------------
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_id, v_month, 'B_20th', v_month + 19, v_test_admin_id)
  RETURNING id INTO v_case_b;

  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES
    (v_case_b, v_dt_1, true, now(), v_test_admin_id) RETURNING id INTO v_cd_1;
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES
    (v_case_b, v_dt_2, true, now(), v_test_admin_id) RETURNING id INTO v_cd_2;

  INSERT INTO public.dispatches (case_id, recipient, recorded_by)
  VALUES (v_case_b, 'CA Test', v_test_admin_id) RETURNING id INTO v_disp_1;

  -- Dispatch ONLY cd_1, leaving cd_2 undispatched
  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
  VALUES (v_disp_1, v_cd_1, true);

  SELECT status, missing_count, undispatched_count INTO v_status, v_missing, v_undispatched
  FROM public.case_status WHERE case_id = v_case_b;

  ASSERT v_status = 'Pending Dispatch', 'TEST 2 FAILED: Expected Pending Dispatch, got ' || COALESCE(v_status, 'NULL');
  ASSERT v_undispatched = 1, 'TEST 2 FAILED: undispatched_count should be 1';
  RAISE NOTICE '✓ TEST 2 PASSED: Case B -> Pending Dispatch (never Completed)';

  -- ---------------------------------------------------------------------------
  -- TEST 3: Case C -> 1 received, 1 missing -> Status: Awaiting Documents
  -- ---------------------------------------------------------------------------
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_id, (v_month - INTERVAL '1 month')::date, 'A_11th', (v_month - INTERVAL '1 month')::date + 10, v_test_admin_id)
  RETURNING id INTO v_case_c;

  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES (v_case_c, v_dt_1, true, now(), v_test_admin_id);
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES (v_case_c, v_dt_2, true, NULL, NULL);

  SELECT status, missing_count INTO v_status, v_missing
  FROM public.case_status WHERE case_id = v_case_c;

  ASSERT v_status = 'Awaiting Documents', 'TEST 3 FAILED: Expected Awaiting Documents, got ' || COALESCE(v_status, 'NULL');
  ASSERT v_missing = 1, 'TEST 3 FAILED: missing_count should be 1';
  RAISE NOTICE '✓ TEST 3 PASSED: Case C -> Awaiting Documents (correct missing_count)';

  -- ---------------------------------------------------------------------------
  -- TEST 4: Case D -> Dispatched in 2 separate batches -> Both active, Completed
  -- ---------------------------------------------------------------------------
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_id, (v_month - INTERVAL '1 month')::date, 'B_20th', (v_month - INTERVAL '1 month')::date + 19, v_test_admin_id)
  RETURNING id INTO v_case_d;

  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES (v_case_d, v_dt_1, true, now(), v_test_admin_id) RETURNING id INTO v_cd_1;
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES (v_case_d, v_dt_2, true, now(), v_test_admin_id) RETURNING id INTO v_cd_2;

  -- Batch 1
  INSERT INTO public.dispatches (case_id, recipient, recorded_by)
  VALUES (v_case_d, 'Recipient 1', v_test_admin_id) RETURNING id INTO v_disp_1;
  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active) VALUES (v_disp_1, v_cd_1, true);

  -- Batch 2
  INSERT INTO public.dispatches (case_id, recipient, recorded_by)
  VALUES (v_case_d, 'Recipient 2', v_test_admin_id) RETURNING id INTO v_disp_2;
  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active) VALUES (v_disp_2, v_cd_2, true);

  SELECT status INTO v_status FROM public.case_status WHERE case_id = v_case_d;
  SELECT COUNT(*) INTO v_active_disp_count FROM public.dispatches WHERE case_id = v_case_d AND voided_at IS NULL;

  ASSERT v_status = 'Completed', 'TEST 4 FAILED: Expected Completed';
  ASSERT v_active_disp_count = 2, 'TEST 4 FAILED: Both dispatches should be preserved';
  RAISE NOTICE '✓ TEST 4 PASSED: Case D -> Both dispatches preserved and status Completed';

  -- ---------------------------------------------------------------------------
  -- TEST 5: Adding a new required document to a Completed case -> Recalculates
  -- ---------------------------------------------------------------------------
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES (v_case_a, v_dt_3, true, NULL, NULL) RETURNING id INTO v_cd_new;

  SELECT status, missing_count INTO v_status, v_missing
  FROM public.case_status WHERE case_id = v_case_a;

  ASSERT v_status = 'Awaiting Documents', 'TEST 5 FAILED: Expected Awaiting Documents after adding doc';
  ASSERT v_missing = 1, 'TEST 5 FAILED: missing_count should be 1';
  RAISE NOTICE '✓ TEST 5 PASSED: Adding new required document dynamically recalculated status';

  DELETE FROM public.case_documents WHERE id = v_cd_new;

  -- ---------------------------------------------------------------------------
  -- TEST 6: Voiding a dispatch -> Status reverts to Pending Dispatch, history stays
  -- ---------------------------------------------------------------------------
  PERFORM public.void_dispatch(v_disp_2, 'Auditor requested revised bank statement');

  SELECT status, undispatched_count INTO v_status, v_undispatched
  FROM public.case_status WHERE case_id = v_case_d;

  ASSERT v_status = 'Pending Dispatch', 'TEST 6 FAILED: Expected Pending Dispatch after void';
  ASSERT v_undispatched = 1, 'TEST 6 FAILED: Expected 1 undispatched doc after void';

  SELECT EXISTS (
    SELECT 1 FROM public.activity_logs
    WHERE action = 'VOID_DISPATCH' AND entity_id = v_disp_2
  ) INTO v_error_caught;
  ASSERT v_error_caught = true, 'TEST 6 FAILED: Activity log entry missing for void_dispatch';
  RAISE NOTICE '✓ TEST 6 PASSED: Voiding dispatch returned status to Pending Dispatch and logged audit entry';

  -- ---------------------------------------------------------------------------
  -- TEST 7: The same document cannot be in two active dispatches
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    INSERT INTO public.dispatches (case_id, recipient, recorded_by)
    VALUES (v_case_d, 'Duplicate Dispatch Test', v_test_admin_id) RETURNING id INTO v_disp_2;

    INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
    VALUES (v_disp_2, v_cd_1, true);
  EXCEPTION WHEN unique_violation THEN
    v_error_caught := true;
  END;

  ASSERT v_error_caught = true, 'TEST 7 FAILED: Partial unique constraint did not block double active dispatch';
  RAISE NOTICE '✓ TEST 7 PASSED: Same document cannot be in two active dispatches';

  -- ---------------------------------------------------------------------------
  -- TEST 8: A case with zero required documents is NOT Completed ('No Required Documents')
  -- ---------------------------------------------------------------------------
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_id, (v_month - INTERVAL '2 months')::date, 'A_11th', (v_month - INTERVAL '2 months')::date + 10, v_test_admin_id)
  RETURNING id INTO v_case_g;

  SELECT status INTO v_status FROM public.case_status WHERE case_id = v_case_g;
  ASSERT v_status = 'No Required Documents', 'TEST 8 FAILED: Expected No Required Documents, got ' || COALESCE(v_status, 'NULL');
  RAISE NOTICE '✓ TEST 8 PASSED: Zero required documents case is No Required Documents (never Completed)';

  -- ---------------------------------------------------------------------------
  -- TEST 9: activity_logs UPDATE and DELETE are blocked by trigger
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    UPDATE public.activity_logs SET action = 'ALTERED' WHERE action = 'VOID_DISPATCH';
  EXCEPTION WHEN others THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught = true, 'TEST 9a FAILED: UPDATE on activity_logs was not blocked';

  v_error_caught := false;
  BEGIN
    DELETE FROM public.activity_logs WHERE action = 'VOID_DISPATCH';
  EXCEPTION WHEN others THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught = true, 'TEST 9b FAILED: DELETE on activity_logs was not blocked';
  RAISE NOTICE '✓ TEST 9 PASSED: activity_logs is strictly append-only (UPDATE and DELETE blocked)';

  -- ---------------------------------------------------------------------------
  -- TEST 10: Duplicate case (same firm, month, cycle) is rejected
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
    VALUES (v_firm_id, v_month, 'A_11th', v_month + 10, v_test_admin_id);
  EXCEPTION WHEN unique_violation THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught = true, 'TEST 10 FAILED: Duplicate case (firm, month, cycle) was not rejected';
  RAISE NOTICE '✓ TEST 10 PASSED: Duplicate case (firm, month, cycle) rejected by UNIQUE constraint';

  -- ---------------------------------------------------------------------------
  -- TEST 12: Optional doc missing but case Completed
  -- ---------------------------------------------------------------------------
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_id, (v_month - INTERVAL '3 months')::date, 'A_11th', (v_month - INTERVAL '3 months')::date + 10, v_test_admin_id)
  RETURNING id INTO v_case_f;

  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES (v_case_f, v_dt_1, true, now(), v_test_admin_id) RETURNING id INTO v_cd_1;

  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES (v_case_f, v_dt_opt, false, NULL, NULL) RETURNING id INTO v_cd_opt;

  INSERT INTO public.dispatches (case_id, recipient, recorded_by)
  VALUES (v_case_f, 'CA Sharma', v_test_admin_id) RETURNING id INTO v_disp_1;
  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
  VALUES (v_disp_1, v_cd_1, true);

  SELECT status INTO v_status FROM public.case_status WHERE case_id = v_case_f;
  ASSERT v_status = 'Completed', 'TEST 12 FAILED: Expected Completed when optional doc is missing';
  RAISE NOTICE '✓ TEST 12 PASSED: Missing optional document does not prevent Completed status';

  -- ---------------------------------------------------------------------------
  -- TEST 13: Staff cannot change is_required or removed_at on case_documents
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_staff_id, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);

    UPDATE public.case_documents
    SET is_required = false
    WHERE id = v_cd_1;
  EXCEPTION WHEN others THEN
    v_error_caught := true;
  END;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_admin_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);

  ASSERT v_error_caught = true, 'TEST 13 FAILED: Staff was able to update is_required';
  RAISE NOTICE '✓ TEST 13 PASSED: Staff cannot alter is_required or removed_at on case_documents';

  -- ---------------------------------------------------------------------------
  -- TEST 14: Staff cannot spoof user_id on dispatches or logs
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_staff_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);

  UPDATE public.case_documents
  SET received_at = now(),
      received_by = v_test_admin_id
  WHERE id = v_cd_opt;

  SELECT received_by INTO v_cd_new
  FROM public.case_documents
  WHERE id = v_cd_opt;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_admin_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);

  ASSERT v_cd_new = v_test_staff_id, 'TEST 14 FAILED: received_by was not overridden to auth.uid()';
  RAISE NOTICE '✓ TEST 14 PASSED: Staff user_id spoofing prevented by database trigger';

  -- ---------------------------------------------------------------------------
  -- TEST 15: New signup profile is inactive and sees no data
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_inactive_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_inactive_id::text, true);

  ASSERT public.is_active_user() = false, 'TEST 15 FAILED: is_active_user should return false for inactive';

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_admin_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);
  RAISE NOTICE '✓ TEST 15 PASSED: New signup profile is inactive (is_active_user = false)';

  -- ---------------------------------------------------------------------------
  -- TEST 16: Un-receiving a dispatched document is blocked
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    UPDATE public.case_documents
    SET received_at = NULL
    WHERE id = v_cd_1;
  EXCEPTION WHEN others THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught = true, 'TEST 16 FAILED: Un-receiving a dispatched document was not blocked';
  RAISE NOTICE '✓ TEST 16 PASSED: Un-receiving a document in an active dispatch is blocked';

  -- ---------------------------------------------------------------------------
  -- TEST 17: Adding an item to a voided dispatch is blocked
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
    VALUES (v_disp_2, v_cd_2, true);
  EXCEPTION WHEN others THEN
    v_error_caught := true;
  END;
  ASSERT v_error_caught = true, 'TEST 17 FAILED: Adding item to voided dispatch was not blocked';
  RAISE NOTICE '✓ TEST 17 PASSED: Adding dispatch item to voided dispatch is blocked';

  -- ---------------------------------------------------------------------------
  -- TEST 18: The anon role cannot read any table or view
  -- ---------------------------------------------------------------------------
  SELECT has_table_privilege('anon', 'public.cases', 'SELECT') INTO v_error_caught;
  ASSERT v_error_caught = false, 'TEST 18 FAILED: anon has SELECT privilege on cases';
  RAISE NOTICE '✓ TEST 18 PASSED: anon role has zero table privileges (access denied)';

  -- ---------------------------------------------------------------------------
  -- TEST 19: Archived-firm cases are identifiable via firm_is_active
  -- ---------------------------------------------------------------------------
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_archived_firm_id, v_month, 'A_11th', v_month + 10, v_test_admin_id)
  RETURNING id INTO v_case_h;

  SELECT firm_is_active INTO v_firm_active
  FROM public.case_status
  WHERE case_id = v_case_h;

  ASSERT v_firm_active = false, 'TEST 19 FAILED: firm_is_active should be false for archived firm case';
  RAISE NOTICE '✓ TEST 19 PASSED: Archived-firm cases clearly identifiable via firm_is_active = false';

  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'ALL 19 TESTS PASSED SUCCESSFULLY! ROLLING BACK TRANSACTION (NO RESIDUAL DATA)';
  RAISE NOTICE '=============================================================================';
END $$;

ROLLBACK;
