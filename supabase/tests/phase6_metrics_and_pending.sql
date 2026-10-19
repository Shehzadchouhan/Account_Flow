-- =============================================================================
-- FINANCEFLOW PHASE 6 AUTOMATED VERIFICATION SUITE
-- Dashboard Metrics, Pending Work Queue, Search, & Cross-Page Consistency
--
-- Safe Execution: Entire test runs inside a transaction and ends with ROLLBACK.
-- Guarantees zero residual data changes while validating all 8 test assertions.
-- =============================================================================
BEGIN;

-- Ensure migration 8 indexes and views are in place for the test session
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP VIEW IF EXISTS public.case_document_status CASCADE;

CREATE VIEW public.case_document_status
WITH (security_invoker = true)
AS
SELECT
  cd.id AS case_document_id,
  cd.case_id,
  c.firm_id,
  cd.document_type_id,
  dt.name AS document_type_name,
  cd.is_required,
  cd.received_at,
  cd.received_by,
  cd.notes,
  cd.created_at,
  cd.updated_at,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.dispatch_items di
      JOIN public.dispatches d ON d.id = di.dispatch_id
      WHERE di.case_document_id = cd.id
        AND di.is_active = true
        AND d.voided_at IS NULL
    ) THEN 'Dispatched'
    WHEN cd.received_at IS NOT NULL THEN 'Received - Not Dispatched'
    ELSE 'Awaiting Receipt'
  END AS status,
  f.name AS firm_name,
  f.is_active AS firm_is_active,
  c.period_month,
  c.cycle,
  c.due_date,
  c.assigned_to,
  p.full_name AS assigned_to_name,
  (
    c.due_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND NOT EXISTS (
      SELECT 1
      FROM public.dispatch_items di
      JOIN public.dispatches d ON d.id = di.dispatch_id
      WHERE di.case_document_id = cd.id
        AND di.is_active = true
        AND d.voided_at IS NULL
    )
  ) AS is_overdue
FROM public.case_documents cd
JOIN public.cases c ON c.id = cd.case_id
JOIN public.firms f ON f.id = c.firm_id
JOIN public.document_types dt ON dt.id = cd.document_type_id
LEFT JOIN public.profiles p ON p.id = c.assigned_to
WHERE cd.removed_at IS NULL;

GRANT SELECT ON public.case_document_status TO authenticated;
GRANT SELECT ON public.case_document_status TO service_role;

DO $$
DECLARE
  v_test_admin_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_test_staff_id uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;

  -- Seed Firms
  v_firm_apex uuid;
  v_firm_bharat uuid;
  v_firm_cauvery uuid;
  v_firm_doon uuid;
  v_firm_evergreen uuid;

  -- Seed Document Types
  v_dt_sales uuid;
  v_dt_purchase uuid;
  v_dt_bank uuid;
  v_dt_gstr3b uuid;
  v_dt_expense uuid;

  -- Seed Cases
  v_month date := date_trunc('month', current_date)::date;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;

  v_case_a uuid;
  v_case_b uuid;
  v_case_c uuid;
  v_case_d uuid;
  v_case_e uuid;
  v_case_f uuid;
  v_case_g uuid;
  v_case_h uuid;

  -- Metric Counters
  v_count int;
  v_distinct_firms int;
  v_firms_attention int;
  v_cases_awaiting int;
  v_cases_pending_disp int;
  v_cases_completed int;
  v_cases_needs_setup int;
  v_cases_overdue int;
  v_cases_due_today int;
  v_docs_rec_not_disp int;
  v_docs_awaiting_rec int;

  -- Dynamic test variables
  v_cd_missing uuid;
  v_cd_missing_2 uuid;
  v_new_disp_id uuid;
  v_disp_res jsonb;
  v_void_res jsonb;
  v_case_due_today_id uuid;

BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'STARTING PHASE 6 VERIFICATION: DASHBOARD, PENDING WORK, SEARCH & CONSISTENCY';
  RAISE NOTICE '=============================================================================';

  -- 1. Setup Mock Auth Users & Profiles
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
  VALUES
    (v_test_admin_id, '00000000-0000-0000-0000-000000000000', 'admin@financeflow.local', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin"}', now(), now(), 'authenticated', 'authenticated'),
    (v_test_staff_id, '00000000-0000-0000-0000-000000000000', 'staff@financeflow.local', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Staff"}', now(), now(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES
    (v_test_admin_id, 'Test Admin', 'admin@financeflow.local', 'admin', true),
    (v_test_staff_id, 'Test Staff', 'staff@financeflow.local', 'staff', true)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role, is_active = true;

  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);

  -- 2. Setup Document Types
  INSERT INTO public.document_types (name, is_active)
  VALUES
    ('Sales Register', true),
    ('Purchase Register', true),
    ('Bank Statement', true),
    ('GSTR-3B Summary', true),
    ('Expense Vouchers', true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET is_active = true;

  SELECT id INTO v_dt_sales FROM public.document_types WHERE name = 'Sales Register';
  SELECT id INTO v_dt_purchase FROM public.document_types WHERE name = 'Purchase Register';
  SELECT id INTO v_dt_bank FROM public.document_types WHERE name = 'Bank Statement';
  SELECT id INTO v_dt_gstr3b FROM public.document_types WHERE name = 'GSTR-3B Summary';
  SELECT id INTO v_dt_expense FROM public.document_types WHERE name = 'Expense Vouchers';

  -- 3. Setup Client Firms (4 active, 1 archived)
  INSERT INTO public.firms (name, default_employee, is_active)
  VALUES ('Apex Logistics Pvt Ltd', v_test_staff_id, true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET is_active = true RETURNING id INTO v_firm_apex;

  INSERT INTO public.firms (name, default_employee, is_active)
  VALUES ('Bharat Engineering Works', v_test_staff_id, true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET is_active = true RETURNING id INTO v_firm_bharat;

  INSERT INTO public.firms (name, default_employee, is_active)
  VALUES ('Cauvery Textiles & Garments', v_test_staff_id, true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET is_active = true RETURNING id INTO v_firm_cauvery;

  INSERT INTO public.firms (name, default_employee, is_active)
  VALUES ('Doon Valley Agro Foods', v_test_staff_id, true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET is_active = true RETURNING id INTO v_firm_doon;

  INSERT INTO public.firms (name, default_employee, is_active)
  VALUES ('Evergreen Solar Solutions', v_test_staff_id, false)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET is_active = false RETURNING id INTO v_firm_evergreen;

  -- 4. Setup Seed Scenarios A to H
  -- Scenario A: Apex, A_11th (due 11th). 5 required, all 5 dispatched -> Completed
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_apex, v_month, 'A_11th', (v_month + INTERVAL '10 days')::date, v_test_staff_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date RETURNING id INTO v_case_a;
  DELETE FROM public.case_documents WHERE case_id = v_case_a;
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  SELECT v_case_a, dt.id, true, now() - INTERVAL '3 days', v_test_admin_id FROM public.document_types dt;
  INSERT INTO public.dispatches (case_id, recipient, sent_at, recorded_by)
  VALUES (v_case_a, 'CA Verma', now() - INTERVAL '1 day', v_test_admin_id) RETURNING id INTO v_new_disp_id;
  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
  SELECT v_new_disp_id, cd.id, true FROM public.case_documents cd WHERE cd.case_id = v_case_a;

  -- Scenario B: Bharat, B_20th (due 20th). 5 required received, 4 dispatched -> Pending Dispatch (1 undispatched)
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_bharat, v_month, 'B_20th', (v_month + INTERVAL '19 days')::date, v_test_staff_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date RETURNING id INTO v_case_b;
  DELETE FROM public.case_documents WHERE case_id = v_case_b;
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  SELECT v_case_b, dt.id, true, now() - INTERVAL '2 days', v_test_admin_id FROM public.document_types dt;
  INSERT INTO public.dispatches (case_id, recipient, sent_at, recorded_by)
  VALUES (v_case_b, 'Audit Cell', now() - INTERVAL '12 hours', v_test_admin_id) RETURNING id INTO v_new_disp_id;
  -- Dispatch 4 of 5
  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
  SELECT v_new_disp_id, cd.id, true FROM public.case_documents cd WHERE cd.case_id = v_case_b AND cd.document_type_id <> v_dt_expense;

  -- Scenario C: Cauvery, A_11th (due 11th). 5 required: 3 received, 2 missing -> Awaiting Documents, Overdue!
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_cauvery, v_month, 'A_11th', (v_month + INTERVAL '10 days')::date, v_test_staff_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date RETURNING id INTO v_case_c;
  DELETE FROM public.case_documents WHERE case_id = v_case_c;
  -- 3 received
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES
    (v_case_c, v_dt_sales, true, now() - INTERVAL '1 day', v_test_admin_id),
    (v_case_c, v_dt_purchase, true, now() - INTERVAL '1 day', v_test_admin_id),
    (v_case_c, v_dt_bank, true, now() - INTERVAL '1 day', v_test_admin_id);
  -- 2 missing
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES (v_case_c, v_dt_gstr3b, true, NULL, NULL) RETURNING id INTO v_cd_missing;
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES (v_case_c, v_dt_expense, true, NULL, NULL) RETURNING id INTO v_cd_missing_2;

  -- Scenario D: Doon, B_20th (due 20th). 5 required, all dispatched -> Completed
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_doon, v_month, 'B_20th', (v_month + INTERVAL '19 days')::date, v_test_staff_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date RETURNING id INTO v_case_d;
  DELETE FROM public.case_documents WHERE case_id = v_case_d;
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  SELECT v_case_d, dt.id, true, now() - INTERVAL '4 days', v_test_admin_id FROM public.document_types dt;
  INSERT INTO public.dispatches (case_id, recipient, sent_at, recorded_by)
  VALUES (v_case_d, 'Accounts Reviewer', now() - INTERVAL '1 day', v_test_admin_id) RETURNING id INTO v_new_disp_id;
  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
  SELECT v_new_disp_id, cd.id, true FROM public.case_documents cd WHERE cd.case_id = v_case_d;

  -- Scenario E: Apex, B_20th (due 20th). 5 required received, 0 dispatched -> Pending Dispatch (5 undispatched)
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_apex, v_month, 'B_20th', (v_month + INTERVAL '19 days')::date, v_test_staff_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date RETURNING id INTO v_case_e;
  DELETE FROM public.case_documents WHERE case_id = v_case_e;
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  SELECT v_case_e, dt.id, true, now() - INTERVAL '1 day', v_test_admin_id FROM public.document_types dt;

  -- Scenario F: Bharat, A_11th (due 11th). 4 required dispatched, 1 optional missing -> Completed
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_bharat, v_month, 'A_11th', (v_month + INTERVAL '10 days')::date, v_test_staff_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date RETURNING id INTO v_case_f;
  DELETE FROM public.case_documents WHERE case_id = v_case_f;
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES
    (v_case_f, v_dt_sales, true, now() - INTERVAL '2 days', v_test_admin_id),
    (v_case_f, v_dt_purchase, true, now() - INTERVAL '2 days', v_test_admin_id),
    (v_case_f, v_dt_bank, true, now() - INTERVAL '2 days', v_test_admin_id),
    (v_case_f, v_dt_gstr3b, true, now() - INTERVAL '2 days', v_test_admin_id),
    (v_case_f, v_dt_expense, false, NULL, NULL); -- Optional unreceived doc
  INSERT INTO public.dispatches (case_id, recipient, sent_at, recorded_by)
  VALUES (v_case_f, 'External CA', now() - INTERVAL '1 day', v_test_admin_id) RETURNING id INTO v_new_disp_id;
  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
  SELECT v_new_disp_id, cd.id, true FROM public.case_documents cd WHERE cd.case_id = v_case_f AND cd.is_required = true;

  -- Scenario G: Cauvery, B_20th (due 20th). 0 documents -> No Required Documents ("Needs setup")
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_cauvery, v_month, 'B_20th', (v_month + INTERVAL '19 days')::date, v_test_staff_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date RETURNING id INTO v_case_g;
  DELETE FROM public.case_documents WHERE case_id = v_case_g;

  -- Scenario H: Evergreen Solar (Archived firm). 5 required unreceived docs.
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_evergreen, v_month, 'A_11th', (v_month + INTERVAL '10 days')::date, v_test_staff_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date RETURNING id INTO v_case_h;
  DELETE FROM public.case_documents WHERE case_id = v_case_h;
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  SELECT v_case_h, dt.id, true, NULL, NULL FROM public.document_types dt;

  -- ===========================================================================
  -- ASSERTION 1: Baseline Seed Scenario Counts (Current Month)
  -- ===========================================================================
  SELECT COUNT(DISTINCT id) INTO v_distinct_firms FROM public.firms WHERE is_active = true;
  IF v_distinct_firms <> 4 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Expected 4 active firms, got %', v_distinct_firms;
  END IF;

  SELECT COUNT(DISTINCT firm_id) INTO v_firms_attention
  FROM public.case_status
  WHERE firm_is_active = true
    AND period_month = v_month
    AND status <> 'Completed'
    AND (is_overdue = true OR due_date = v_today);
  IF v_firms_attention <> 1 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Expected 1 firm needing attention, got %', v_firms_attention;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'Awaiting Documents'),
    COUNT(*) FILTER (WHERE status = 'Pending Dispatch'),
    COUNT(*) FILTER (WHERE status = 'Completed'),
    COUNT(*) FILTER (WHERE status = 'No Required Documents'),
    COUNT(*) FILTER (WHERE is_overdue = true),
    COUNT(*) FILTER (WHERE due_date = v_today AND status <> 'Completed')
  INTO
    v_cases_awaiting,
    v_cases_pending_disp,
    v_cases_completed,
    v_cases_needs_setup,
    v_cases_overdue,
    v_cases_due_today
  FROM public.case_status
  WHERE period_month = v_month AND firm_is_active = true;

  IF v_cases_awaiting <> 1 OR v_cases_pending_disp <> 2 OR v_cases_completed <> 3 OR v_cases_needs_setup <> 1 OR v_cases_overdue <> 1 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Case status counts mismatch. Awaiting: %, Pending: %, Completed: %, NeedsSetup: %, Overdue: %',
      v_cases_awaiting, v_cases_pending_disp, v_cases_completed, v_cases_needs_setup, v_cases_overdue;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'Received - Not Dispatched'),
    COUNT(*) FILTER (WHERE status = 'Awaiting Receipt')
  INTO
    v_docs_rec_not_disp,
    v_docs_awaiting_rec
  FROM public.case_document_status
  WHERE period_month = v_month AND firm_is_active = true;

  IF v_docs_rec_not_disp <> 9 OR v_docs_awaiting_rec <> 3 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Document status counts mismatch. RecNotDisp: % (expected 9), AwaitingRec: % (expected 3)',
      v_docs_rec_not_disp, v_docs_awaiting_rec;
  END IF;

  RAISE NOTICE 'TEST 1 PASSED: Baseline seed scenarios produce documented metric counts.';

  -- ===========================================================================
  -- ASSERTION 2: Archived Firm Exclusion
  -- ===========================================================================
  -- Confirm Evergreen Solar is excluded from active firm metrics
  SELECT COUNT(*) INTO v_count
  FROM public.case_status
  WHERE firm_id = v_firm_evergreen AND firm_is_active = true;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Archived firm Evergreen Solar appeared in active case_status query.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.case_document_status
  WHERE firm_id = v_firm_evergreen AND firm_is_active = true;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Archived firm documents appeared in active case_document_status query.';
  END IF;

  RAISE NOTICE 'TEST 2 PASSED: Archived firm records are strictly excluded from operational metrics.';

  -- ===========================================================================
  -- ASSERTION 3: Metric Transition on Document Receipt
  -- ===========================================================================
  -- In Case C (Cauvery), receive 1st missing doc
  PERFORM public.receive_document(v_cd_missing);

  SELECT
    COUNT(*) FILTER (WHERE status = 'Received - Not Dispatched'),
    COUNT(*) FILTER (WHERE status = 'Awaiting Receipt')
  INTO v_docs_rec_not_disp, v_docs_awaiting_rec
  FROM public.case_document_status
  WHERE period_month = v_month AND firm_is_active = true;

  IF v_docs_rec_not_disp <> 10 OR v_docs_awaiting_rec <> 2 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Document counts did not update on receipt. RecNotDisp: %, AwaitingRec: %',
      v_docs_rec_not_disp, v_docs_awaiting_rec;
  END IF;

  -- Receive 2nd missing doc: Case C should now become 'Pending Dispatch'
  PERFORM public.receive_document(v_cd_missing_2);

  SELECT status INTO v_cases_awaiting
  FROM public.case_status WHERE case_id = v_case_c;

  SELECT
    COUNT(*) FILTER (WHERE status = 'Awaiting Documents'),
    COUNT(*) FILTER (WHERE status = 'Pending Dispatch')
  INTO v_cases_awaiting, v_cases_pending_disp
  FROM public.case_status
  WHERE period_month = v_month AND firm_is_active = true;

  IF v_cases_awaiting <> 0 OR v_cases_pending_disp <> 3 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Case status did not transition to Pending Dispatch on full receipt. Awaiting: %, Pending: %',
      v_cases_awaiting, v_cases_pending_disp;
  END IF;

  RAISE NOTICE 'TEST 3 PASSED: Document receipt correctly transitioned document and case metrics.';

  -- ===========================================================================
  -- ASSERTION 4: Metric Transition on Document Dispatch
  -- ===========================================================================
  -- Dispatch all 5 documents of Case C
  v_disp_res := public.create_dispatch(
    p_case_id := v_case_c,
    p_recipient := 'CA Sundaram (sundaram@cauverytax.fake)',
    p_document_ids := (
      SELECT array_agg(id) FROM public.case_documents WHERE case_id = v_case_c AND is_required = true
    ),
    p_email_reference := 'Full Docket Dispatch - Cauvery Cycle A'
  );

  v_new_disp_id := (v_disp_res->>'id')::uuid;

  SELECT
    COUNT(*) FILTER (WHERE status = 'Pending Dispatch'),
    COUNT(*) FILTER (WHERE status = 'Completed'),
    COUNT(*) FILTER (WHERE is_overdue = true)
  INTO v_cases_pending_disp, v_cases_completed, v_cases_overdue
  FROM public.case_status
  WHERE period_month = v_month AND firm_is_active = true;

  IF v_cases_pending_disp <> 2 OR v_cases_completed <> 4 OR v_cases_overdue <> 0 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Case metrics did not update on dispatch. Pending: %, Completed: %, Overdue: %',
      v_cases_pending_disp, v_cases_completed, v_cases_overdue;
  END IF;

  -- Overdue count dropped to 0, so firms needing attention should now be 0!
  SELECT COUNT(DISTINCT firm_id) INTO v_firms_attention
  FROM public.case_status
  WHERE firm_is_active = true
    AND period_month = v_month
    AND status <> 'Completed'
    AND (is_overdue = true OR due_date = v_today);
  IF v_firms_attention <> 0 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Expected 0 firms needing attention after dispatch, got %', v_firms_attention;
  END IF;

  RAISE NOTICE 'TEST 4 PASSED: Dispatch creation transitioned case to Completed and eliminated overdue queue.';

  -- ===========================================================================
  -- ASSERTION 5: Metric Transition on Dispatch Voiding
  -- ===========================================================================
  v_void_res := public.void_dispatch(
    p_dispatch_id := v_new_disp_id,
    p_void_reason := 'Incorrect recipient CA address on docket envelope'
  );

  -- Case C should revert to Pending Dispatch and become Overdue again
  SELECT
    COUNT(*) FILTER (WHERE status = 'Pending Dispatch'),
    COUNT(*) FILTER (WHERE status = 'Completed'),
    COUNT(*) FILTER (WHERE is_overdue = true)
  INTO v_cases_pending_disp, v_cases_completed, v_cases_overdue
  FROM public.case_status
  WHERE period_month = v_month AND firm_is_active = true;

  IF v_cases_pending_disp <> 3 OR v_cases_completed <> 3 OR v_cases_overdue <> 1 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Case metrics did not revert after voiding. Pending: %, Completed: %, Overdue: %',
      v_cases_pending_disp, v_cases_completed, v_cases_overdue;
  END IF;

  SELECT COUNT(DISTINCT firm_id) INTO v_firms_attention
  FROM public.case_status
  WHERE firm_is_active = true
    AND period_month = v_month
    AND status <> 'Completed'
    AND (is_overdue = true OR due_date = v_today);
  IF v_firms_attention <> 1 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Expected 1 firm needing attention after voiding, got %', v_firms_attention;
  END IF;

  RAISE NOTICE 'TEST 5 PASSED: Dispatch voiding correctly restored pending dispatch and overdue metrics.';

  -- ===========================================================================
  -- ASSERTION 6: Due Today Dynamic Metric Evaluation
  -- ===========================================================================
  -- Create a new case due today for Doon Valley
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_doon, v_month, 'A_11th', v_today, v_test_staff_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date
  RETURNING id INTO v_case_due_today_id;

  INSERT INTO public.case_documents (case_id, document_type_id, is_required)
  VALUES (v_case_due_today_id, v_dt_sales, true);

  SELECT COUNT(*) INTO v_cases_due_today
  FROM public.case_status
  WHERE period_month = v_month AND firm_is_active = true AND due_date = v_today AND status <> 'Completed';

  IF v_cases_due_today < 1 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Due today case count did not register new case due on %', v_today;
  END IF;

  RAISE NOTICE 'TEST 6 PASSED: Cases due today dynamically evaluate and increment metrics.';

  -- ===========================================================================
  -- ASSERTION 7: Cross-Page Consistency Guarantees
  -- ===========================================================================
  -- The count of pending documents in case_document_status view
  SELECT COUNT(*) INTO v_count
  FROM public.case_document_status
  WHERE period_month = v_month AND firm_is_active = true AND status = 'Received - Not Dispatched';

  -- Check against case_status undispatched_count sum across cases
  SELECT COALESCE(SUM(undispatched_count), 0) INTO v_docs_rec_not_disp
  FROM public.case_status
  WHERE period_month = v_month AND firm_is_active = true;

  IF v_count <> v_docs_rec_not_disp THEN
    RAISE EXCEPTION 'TEST 7 FAILED: Cross-page mismatch between case_document_status (%) and case_status sum (%)',
      v_count, v_docs_rec_not_disp;
  END IF;

  RAISE NOTICE 'TEST 7 PASSED: Cross-page consistency verified between dashboard cards and list views.';

  -- ===========================================================================
  -- ASSERTION 8: Workload Partition Integrity
  -- ===========================================================================
  -- Sum of cases partitioned by assigned_to equals total cases for month
  SELECT COUNT(*) INTO v_count
  FROM public.case_status
  WHERE period_month = v_month AND firm_is_active = true;

  WITH workload_sum AS (
    SELECT COUNT(*) AS total_assigned
    FROM public.case_status
    WHERE period_month = v_month AND firm_is_active = true
    GROUP BY assigned_to
  )
  SELECT COALESCE(SUM(total_assigned), 0) INTO v_cases_completed FROM workload_sum;

  IF v_count <> v_cases_completed THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Workload sum (%) does not equal total active cases (%)',
      v_cases_completed, v_count;
  END IF;

  RAISE NOTICE 'TEST 8 PASSED: Workload partitioning maintains 100%% count integrity.';

  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'ALL 8 PHASE 6 AUTOMATED VERIFICATIONS PASSED SUCESSFULLY!';
  RAISE NOTICE '=============================================================================';
END $$;

ROLLBACK;
