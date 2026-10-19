# FinanceFlow — Phase 4 Verification & Test Guide

> **Phase 4:** Case Generator, Case List, Document Checklist & Receipts  
> **Testing Scope:** Database Migration 6 (`supabase/migrations/20261019000006_phase4_case_functions.sql`) automated SQL assertions and End-to-End Manual UI test cases.

---

## 1. Automated Database Verification Script (SQL Editor)

Run this entire block safely in your **Supabase Dashboard SQL Editor**. It executes inside a transaction and ends with `ROLLBACK`, guaranteeing zero permanent data modifications while validating all 9 business logic assertions.

```sql
-- =============================================================================
-- FINANCEFLOW PHASE 4 AUTOMATED VERIFICATION SUITE
-- Safe execution: executes inside BEGIN ... ROLLBACK
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_test_admin_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_test_staff_id uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;
  v_firm_with_template uuid;
  v_firm_no_template uuid;
  v_doc_type_1 uuid;
  v_doc_type_2 uuid;
  v_gen_res jsonb;
  v_case_id uuid;
  v_case_doc_1 uuid;
  v_case_doc_2 uuid;
  v_disp_id uuid;
  v_disp_item_id uuid;
  v_count int;
  v_error_caught boolean;
  v_status text;
  v_ver_res jsonb;
BEGIN
  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE 'Starting Phase 4 Database Integrity & Function Test Suite...';
  RAISE NOTICE '------------------------------------------------------------';

  -- 1. Setup Mock Auth Users
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
  VALUES
    (v_test_admin_id, '00000000-0000-0000-0000-000000000000', 'lead_admin@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lead Admin"}', now(), now(), 'authenticated', 'authenticated'),
    (v_test_staff_id, '00000000-0000-0000-0000-000000000000', 'staff_user@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Staff Member"}', now(), now(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Setup Profiles
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES
    (v_test_admin_id, 'Lead Admin', 'lead_admin@test.com', 'admin', true),
    (v_test_staff_id, 'Staff Member', 'staff_user@test.com', 'staff', true)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- Impersonate Admin
  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);

  -- 3. Setup Test Firms and Master Document Types
  INSERT INTO public.document_types (name, description, is_active)
  VALUES ('GSTR-1 Monthly Summary', 'Sales outward report', true)
  RETURNING id INTO v_doc_type_1;

  INSERT INTO public.document_types (name, description, is_active)
  VALUES ('Bank Statement PDF', 'Primary current account statement', true)
  RETURNING id INTO v_doc_type_2;

  -- Firm 1: Active with template
  INSERT INTO public.firms (name, default_employee, is_active)
  VALUES ('Alpha Enterprises Pvt Ltd', v_test_staff_id, true)
  RETURNING id INTO v_firm_with_template;

  INSERT INTO public.firm_template_items (firm_id, document_type_id, is_required)
  VALUES
    (v_firm_with_template, v_doc_type_1, true),
    (v_firm_with_template, v_doc_type_2, true);

  -- Firm 2: Active without template
  INSERT INTO public.firms (name, default_employee, is_active)
  VALUES ('Beta Solitary Traders', v_test_staff_id, true)
  RETURNING id INTO v_firm_no_template;

  -- ---------------------------------------------------------------------------
  -- TEST 1: Dry Run Zero-Mutation Guarantee
  -- ---------------------------------------------------------------------------
  SELECT public.generate_cases('2026-11-01'::date, 'A_11th', '2026-11-11'::date, true) INTO v_gen_res;

  SELECT COUNT(*) INTO v_count FROM public.cases WHERE period_month = '2026-11-01'::date;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Dry run inserted rows into public.cases!';
  END IF;

  IF (v_gen_res->>'created_count')::int < 1 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Dry run did not report expected eligible firm.';
  END IF;
  RAISE NOTICE 'TEST 1 PASSED: Dry run executed with zero database mutations.';

  -- ---------------------------------------------------------------------------
  -- TEST 2: Template-less Firm Reporting
  -- ---------------------------------------------------------------------------
  IF (v_gen_res->>'skipped_no_template_count')::int < 1 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Firm without template was not reported in skipped_no_template.';
  END IF;
  RAISE NOTICE 'TEST 2 PASSED: Active firm with zero template items correctly reported in skipped_no_template.';

  -- ---------------------------------------------------------------------------
  -- TEST 3: Execution & Template Copying
  -- ---------------------------------------------------------------------------
  SELECT public.generate_cases('2026-11-01'::date, 'A_11th', '2026-11-11'::date, false) INTO v_gen_res;

  SELECT id INTO v_case_id FROM public.cases
  WHERE firm_id = v_firm_with_template AND period_month = '2026-11-01'::date AND cycle = 'A_11th';

  IF v_case_id IS NULL THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Case was not created in non-dry-run execution.';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.case_documents WHERE case_id = v_case_id;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Expected 2 template documents copied to case, found %', v_count;
  END IF;
  RAISE NOTICE 'TEST 3 PASSED: Case created and template items copied into case_documents.';

  -- ---------------------------------------------------------------------------
  -- TEST 4: Generator Idempotency (Second Run Skips Existing)
  -- ---------------------------------------------------------------------------
  SELECT public.generate_cases('2026-11-01'::date, 'A_11th', '2026-11-11'::date, false) INTO v_gen_res;

  IF (v_gen_res->>'created_count')::int <> 0 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Second run created cases instead of skipping existing!';
  END IF;

  IF (v_gen_res->>'skipped_existing_count')::int < 1 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Existing case was not reported in skipped_existing.';
  END IF;
  RAISE NOTICE 'TEST 4 PASSED: Case generator is completely idempotent across repeated runs.';

  -- ---------------------------------------------------------------------------
  -- TEST 5: Document Receipt & Dynamic Status View
  -- ---------------------------------------------------------------------------
  -- Initial status should be 'Awaiting Documents'
  SELECT status INTO v_status FROM public.case_status WHERE case_id = v_case_id;
  IF v_status <> 'Awaiting Documents' THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Expected Awaiting Documents, got %', v_status;
  END IF;

  -- Fetch the two case documents
  SELECT id INTO v_case_doc_1 FROM public.case_documents WHERE case_id = v_case_id AND document_type_id = v_doc_type_1;
  SELECT id INTO v_case_doc_2 FROM public.case_documents WHERE case_id = v_case_id AND document_type_id = v_doc_type_2;

  -- Receive Doc 1
  PERFORM public.receive_document(v_case_doc_1);
  -- Receive Doc 2
  PERFORM public.receive_document(v_case_doc_2);

  -- Status should now automatically calculate to 'Pending Dispatch'
  SELECT status INTO v_status FROM public.case_status WHERE case_id = v_case_id;
  IF v_status <> 'Pending Dispatch' THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Expected Pending Dispatch after receiving all, got %', v_status;
  END IF;
  RAISE NOTICE 'TEST 5 PASSED: Document receipt dynamically updated case_status to Pending Dispatch.';

  -- ---------------------------------------------------------------------------
  -- TEST 6: Active Dispatch Guard on unreceive_document()
  -- ---------------------------------------------------------------------------
  -- Record a mock dispatch referencing Doc 1
  INSERT INTO public.dispatches (case_id, recipient, recorded_by)
  VALUES (v_case_id, 'Auditor Verma & Co', v_test_admin_id)
  RETURNING id INTO v_disp_id;

  INSERT INTO public.dispatch_items (dispatch_id, case_document_id, is_active)
  VALUES (v_disp_id, v_case_doc_1, true)
  RETURNING id INTO v_disp_item_id;

  -- Attempt un-receiving Doc 1 must be blocked
  v_error_caught := false;
  BEGIN
    PERFORM public.unreceive_document(v_case_doc_1);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    RAISE NOTICE 'Caught expected dispatch guard: %', SQLERRM;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Un-receiving a dispatched document was unexpectedly permitted!';
  END IF;
  RAISE NOTICE 'TEST 6 PASSED: Active dispatch guard prohibited un-receiving dispatched document.';

  -- ---------------------------------------------------------------------------
  -- TEST 7: Dynamic Status Recalculation on Document Addition
  -- ---------------------------------------------------------------------------
  -- Add a new required document to this case (which was otherwise ready for dispatch)
  INSERT INTO public.document_types (name, description, is_active)
  VALUES ('Purchase Ledger Excel', 'Vendor purchases', true)
  RETURNING id INTO v_doc_type_1;

  PERFORM public.add_case_document(v_case_id, v_doc_type_1, true);

  -- Status must immediately revert to 'Awaiting Documents'
  SELECT status INTO v_status FROM public.case_status WHERE case_id = v_case_id;
  IF v_status <> 'Awaiting Documents' THEN
    RAISE EXCEPTION 'TEST 7 FAILED: Adding required document did not revert status to Awaiting Documents! Got %', v_status;
  END IF;
  RAISE NOTICE 'TEST 7 PASSED: Adding required document dynamically reverted case status to Awaiting Documents.';

  -- ---------------------------------------------------------------------------
  -- TEST 8: Optimistic Locking on Case Details
  -- ---------------------------------------------------------------------------
  -- Case is version 1
  SELECT public.update_case_details(v_case_id, '2026-11-15'::date, v_test_admin_id, 1) INTO v_ver_res;
  IF (v_ver_res->>'new_version')::int <> 2 THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Expected new version 2, got %', v_ver_res->>'new_version';
  END IF;

  -- Attempting update with stale version 1 must throw concurrency conflict
  v_error_caught := false;
  BEGIN
    PERFORM public.update_case_details(v_case_id, '2026-11-18'::date, v_test_admin_id, 1);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    RAISE NOTICE 'Caught expected concurrency conflict: %', SQLERRM;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Update with stale version was permitted!';
  END IF;
  RAISE NOTICE 'TEST 8 PASSED: Optimistic concurrency locking strictly prevented stale write.';

  -- ---------------------------------------------------------------------------
  -- TEST 9: Staff Authorization Rejection
  -- ---------------------------------------------------------------------------
  -- Impersonate Staff member
  PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.generate_cases('2026-12-01'::date, 'A_11th', '2026-12-11'::date, false);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 9 FAILED: Non-admin staff was permitted to generate cases!';
  END IF;
  RAISE NOTICE 'TEST 9 PASSED: Non-admin staff blocked from administrative case generator.';

  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE 'ALL PHASE 4 DATABASE & FUNCTION ASSERTIONS PASSED!';
  RAISE NOTICE '------------------------------------------------------------';
END;
$$;

ROLLBACK;
```

---

## 2. End-to-End Manual UI Verification Checklist

### 2.1. Case Generator Portal (`/admin/generate-cases`)
- [ ] **Access Guard:** Sign in as standard staff. Try opening `/admin/generate-cases`. Confirm redirected to `/` by `requireAdmin()`.
- [ ] **Default Parameters:** As admin, open `/admin/generate-cases`. Confirm month defaults to current month in `Asia/Kolkata` and Cycle defaults to `Cycle A (11th)`.
- [ ] **Step 1 Dry Run:** Click **"Preview Generation (Dry Run)"**. Confirm zero cases are created in the database, and preview cards render:
  - *Eligible to Create*
  * *Skipped (Already Exists)*
  * *Skipped (No Template)* with direct links to configure firm templates.
- [ ] **Step 2 Confirmation:** Click **"Confirm & Generate Cases"**. Verify modal pops up summarizing the exact action. Click confirm and verify success celebration card displays with link to view generated cases.
- [ ] **Idempotent Re-run:** Re-run the generator with the exact same month and cycle. Confirm eligible count is 0 and all are reported in "Skipped (Already Exists)".

### 2.2. Case Directory (`/cases`)
- [ ] **Default Month:** Confirm the directory automatically selects the current calendar month in `Asia/Kolkata`.
- [ ] **Status Badges:** Confirm all badges render explicit **TEXT plus color** (`AWAITING DOCUMENTS`, `PENDING DISPATCH`, `COMPLETED`, `NO REQUIRED DOCUMENTS`).
- [ ] **Overdue Filter:** Check "Show Overdue Cases Only". Confirm only cases past their due date appear with the red `OVERDUE` pill.
- [ ] **Search by Firm:** Enter a firm name into search. Confirm case list filters dynamically.
- [ ] **Empty State:** Filter by a month with no cases. Confirm friendly empty state with action link to the Case Generator.

### 2.3. Case Details & Checklist (`/cases/[id]`)
- [ ] **Header Metrics:** Confirm required, received, dispatched, and missing counts match the checklist.
- [ ] **Single Receive:** Click "Mark Received" on an awaiting document. Confirm confirmation modal, and verify document status changes to `RECEIVED` while case missing count decrements.
- [ ] **Undo Receipt:** Click "Undo Receipt". Confirm confirmation modal, and verify document status reverts to `AWAITING RECEIPT`.
- [ ] **Single-Case Bulk Receive:** Select multiple checkboxes on awaiting documents. Confirm floating blue action bar displays `N documents selected`. Click "Mark Selected as Received", confirm the modal lists all selected document titles, and verify all are marked received simultaneously.
- [ ] **Active Dispatch Guard:** If a document is dispatched, confirm "Undo Receipt" and "Remove" are disabled or blocked with an informative alert: *"Cannot un-receive document: It is currently part of an active dispatch."*
- [ ] **Optimistic Locking:** Open the same case in two browser tabs. In Tab 1, change the due date and click "Save Changes". In Tab 2 (with the old version), try changing the assignee and saving. Confirm Tab 2 displays the concurrency warning:
  > *"Concurrency Conflict: This case was modified by another user. Please reload the page to see the latest changes."*
- [ ] **Add Document to Case (Admin only):** Add a document from the catalog to this case. Confirm it immediately appears in the checklist and recalculates case status.
