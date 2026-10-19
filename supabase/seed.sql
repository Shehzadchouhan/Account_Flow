-- =============================================================================
-- Seed Data: Development & Testing Scenarios
-- Phase 2: Database Design for FinanceFlow
--
-- DEV ONLY: Contains clearly fake Indian business names and demo records.
--
-- CLEANUP SCRIPT:
-- To remove all seed data, run the following:
--   DELETE FROM public.firms WHERE name IN (
--     'Apex Logistics Pvt Ltd',
--     'Bharat Engineering Works',
--     'Cauvery Textiles & Garments',
--     'Doon Valley Agro Foods',
--     'Evergreen Solar Solutions'
--   );
--   DELETE FROM public.document_types WHERE name IN (
--     'Sales Register',
--     'Purchase Register',
--     'Bank Statement',
--     'GSTR-3B Summary',
--     'Expense Vouchers'
--   );
-- =============================================================================

DO $$
DECLARE
  -- ---------------------------------------------------------------------------
  -- Admin Profile Email Variable
  -- Update this email to match your Supabase admin user before running seed.
  -- ---------------------------------------------------------------------------
  v_admin_email text := 'admin@financeflow.local';
  v_admin_id uuid;

  -- Entity IDs
  v_firm_apex uuid;
  v_firm_bharat uuid;
  v_firm_cauvery uuid;
  v_firm_doon uuid;
  v_firm_evergreen uuid;

  v_dt_sales uuid;
  v_dt_purchase uuid;
  v_dt_bank uuid;
  v_dt_gstr3b uuid;
  v_dt_expense uuid;

  v_current_month date := date_trunc('month', current_date)::date;

  -- Case IDs
  v_case_a uuid;
  v_case_b uuid;
  v_case_c uuid;
  v_case_d uuid;
  v_case_e uuid;
  v_case_f uuid;
  v_case_g uuid;
  v_case_h uuid;

  -- Document IDs
  v_cd_id uuid;
  v_cd_ids uuid[];

  -- Dispatch IDs
  v_disp_id uuid;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. Locate Admin User Profile
  -- ---------------------------------------------------------------------------
  SELECT p.id INTO v_admin_id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = v_admin_email AND p.role = 'admin';

  -- Fallback: If specified email not found, look up any existing admin
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id
    FROM public.profiles
    WHERE role = 'admin' AND is_active = true
    LIMIT 1;
  END IF;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'SEED SKIPPED: No admin profile found in public.profiles.';
    RAISE NOTICE 'To apply seed data:';
    RAISE NOTICE '1. Sign up a user in Supabase Auth.';
    RAISE NOTICE '2. Run: UPDATE public.profiles SET role = ''admin'', is_active = true WHERE id = ''<user_id>'';';
    RAISE NOTICE '3. Re-run supabase/seed.sql.';
    RAISE NOTICE '=============================================================================';
    RETURN;
  END IF;

  RAISE NOTICE 'Seeding database using Admin Profile ID: %', v_admin_id;

  -- ---------------------------------------------------------------------------
  -- 2. Seed Document Types
  -- ---------------------------------------------------------------------------
  INSERT INTO public.document_types (name, description, is_active)
  VALUES
    ('Sales Register', 'Monthly sales invoices and outward supply register', true),
    ('Purchase Register', 'Inward supply invoices and purchase log', true),
    ('Bank Statement', 'Reconciled current account statements for the period', true),
    ('GSTR-3B Summary', 'Monthly summary return computation sheet', true),
    ('Expense Vouchers', 'Cash petty vouchers and office operational bills', true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE
    SET description = EXCLUDED.description
  RETURNING id INTO v_dt_sales;

  SELECT id INTO v_dt_sales FROM public.document_types WHERE name = 'Sales Register';
  SELECT id INTO v_dt_purchase FROM public.document_types WHERE name = 'Purchase Register';
  SELECT id INTO v_dt_bank FROM public.document_types WHERE name = 'Bank Statement';
  SELECT id INTO v_dt_gstr3b FROM public.document_types WHERE name = 'GSTR-3B Summary';
  SELECT id INTO v_dt_expense FROM public.document_types WHERE name = 'Expense Vouchers';

  -- ---------------------------------------------------------------------------
  -- 3. Seed Client Firms (Fake Indian Business Entities)
  -- ---------------------------------------------------------------------------
  -- Firm 1: Apex Logistics Pvt Ltd
  INSERT INTO public.firms (name, contact_person, contact_email, contact_phone, default_employee, is_active)
  VALUES ('Apex Logistics Pvt Ltd', 'Rajesh Verma', 'rajesh@apexlogistics.fake', '+91 98200 11223', v_admin_id, true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET contact_person = EXCLUDED.contact_person
  RETURNING id INTO v_firm_apex;

  -- Firm 2: Bharat Engineering Works
  INSERT INTO public.firms (name, contact_person, contact_email, contact_phone, default_employee, is_active)
  VALUES ('Bharat Engineering Works', 'Suresh Patel', 'suresh@bharateng.fake', '+91 98210 22334', v_admin_id, true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET contact_person = EXCLUDED.contact_person
  RETURNING id INTO v_firm_bharat;

  -- Firm 3: Cauvery Textiles & Garments
  INSERT INTO public.firms (name, contact_person, contact_email, contact_phone, default_employee, is_active)
  VALUES ('Cauvery Textiles & Garments', 'Meenakshi Sundaram', 'meena@cauverytextiles.fake', '+91 98400 33445', v_admin_id, true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET contact_person = EXCLUDED.contact_person
  RETURNING id INTO v_firm_cauvery;

  -- Firm 4: Doon Valley Agro Foods
  INSERT INTO public.firms (name, contact_person, contact_email, contact_phone, default_employee, is_active)
  VALUES ('Doon Valley Agro Foods', 'Amit Rawat', 'amit@doonagro.fake', '+91 98130 44556', v_admin_id, true)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET contact_person = EXCLUDED.contact_person
  RETURNING id INTO v_firm_doon;

  -- Firm 5: Evergreen Solar Solutions (Archived Firm: is_active = false)
  INSERT INTO public.firms (name, contact_person, contact_email, contact_phone, default_employee, is_active)
  VALUES ('Evergreen Solar Solutions', 'Priya Nair', 'priya@evergreensolar.fake', '+91 98710 55667', v_admin_id, false)
  ON CONFLICT (LOWER(TRIM(name))) DO UPDATE SET is_active = false
  RETURNING id INTO v_firm_evergreen;

  -- ---------------------------------------------------------------------------
  -- 4. Seed Firm Template Items
  -- ---------------------------------------------------------------------------
  INSERT INTO public.firm_template_items (firm_id, document_type_id, is_required)
  VALUES
    (v_firm_apex, v_dt_sales, true),
    (v_firm_apex, v_dt_purchase, true),
    (v_firm_apex, v_dt_bank, true),
    (v_firm_apex, v_dt_gstr3b, true),
    (v_firm_apex, v_dt_expense, true),
    (v_firm_bharat, v_dt_sales, true),
    (v_firm_bharat, v_dt_purchase, true),
    (v_firm_bharat, v_dt_bank, true),
    (v_firm_bharat, v_dt_gstr3b, true),
    (v_firm_bharat, v_dt_expense, true)
  ON CONFLICT (firm_id, document_type_id) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 5. Seed Cases & Scenarios for Current Month
  -- ---------------------------------------------------------------------------

  -- SCENARIO A: Apex Logistics - Cycle A_11th
  -- 5 required received, all 5 dispatched -> Status: Completed
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_apex, v_current_month, 'A_11th', (v_current_month + INTERVAL '10 days')::date, v_admin_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date
  RETURNING id INTO v_case_a;

  DELETE FROM public.case_documents WHERE case_id = v_case_a;
  v_cd_ids := ARRAY[]::uuid[];
  FOR v_dt_sales IN SELECT id FROM public.document_types ORDER BY name LOOP
    INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
    VALUES (v_case_a, v_dt_sales, true, now() - INTERVAL '3 days', v_admin_id)
    RETURNING id INTO v_cd_id;
    v_cd_ids := array_append(v_cd_ids, v_cd_id);
  END LOOP;

  INSERT INTO public.dispatches (case_id, recipient, sent_at, recorded_by, email_reference)
  VALUES (v_case_a, 'CA V. Sharma (sharma_ca@firm.fake)', now() - INTERVAL '1 day', v_admin_id, 'Monthly Filing Docket - Apex Logistics')
  RETURNING id INTO v_disp_id;

  FOREACH v_cd_id IN ARRAY v_cd_ids LOOP
    INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
    VALUES (v_disp_id, v_cd_id, true);
  END LOOP;

  -- SCENARIO B: Bharat Engineering - Cycle B_20th
  -- 5 required received, 4 dispatched -> Status: Pending Dispatch (1 undispatched)
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_bharat, v_current_month, 'B_20th', (v_current_month + INTERVAL '19 days')::date, v_admin_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date
  RETURNING id INTO v_case_b;

  DELETE FROM public.case_documents WHERE case_id = v_case_b;
  v_cd_ids := ARRAY[]::uuid[];
  FOR v_dt_sales IN SELECT id FROM public.document_types ORDER BY name LOOP
    INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
    VALUES (v_case_b, v_dt_sales, true, now() - INTERVAL '2 days', v_admin_id)
    RETURNING id INTO v_cd_id;
    v_cd_ids := array_append(v_cd_ids, v_cd_id);
  END LOOP;

  INSERT INTO public.dispatches (case_id, recipient, sent_at, recorded_by, email_reference)
  VALUES (v_case_b, 'Audit Cell (audit@taxconsult.fake)', now() - INTERVAL '12 hours', v_admin_id, 'Partial Return Docket - Bharat Eng')
  RETURNING id INTO v_disp_id;

  -- Dispatch only first 4 documents (leave 5th undispatched)
  FOR i IN 1..4 LOOP
    INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
    VALUES (v_disp_id, v_cd_ids[i], true);
  END LOOP;

  -- SCENARIO C: Cauvery Textiles - Cycle A_11th
  -- 5 required, 3 received, 2 missing -> Status: Awaiting Documents
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_cauvery, v_current_month, 'A_11th', (v_current_month + INTERVAL '10 days')::date, v_admin_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date
  RETURNING id INTO v_case_c;

  DELETE FROM public.case_documents WHERE case_id = v_case_c;
  v_cd_ids := ARRAY[]::uuid[];
  FOR v_dt_sales IN SELECT id FROM public.document_types ORDER BY name LOOP
    v_cd_ids := array_append(v_cd_ids, v_dt_sales);
  END LOOP;

  -- 3 received
  FOR i IN 1..3 LOOP
    INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
    VALUES (v_case_c, v_cd_ids[i], true, now() - INTERVAL '1 day', v_admin_id);
  END LOOP;
  -- 2 not received
  FOR i IN 4..5 LOOP
    INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
    VALUES (v_case_c, v_cd_ids[i], true, NULL, NULL);
  END LOOP;

  -- SCENARIO D: Doon Valley Agro - Cycle B_20th
  -- 5 required received, dispatched in two separate batches -> Status: Completed (2 dispatches)
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_doon, v_current_month, 'B_20th', (v_current_month + INTERVAL '19 days')::date, v_admin_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date
  RETURNING id INTO v_case_d;

  DELETE FROM public.case_documents WHERE case_id = v_case_d;
  v_cd_ids := ARRAY[]::uuid[];
  FOR v_dt_sales IN SELECT id FROM public.document_types ORDER BY name LOOP
    INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
    VALUES (v_case_d, v_dt_sales, true, now() - INTERVAL '4 days', v_admin_id)
    RETURNING id INTO v_cd_id;
    v_cd_ids := array_append(v_cd_ids, v_cd_id);
  END LOOP;

  -- Batch 1: first 3 documents
  INSERT INTO public.dispatches (case_id, recipient, sent_at, recorded_by, email_reference)
  VALUES (v_case_d, 'Accounts Reviewer (tax@doonagro.fake)', now() - INTERVAL '2 days', v_admin_id, 'Batch 1: Sales & Purchases')
  RETURNING id INTO v_disp_id;
  FOR i IN 1..3 LOOP
    INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
    VALUES (v_disp_id, v_cd_ids[i], true);
  END LOOP;

  -- Batch 2: remaining 2 documents
  INSERT INTO public.dispatches (case_id, recipient, sent_at, recorded_by, email_reference)
  VALUES (v_case_d, 'Accounts Reviewer (tax@doonagro.fake)', now() - INTERVAL '1 day', v_admin_id, 'Batch 2: Bank & Summary')
  RETURNING id INTO v_disp_id;
  FOR i IN 4..5 LOOP
    INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
    VALUES (v_disp_id, v_cd_ids[i], true);
  END LOOP;

  -- SCENARIO E: Apex Logistics - Cycle B_20th
  -- 5 required received, 0 dispatched -> Status: Pending Dispatch
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_apex, v_current_month, 'B_20th', (v_current_month + INTERVAL '19 days')::date, v_admin_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date
  RETURNING id INTO v_case_e;

  DELETE FROM public.case_documents WHERE case_id = v_case_e;
  FOR v_dt_sales IN SELECT id FROM public.document_types ORDER BY name LOOP
    INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
    VALUES (v_case_e, v_dt_sales, true, now() - INTERVAL '1 day', v_admin_id);
  END LOOP;

  -- SCENARIO F: Bharat Engineering - Cycle A_11th
  -- 4 required received & dispatched + 1 optional missing -> Status: Completed
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_bharat, v_current_month, 'A_11th', (v_current_month + INTERVAL '10 days')::date, v_admin_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date
  RETURNING id INTO v_case_f;

  DELETE FROM public.case_documents WHERE case_id = v_case_f;
  v_cd_ids := ARRAY[]::uuid[];
  -- 4 required documents (received and dispatched)
  FOR v_dt_sales IN SELECT id FROM public.document_types WHERE name <> 'Expense Vouchers' ORDER BY name LOOP
    INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
    VALUES (v_case_f, v_dt_sales, true, now() - INTERVAL '2 days', v_admin_id)
    RETURNING id INTO v_cd_id;
    v_cd_ids := array_append(v_cd_ids, v_cd_id);
  END LOOP;

  -- 1 optional document (NOT received)
  INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
  VALUES (v_case_f, v_dt_expense, false, NULL, NULL);

  INSERT INTO public.dispatches (case_id, recipient, sent_at, recorded_by, email_reference)
  VALUES (v_case_f, 'External CA (ca.patel@auditors.fake)', now() - INTERVAL '1 day', v_admin_id, 'Cycle A Complete Dossier')
  RETURNING id INTO v_disp_id;

  FOREACH v_cd_id IN ARRAY v_cd_ids LOOP
    INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
    VALUES (v_disp_id, v_cd_id, true);
  END LOOP;

  -- SCENARIO G: Cauvery Textiles - Cycle B_20th
  -- 0 required documents -> Status: No Required Documents (never Completed)
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_cauvery, v_current_month, 'B_20th', (v_current_month + INTERVAL '19 days')::date, v_admin_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date
  RETURNING id INTO v_case_g;

  DELETE FROM public.case_documents WHERE case_id = v_case_g;
  -- Do not add any documents to case_g

  -- SCENARIO H: Evergreen Solar (Archived Firm: is_active = false)
  -- Open case for an archived firm -> Status: Awaiting Documents, firm_is_active = false
  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_evergreen, v_current_month, 'A_11th', (v_current_month + INTERVAL '10 days')::date, v_admin_id)
  ON CONFLICT (firm_id, period_month, cycle) DO UPDATE SET due_date = EXCLUDED.due_date
  RETURNING id INTO v_case_h;

  DELETE FROM public.case_documents WHERE case_id = v_case_h;
  FOR v_dt_sales IN SELECT id FROM public.document_types ORDER BY name LOOP
    INSERT INTO public.case_documents (case_id, document_type_id, is_required, received_at, received_by)
    VALUES (v_case_h, v_dt_sales, true, NULL, NULL);
  END LOOP;

  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'SEED DATA APPLIED SUCCESSFULLY:';
  RAISE NOTICE '  - Case A (Apex - A_11th): Completed (5 required, all dispatched)';
  RAISE NOTICE '  - Case B (Bharat - B_20th): Pending Dispatch (5 received, 4 dispatched)';
  RAISE NOTICE '  - Case C (Cauvery - A_11th): Awaiting Documents (3 received, 2 missing)';
  RAISE NOTICE '  - Case D (Doon - B_20th): Completed (5 received, 2 separate dispatches)';
  RAISE NOTICE '  - Case E (Apex - B_20th): Pending Dispatch (5 received, 0 dispatched)';
  RAISE NOTICE '  - Case F (Bharat - A_11th): Completed (4 required sent, 1 optional missing)';
  RAISE NOTICE '  - Case G (Cauvery - B_20th): No Required Documents (0 docs)';
  RAISE NOTICE '  - Case H (Evergreen - A_11th): Archived firm (firm_is_active = false)';
  RAISE NOTICE '=============================================================================';
END $$;
