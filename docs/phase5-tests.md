# FinanceFlow — Phase 5 Verification & Test Guide

> **Phase 5:** Outward Dispatch Management  
> **Testing Scope:** Database Migration 7 (`supabase/migrations/20261019000007_phase5_dispatch_management.sql`) automated SQL assertions and End-to-End Manual UI test cases.

---

## 1. Automated Database Verification Script (SQL Editor)

Run this entire block safely in your **Supabase Dashboard SQL Editor**. It executes inside a transaction and ends with `ROLLBACK`, guaranteeing zero permanent data modifications while validating all 8 business logic and integrity assertions.

```sql
-- =============================================================================
-- FINANCEFLOW PHASE 5 AUTOMATED VERIFICATION SUITE
-- Safe execution: executes inside BEGIN ... ROLLBACK
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_test_admin_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_test_staff_id uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;
  v_firm_id uuid;
  v_doc_type_1 uuid;
  v_doc_type_2 uuid;
  v_doc_type_3 uuid;
  v_case_id uuid;
  v_cd_1 uuid;
  v_cd_2 uuid;
  v_cd_3 uuid;
  v_disp_res1 jsonb;
  v_disp_res2 jsonb;
  v_disp_res_dup jsonb;
  v_disp_id_1 uuid;
  v_disp_id_2 uuid;
  v_count int;
  v_error_caught boolean;
  v_status text;
  v_idempotency_key text := 'test-key-' || gen_random_uuid()::text;
BEGIN
  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE 'Starting Phase 5 Database Integrity & Dispatch Test Suite...';
  RAISE NOTICE '------------------------------------------------------------';

  -- 1. Setup Mock Auth Users
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
  VALUES
    (v_test_admin_id, '00000000-0000-0000-0000-000000000000', 'dispatch_admin@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dispatch Admin"}', now(), now(), 'authenticated', 'authenticated'),
    (v_test_staff_id, '00000000-0000-0000-0000-000000000000', 'dispatch_staff@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dispatch Staff"}', now(), now(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Setup Profiles
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES
    (v_test_admin_id, 'Dispatch Admin', 'dispatch_admin@test.com', 'admin', true),
    (v_test_staff_id, 'Dispatch Staff', 'dispatch_staff@test.com', 'staff', true)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- Impersonate Admin
  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);

  -- 3. Master Document Types
  INSERT INTO public.document_types (name, description, is_active)
  VALUES ('GSTR-3B Filing PDF', 'Sales return summary', true)
  RETURNING id INTO v_doc_type_1;

  INSERT INTO public.document_types (name, description, is_active)
  VALUES ('Bank Statement PDF', 'Primary current account statement', true)
  RETURNING id INTO v_doc_type_2;

  INSERT INTO public.document_types (name, description, is_active)
  VALUES ('Purchase Invoices Zip', 'Vendor expense documents', true)
  RETURNING id INTO v_doc_type_3;

  -- 4. Create Test Firm and Case
  INSERT INTO public.firms (name, default_employee, is_active)
  VALUES ('Omega Trading Co', v_test_staff_id, true)
  RETURNING id INTO v_firm_id;

  INSERT INTO public.cases (firm_id, period_month, cycle, due_date, assigned_to)
  VALUES (v_firm_id, '2026-10-01'::date, 'A_11th', '2026-10-11'::date, v_test_staff_id)
  RETURNING id INTO v_case_id;

  -- 3 documents on case: doc 1 & 2 required, doc 3 optional
  INSERT INTO public.case_documents (case_id, document_type_id, is_required)
  VALUES (v_case_id, v_doc_type_1, true) RETURNING id INTO v_cd_1;

  INSERT INTO public.case_documents (case_id, document_type_id, is_required)
  VALUES (v_case_id, v_doc_type_2, true) RETURNING id INTO v_cd_2;

  INSERT INTO public.case_documents (case_id, document_type_id, is_required)
  VALUES (v_case_id, v_doc_type_3, false) RETURNING id INTO v_cd_3;

  -- Receive documents 1 and 2
  PERFORM public.receive_document(v_cd_1);
  PERFORM public.receive_document(v_cd_2);
  -- Document 3 remains UNRECEIVED

  -- Case status should currently be 'Pending Dispatch'
  SELECT status INTO v_status FROM public.case_status WHERE case_id = v_case_id;
  IF v_status <> 'Pending Dispatch' THEN
    RAISE EXCEPTION 'SETUP FAILED: Expected Pending Dispatch, got %', v_status;
  END IF;

  -- ---------------------------------------------------------------------------
  -- TEST 1: Atomic create_dispatch() with Multiple Documents
  -- ---------------------------------------------------------------------------
  SELECT public.create_dispatch(
    p_case_id => v_case_id,
    p_recipient => 'Auditor M. K. Sharma & Co.',
    p_case_document_ids => ARRAY[v_cd_1],
    p_sent_at => now(),
    p_email_reference => 'Batch 1 - GSTR-3B for preliminary review',
    p_idempotency_key => v_idempotency_key
  ) INTO v_disp_res1;

  v_disp_id_1 := (v_disp_res1->>'dispatch_id')::uuid;
  IF v_disp_id_1 IS NULL OR (v_disp_res1->>'is_duplicate')::boolean IS TRUE THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Expected new dispatch, got %', v_disp_res1;
  END IF;

  -- Verify document 1 is marked Dispatched in status view
  SELECT status INTO v_status FROM public.case_document_status WHERE case_document_id = v_cd_1;
  IF v_status <> 'Dispatched' THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Document 1 status is %, expected Dispatched', v_status;
  END IF;
  RAISE NOTICE 'TEST 1 PASSED: create_dispatch() recorded successfully.';

  -- ---------------------------------------------------------------------------
  -- TEST 2: Idempotent Double-Submission Protection
  -- Re-calling create_dispatch with same idempotency key must return existing dispatch
  -- ---------------------------------------------------------------------------
  SELECT public.create_dispatch(
    p_case_id => v_case_id,
    p_recipient => 'Auditor M. K. Sharma & Co.',
    p_case_document_ids => ARRAY[v_cd_1],
    p_sent_at => now(),
    p_email_reference => 'Batch 1 duplicate attempt',
    p_idempotency_key => v_idempotency_key
  ) INTO v_disp_res_dup;

  IF (v_disp_res_dup->>'dispatch_id')::uuid <> v_disp_id_1 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Idempotency returned different dispatch ID.';
  END IF;
  IF (v_disp_res_dup->>'is_duplicate')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Expected is_duplicate to be true.';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.dispatches WHERE idempotency_key = v_idempotency_key;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Duplicate dispatch record created in DB! (count=%)', v_count;
  END IF;
  RAISE NOTICE 'TEST 2 PASSED: Idempotency check returned existing record without duplicating.';

  -- ---------------------------------------------------------------------------
  -- TEST 3: Multiple Dispatches Preserved & Status Progression to Completed
  -- Dispatching second required document in Batch 2
  -- ---------------------------------------------------------------------------
  SELECT public.create_dispatch(
    p_case_id => v_case_id,
    p_recipient => 'Auditor M. K. Sharma & Co.',
    p_case_document_ids => ARRAY[v_cd_2],
    p_sent_at => now(),
    p_email_reference => 'Batch 2 - Bank statement final'
  ) INTO v_disp_res2;

  v_disp_id_2 := (v_disp_res2->>'dispatch_id')::uuid;

  SELECT COUNT(*) INTO v_count FROM public.dispatches WHERE case_id = v_case_id;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Expected 2 dispatches for case, found %', v_count;
  END IF;

  -- Both required documents are dispatched -> Case status must be Completed!
  SELECT status INTO v_status FROM public.case_status WHERE case_id = v_case_id;
  IF v_status <> 'Completed' THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Expected case status Completed, got %', v_status;
  END IF;
  RAISE NOTICE 'TEST 3 PASSED: Multiple batches preserved; Case transitioned to Completed.';

  -- ---------------------------------------------------------------------------
  -- TEST 4: Dispatching Un-Received Document Rejected
  -- Document 3 was never received -> must fail
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    PERFORM public.create_dispatch(
      p_case_id => v_case_id,
      p_recipient => 'External Tax Assessor',
      p_case_document_ids => ARRAY[v_cd_3]
    );
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Dispatching un-received document did not raise error!';
  END IF;
  RAISE NOTICE 'TEST 4 PASSED: Un-received document dispatch safely rejected.';

  -- ---------------------------------------------------------------------------
  -- TEST 5: Active Dispatch Locking (Same document in two active dispatches rejected)
  -- Document 1 is in active dispatch 1 -> cannot be dispatched again
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    PERFORM public.create_dispatch(
      p_case_id => v_case_id,
      p_recipient => 'Second Auditor',
      p_case_document_ids => ARRAY[v_cd_1]
    );
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Allowed document to be added to second active dispatch!';
  END IF;
  RAISE NOTICE 'TEST 5 PASSED: Active dispatch lock prevented double-dispatch of document 1.';

  -- ---------------------------------------------------------------------------
  -- TEST 6: Future sent_at Timestamp Rejected
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    PERFORM public.create_dispatch(
      p_case_id => v_case_id,
      p_recipient => 'Future CA',
      p_case_document_ids => ARRAY[v_cd_2],
      p_sent_at => now() + interval '10 days'
    );
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Future sent_at timestamp was accepted!';
  END IF;
  RAISE NOTICE 'TEST 6 PASSED: Future sent_at timestamp safely rejected.';

  -- ---------------------------------------------------------------------------
  -- TEST 7: Staff Role Blocked from void_dispatch()
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_test_staff_id::text, true);

  v_error_caught := false;
  BEGIN
    PERFORM public.void_dispatch(v_disp_id_2, 'Staff attempting voiding');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 7 FAILED: Staff was able to call void_dispatch()!';
  END IF;
  RAISE NOTICE 'TEST 7 PASSED: Non-admin staff blocked from voiding dispatches.';

  -- ---------------------------------------------------------------------------
  -- TEST 8: Admin void_dispatch() Reverts Status & Preserves Audit History
  -- ---------------------------------------------------------------------------
  -- Switch back to Admin
  PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);

  PERFORM public.void_dispatch(v_disp_id_2, 'Auditor requested revised bank statement format');

  -- Verify dispatch 2 is marked voided in DB (not deleted)
  SELECT COUNT(*) INTO v_count
  FROM public.dispatches
  WHERE id = v_disp_id_2 AND voided_at IS NOT NULL AND void_reason IS NOT NULL;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Dispatch was not properly marked as voided!';
  END IF;

  -- Verify document 2 returned to 'Received - Not Dispatched'
  SELECT status INTO v_status FROM public.case_document_status WHERE case_document_id = v_cd_2;
  IF v_status <> 'Received - Not Dispatched' THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Document 2 status is %, expected Received - Not Dispatched', v_status;
  END IF;

  -- Verify Case status reverted from Completed to 'Pending Dispatch'
  SELECT status INTO v_status FROM public.case_status WHERE case_id = v_case_id;
  IF v_status <> 'Pending Dispatch' THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Case status is %, expected Pending Dispatch', v_status;
  END IF;
  RAISE NOTICE 'TEST 8 PASSED: Voiding correctly reverted document and case status while preserving history.';

  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE 'ALL 8 PHASE 5 DATABASE VERIFICATION TESTS PASSED SUCCESSFULLY!';
  RAISE NOTICE '------------------------------------------------------------';
END $$;

ROLLBACK;
```

---

## 2. End-to-End Manual UI Testing Guide

### Test A: Record Dispatch Modal on `/cases/[id]`
1. Navigate to `/cases` and open any case with received documents (e.g., status **Pending Dispatch**).
2. Verify the top toolbar displays:
   - `Record Dispatch`
   - `Dispatch All Received (N)` shortcut button if there are undispatched received documents.
3. Click `Dispatch All Received`.
4. Observe the **Record Outward Dispatch** modal:
   - All received undispatched documents are preselected.
   - Recipient input has autocomplete suggestions from previous dispatches.
   - Sent Date & Time defaults to current time in Asia/Kolkata (IST).
   - Enter recipient: `M. K. Sharma & Associates`.
   - Enter email reference: `FY25-26 Q3 GST Filing submission`.
5. Click **Confirm Outward Dispatch**:
   - The button enters a loading state (`Recording Dispatch...`) and inputs are disabled.
   - Upon completion, the modal closes.
   - Status of the dispatched documents updates to **DISPATCHED** (purple badge).
   - The document row displays `Locked in Dispatch`.

### Test B: Dispatch History & Active Dispatch Locking
1. Scroll down to the **Outward Dispatch History** section on the case page.
2. Confirm the new dispatch appears with:
   - Sent date/time formatted in IST (`DD Mon YYYY, HH:MM AM/PM`).
   - Recipient name and email reference.
   - Included documents chips/tags.
   - Recorded by employee name.
   - Green `ACTIVE DISPATCH` badge.
3. Open the `Record Dispatch` dialog again.
4. Verify that already-dispatched documents **do not appear** in the selectable list.

### Test C: Admin Void Dispatch Flow
1. In the **Outward Dispatch History** section, click the **Void Dispatch** button on an active dispatch (visible to admins only).
2. The **Void Outward Dispatch** dialog opens.
3. Try submitting with an empty reason:
   - Form validation blocks submission and requires a minimum 5-character reason.
4. Enter reason: `Auditor requested revised schedule with bank reconciliation adjustments`.
5. Click **Confirm Void Dispatch**:
   - Loading indicator appears.
   - Upon completion, the dispatch entry updates to show a prominent **VOIDED** badge (rose color) with the void reason, timestamp, and administrator's name.
   - The documents previously in that dispatch immediately revert to **RECEIVED** (`Received - Not Dispatched`).
   - If the case was previously Completed, its status dynamically reverts to **Pending Dispatch**.

### Test D: Global Outward Dispatches Directory (`/dispatches`)
1. Click **Dispatches** in the sidebar navigation or navigate to `/dispatches`.
2. Verify the list displays outward transmissions across all firms and cases.
3. Test filters:
   - Filter by status: `Active Only` vs `Voided Only`.
   - Filter by firm: select a firm and observe filtered records.
   - Filter by recipient: type or select a recipient.
   - Date range filter: set From / To dates.
   - Search bar: search by email reference or recipient name.
   - Click `Reset` to clear filters.
4. Test "View Case &rarr;" action link:
   - Verify it navigates directly to `/cases/[id]`.
5. Test admin inline Void button on active dispatches:
   - Opens the same confirmation modal and voids the dispatch.
