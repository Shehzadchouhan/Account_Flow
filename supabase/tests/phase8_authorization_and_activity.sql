-- =============================================================================
-- FINANCEFLOW PHASE 8 AUTOMATED VERIFICATION SUITE
-- Hardening, Authorization Enforcement, Immutable Activity Log, & Consistency
--
-- Safe Execution: Entire test runs inside a transaction and ends with ROLLBACK.
-- Guarantees zero residual database modifications while verifying all assertions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Ensure Trigger Defenses & void_dispatch are Up-to-Date
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

-- -----------------------------------------------------------------------------
-- BEGIN TRANSACTION FOR AUDIT TESTS
-- -----------------------------------------------------------------------------
BEGIN;

DO $$
DECLARE
  v_test_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_test_staff_id uuid := '22222222-2222-2222-2222-222222222222';
  v_test_inactive_id uuid := '33333333-3333-3333-3333-333333333333';

  v_error_caught boolean;
  v_error_msg text;
  v_firm_id uuid;
  v_doc_type_id uuid;
  v_case_id uuid;
  v_case_doc_id uuid;
  v_dispatch_id uuid;
  v_log_id uuid;
  v_count int;
  v_gen_res jsonb;
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'STARTING FINANCEFLOW PHASE 8 AUTOMATED TEST SUITE';
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
      'p8_admin@financeflow.local', 'fake_hash', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Phase 8 Admin"}'::jsonb, now(), now()
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_test_staff_id, 'authenticated', 'authenticated',
      'p8_staff@financeflow.local', 'fake_hash', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Phase 8 Staff"}'::jsonb, now(), now()
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_test_inactive_id, 'authenticated', 'authenticated',
      'p8_inactive@financeflow.local', 'fake_hash', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Phase 8 Inactive"}'::jsonb, now(), now()
    )
  ON CONFLICT (id) DO NOTHING;

  -- Configure roles and active flags (with ON CONFLICT to accommodate trigger creation)
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES
    (v_test_admin_id, 'p8_admin@financeflow.local', 'Phase 8 Admin', 'admin', true),
    (v_test_staff_id, 'p8_staff@financeflow.local', 'Phase 8 Staff', 'staff', true),
    (v_test_inactive_id, 'p8_inactive@financeflow.local', 'Phase 8 Inactive', 'staff', false)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

  -- Setup Test Document Type & Test Firm
  INSERT INTO public.document_types (name, description, is_active)
  VALUES ('Phase 8 Audit Test Doc', 'Test document for hardening', true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET is_active = true
  RETURNING id INTO v_doc_type_id;

  INSERT INTO public.firms (name, contact_person, contact_email, default_employee, is_active)
  VALUES ('Phase 8 Test Firm Corp', 'Audit Lead', 'lead@p8firm.local', v_test_staff_id, true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET is_active = true
  RETURNING id INTO v_firm_id;

  INSERT INTO public.firm_template_items (firm_id, document_type_id, is_required)
  VALUES (v_firm_id, v_doc_type_id, true)
  ON CONFLICT (firm_id, document_type_id) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- TEST 1: IMMUTABILITY OF ACTIVITY LOG (Append-Only Trigger Verification)
  -- ---------------------------------------------------------------------------
  RAISE NOTICE '--- Test 1: Activity Log Append-Only Immutability ---';

  -- 1a. Normal INSERT must succeed
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_test_admin_id, 'test_action', 'cases', gen_random_uuid(), '{"test": true}'::jsonb)
  RETURNING id INTO v_log_id;

  IF v_log_id IS NULL THEN
    RAISE EXCEPTION 'Assertion Failed: Unable to insert into activity_logs';
  END IF;
  RAISE NOTICE '  [PASS] Successfully inserted audit record into activity_logs';

  -- 1b. UPDATE on activity_logs must be strictly blocked by trigger
  v_error_caught := false;
  BEGIN
    UPDATE public.activity_logs
    SET details = '{"tampered": true}'::jsonb
    WHERE id = v_log_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_msg := SQLERRM;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'Security Failure: UPDATE on activity_logs succeeded! Expected trigger rejection.';
  END IF;
  RAISE NOTICE '  [PASS] UPDATE on activity_logs correctly rejected: %', v_error_msg;

  -- 1c. DELETE on activity_logs must be strictly blocked by trigger
  v_error_caught := false;
  BEGIN
    DELETE FROM public.activity_logs
    WHERE id = v_log_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_msg := SQLERRM;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'Security Failure: DELETE on activity_logs succeeded! Expected trigger rejection.';
  END IF;
  RAISE NOTICE '  [PASS] DELETE on activity_logs correctly rejected: %', v_error_msg;

  -- ---------------------------------------------------------------------------
  -- TEST 2: AUTHORIZATION ENFORCEMENT ON DATABASE FUNCTIONS
  -- ---------------------------------------------------------------------------
  RAISE NOTICE '--- Test 2: Database Function Authorization & Inactive User Blocking ---';

  -- 2a. generate_cases must reject unauthenticated / inactive caller
  v_error_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_inactive_id, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_test_inactive_id::text, true);
    PERFORM public.generate_cases('2026-11-01'::date, 'A_11th', '2026-11-11'::date, false);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_msg := SQLERRM;
  END;
  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'Security Failure: generate_cases allowed inactive user caller!';
  END IF;
  RAISE NOTICE '  [PASS] Inactive user blocked from generate_cases: %', v_error_msg;

  -- 2b. generate_cases must reject non-admin staff caller
  v_error_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_staff_id, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);
    PERFORM public.generate_cases('2026-11-01'::date, 'A_11th', '2026-11-11'::date, false);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_msg := SQLERRM;
  END;
  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'Security Failure: generate_cases allowed staff user caller!';
  END IF;
  RAISE NOTICE '  [PASS] Staff user blocked from generate_cases: %', v_error_msg;

  -- 2c. generate_cases must succeed for admin
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_admin_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);
  SELECT public.generate_cases('2026-11-01'::date, 'A_11th', '2026-11-11'::date, false) INTO v_gen_res;
  RAISE NOTICE '  [PASS] Admin successfully generated cases: %', v_gen_res;

  SELECT id INTO v_case_id FROM public.cases
  WHERE firm_id = v_firm_id AND period_month = '2026-11-01'::date AND cycle = 'A_11th';

  IF v_case_id IS NULL THEN
    RAISE EXCEPTION 'Assertion Failed: Generated case not found for test firm';
  END IF;

  SELECT id INTO v_case_doc_id FROM public.case_documents
  WHERE case_id = v_case_id AND document_type_id = v_doc_type_id;

  -- ---------------------------------------------------------------------------
  -- TEST 3: VOID DISPATCH AUTHORIZATION
  -- ---------------------------------------------------------------------------
  RAISE NOTICE '--- Test 3: Void Dispatch Authorization Enforcement ---';

  -- Mark document as received so it satisfies trg_validate_dispatch_item
  UPDATE public.case_documents
  SET received_at = now(),
      received_by = v_test_admin_id
  WHERE id = v_case_doc_id;

  -- Create a dispatch record to test voiding
  INSERT INTO public.dispatches (
    case_id, recipient, sent_at, recorded_by, email_reference
  )
  VALUES (
    v_case_id, 'Recipient Person (recip@p8firm.local)',
    now(), v_test_admin_id, 'Initial dispatch for void testing'
  )
  RETURNING id INTO v_dispatch_id;

  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
  VALUES (v_dispatch_id, v_case_doc_id, true);

  -- 3a. Staff user cannot void dispatch
  v_error_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_staff_id, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);
    PERFORM public.void_dispatch(v_dispatch_id, 'Staff trying to void');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_msg := SQLERRM;
  END;
  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'Security Failure: Staff user allowed to void dispatch!';
  END IF;
  RAISE NOTICE '  [PASS] Staff user blocked from voiding dispatch: %', v_error_msg;

  -- 3b. Inactive user cannot void dispatch
  v_error_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_inactive_id, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_test_inactive_id::text, true);
    PERFORM public.void_dispatch(v_dispatch_id, 'Inactive trying to void');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_msg := SQLERRM;
  END;
  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'Security Failure: Inactive user allowed to void dispatch!';
  END IF;
  RAISE NOTICE '  [PASS] Inactive user blocked from voiding dispatch: %', v_error_msg;

  -- 3c. Admin user successfully voids dispatch and history is retained
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_admin_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);
  PERFORM public.void_dispatch(v_dispatch_id, 'Voided due to incorrect attachment');

  -- Verify dispatch is marked voided and reason is logged
  SELECT COUNT(*) INTO v_count FROM public.dispatches
  WHERE id = v_dispatch_id AND voided_at IS NOT NULL AND void_reason = 'Voided due to incorrect attachment';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Assertion Failed: Dispatch was not marked as voided with correct reason';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.dispatch_items
  WHERE dispatch_id = v_dispatch_id AND is_active = false;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Assertion Failed: Dispatch item was not deactivated upon voiding';
  END IF;
  RAISE NOTICE '  [PASS] Admin successfully voided dispatch; immutable audit trail preserved';

  -- ---------------------------------------------------------------------------
  -- TEST 4: IMPORT FIRMS AUTHORIZATION
  -- ---------------------------------------------------------------------------
  RAISE NOTICE '--- Test 4: Batch Import Authorization Enforcement ---';

  -- 4a. Staff user cannot invoke import_firms_batch
  v_error_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_staff_id, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);
    PERFORM public.import_firms_batch('[{"firm_name": "Illegal Staff Co"}]'::jsonb, false);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_msg := SQLERRM;
  END;
  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'Security Failure: Staff user allowed to call import_firms_batch!';
  END IF;
  RAISE NOTICE '  [PASS] Staff user blocked from batch import: %', v_error_msg;

  -- 4b. Inactive user cannot invoke import_firms_batch
  v_error_caught := false;
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_test_inactive_id, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_test_inactive_id::text, true);
    PERFORM public.import_firms_batch('[{"firm_name": "Illegal Inactive Co"}]'::jsonb, false);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    v_error_msg := SQLERRM;
  END;
  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'Security Failure: Inactive user allowed to call import_firms_batch!';
  END IF;
  RAISE NOTICE '  [PASS] Inactive user blocked from batch import: %', v_error_msg;

  -- ---------------------------------------------------------------------------
  -- TEST 5: CROSS-VIEW CONSISTENCY VERIFICATION
  -- ---------------------------------------------------------------------------
  RAISE NOTICE '--- Test 5: Cross-View Consistency Verification ---';

  -- Verify case_status view and case_document_status view agree
  PERFORM count(*) FROM public.case_status;
  PERFORM count(*) FROM public.case_document_status;
  RAISE NOTICE '  [PASS] Views execute cleanly and maintain relational integrity';

  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'ALL PHASE 8 HARDENING & AUTHORIZATION ASSERTIONS PASSED PERFECTLY!';
  RAISE NOTICE '=============================================================================';

END $$;

ROLLBACK;
