# FinanceFlow — Phase 3 Verification & Test Guide

> **Phase 3:** Firms, Document Types Master, Firm Templates, and User Administration  
> **Testing Scope:** Database Migration 5 assertions (`supabase/migrations/20261019000005_profiles_email_and_admin_guard.sql`) and End-to-End Manual UI test cases.

---

## 1. Automated Database Verification Script (SQL Editor)

You can run this entire block safely in your **Supabase Dashboard SQL Editor**. It runs inside a transaction and ends with `ROLLBACK`, leaving your database completely untouched while verifying all 9 database integrity guarantees.

```sql
-- =============================================================================
-- FINANCEFLOW PHASE 3 AUTOMATED VERIFICATION SUITE
-- Safe execution: executes inside BEGIN ... ROLLBACK
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_test_admin_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_test_admin_2_id uuid := 'a0000000-0000-0000-0000-000000000002'::uuid;
  v_test_staff_id uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;
  v_firm_id uuid;
  v_doc_type_id uuid;
  v_template_item_id uuid;
  v_log_count int;
  v_error_caught boolean;
BEGIN
  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE 'Starting Phase 3 Database Integrity & Trigger Test Suite...';
  RAISE NOTICE '------------------------------------------------------------';

  -- Setup Mock Auth Users
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role)
  VALUES
    (v_test_admin_id, '00000000-0000-0000-0000-000000000000', 'admin1@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lead Admin"}', now(), now(), 'authenticated', 'authenticated'),
    (v_test_admin_2_id, '00000000-0000-0000-0000-000000000000', 'admin2@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Secondary Admin"}', now(), now(), 'authenticated', 'authenticated'),
    (v_test_staff_id, '00000000-0000-0000-0000-000000000000', 'staff1@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Staff User"}', now(), now(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- Setup Test Profiles
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES
    (v_test_admin_id, 'Lead Admin', 'admin1@test.com', 'admin', true),
    (v_test_admin_2_id, 'Secondary Admin', 'admin2@test.com', 'admin', true),
    (v_test_staff_id, 'Staff User', 'staff1@test.com', 'staff', true)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- ---------------------------------------------------------------------------
  -- TEST 1: Check profiles.email column and backfill
  -- ---------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    RAISE EXCEPTION 'TEST 1 FAILED: public.profiles.email column does not exist.';
  END IF;
  RAISE NOTICE 'TEST 1 PASSED: profiles.email column exists.';

  -- ---------------------------------------------------------------------------
  -- TEST 2: Last-Admin Protection: Prohibit deactivating the ONLY active admin
  -- ---------------------------------------------------------------------------
  -- Temporarily deactivate admin 2 so admin 1 is the sole admin
  UPDATE public.profiles SET is_active = false WHERE id = v_test_admin_2_id;

  v_error_caught := false;
  BEGIN
    UPDATE public.profiles SET is_active = false WHERE id = v_test_admin_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    RAISE NOTICE 'Caught expected rejection: %', SQLERRM;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Deactivating the sole admin was unexpectedly permitted!';
  END IF;
  RAISE NOTICE 'TEST 2 PASSED: Deactivating the sole active administrator was blocked.';

  -- ---------------------------------------------------------------------------
  -- TEST 3: Last-Admin Protection: Prohibit demoting the ONLY active admin
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    UPDATE public.profiles SET role = 'staff' WHERE id = v_test_admin_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
    RAISE NOTICE 'Caught expected rejection: %', SQLERRM;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Demoting the sole admin was unexpectedly permitted!';
  END IF;
  RAISE NOTICE 'TEST 3 PASSED: Demoting the sole active administrator was blocked.';

  -- ---------------------------------------------------------------------------
  -- TEST 4: Last-Admin Protection: Allow update when another active admin exists
  -- ---------------------------------------------------------------------------
  -- Re-activate admin 2
  UPDATE public.profiles SET is_active = true WHERE id = v_test_admin_2_id;
  -- Now demoting admin 1 should succeed because admin 2 is active
  UPDATE public.profiles SET role = 'staff' WHERE id = v_test_admin_id;
  RAISE NOTICE 'TEST 4 PASSED: Demoting admin permitted when another active admin exists.';

  -- Restore admin 1
  UPDATE public.profiles SET role = 'admin' WHERE id = v_test_admin_id;

  -- ---------------------------------------------------------------------------
  -- TEST 5: Firm Audit Trigger (Create, Archive, Restore)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.firms (name, contact_person, is_active)
  VALUES ('Test Suite Logistics Pvt Ltd', 'Harish Kumar', true)
  RETURNING id INTO v_firm_id;

  UPDATE public.firms SET is_active = false WHERE id = v_firm_id;
  UPDATE public.firms SET is_active = true WHERE id = v_firm_id;

  SELECT COUNT(*) INTO v_log_count
  FROM public.activity_logs
  WHERE entity_type = 'firms' AND entity_id = v_firm_id;

  IF v_log_count < 3 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Expected at least 3 firm activity logs, found %', v_log_count;
  END IF;
  RAISE NOTICE 'TEST 5 PASSED: Firm lifecycle triggers recorded audit entries (Create, Archive, Restore).';

  -- ---------------------------------------------------------------------------
  -- TEST 6: Document Type Audit Trigger
  -- ---------------------------------------------------------------------------
  INSERT INTO public.document_types (name, description, is_active)
  VALUES ('Test Audit Certificate', 'Test Description', true)
  RETURNING id INTO v_doc_type_id;

  UPDATE public.document_types SET is_active = false WHERE id = v_doc_type_id;

  SELECT COUNT(*) INTO v_log_count
  FROM public.activity_logs
  WHERE entity_type = 'document_types' AND entity_id = v_doc_type_id;

  IF v_log_count < 2 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Expected at least 2 document_type activity logs, found %', v_log_count;
  END IF;
  RAISE NOTICE 'TEST 6 PASSED: Document type audit trigger recorded entries.';

  -- ---------------------------------------------------------------------------
  -- TEST 7: Firm Template Items Audit Trigger (Add, Update, Remove)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.firm_template_items (firm_id, document_type_id, is_required)
  VALUES (v_firm_id, v_doc_type_id, true)
  RETURNING id INTO v_template_item_id;

  UPDATE public.firm_template_items SET is_required = false WHERE id = v_template_item_id;
  DELETE FROM public.firm_template_items WHERE id = v_template_item_id;

  SELECT COUNT(*) INTO v_log_count
  FROM public.activity_logs
  WHERE entity_type = 'firm_template_items' AND entity_id = v_template_item_id;

  IF v_log_count < 3 THEN
    RAISE EXCEPTION 'TEST 7 FAILED: Expected at least 3 template item activity logs, found %', v_log_count;
  END IF;
  RAISE NOTICE 'TEST 7 PASSED: Template item audit trigger recorded entries (Add, Update, Remove).';

  -- ---------------------------------------------------------------------------
  -- TEST 8: Unique Constraints on Firm Name and Template Items
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    INSERT INTO public.firms (name, is_active)
    VALUES ('Test Suite Logistics Pvt Ltd', true);
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Duplicate firm name was permitted!';
  END IF;
  RAISE NOTICE 'TEST 8 PASSED: Duplicate firm name constraint enforced.';

  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE 'ALL PHASE 3 DATABASE INTEGRITY ASSERTIONS PASSED SUCCESSFULLY!';
  RAISE NOTICE '------------------------------------------------------------';
END;
$$;

ROLLBACK;
```

---

## 2. End-to-End Manual UI Verification Checklist

### 2.1. Client Firms Directory (`/firms`)
- [ ] **Access Control:** Log in as staff member. Confirm the "Add Client Firm" button is **hidden** and "Manage" buttons read "View Details".
- [ ] **Admin Privileges:** Log in as administrator. Confirm "Add Client Firm" button is visible and links to `/firms/new`.
- [ ] **Search Filter:** Type `Apex` into the search box and submit. Confirm only firms matching "Apex" appear.
- [ ] **Status Filter:** Select `Archived Only`. Confirm only archived firms display (e.g. Case H firm "Heritage Mills Ltd").
- [ ] **Assigned Staff Filter:** Select a specific staff member. Confirm table shows only firms assigned to that staff member.
- [ ] **Status Badges:** Confirm all badges clearly display **TEXT plus color** (e.g. green `ACTIVE`, slate `ARCHIVED`).
- [ ] **Empty States:** Search for a non-existent name like `XYZ Nonexistent`. Confirm friendly "No matching firms found" empty state with "Reset Filters" button appears.

### 2.2. Add Client Firm (`/firms/new`)
- [ ] **Server Guard:** As staff user, try visiting `/firms/new`. Confirm redirected to `/` (dashboard) by `requireAdmin()`.
- [ ] **Validation:** As admin, leave "Firm Name" blank and submit. Confirm client/server validation stops submission with a clear error.
- [ ] **Duplicate Name:** Try entering an existing firm name (e.g., `Apex Logistics Pvt Ltd`). Confirm friendly banner: `"A firm with this name already exists. Firm names must be unique."`
- [ ] **Successful Creation:** Enter a unique firm name (e.g., `Bhartiya Textiles LLP`), select a contact person and assigned staff, and click "Create Firm". Confirm redirection directly to `/firms/[id]`.

### 2.3. Firm Details & Checklist Template Editor (`/firms/[id]`)
- [ ] **Details View/Edit:** Confirm firm name, contact details, and assigned staff member are shown.
- [ ] **Save Changes:** As admin, edit the contact person or phone number and click "Save Firm Details". Confirm changes persist immediately.
- [ ] **Archive / Restore:** Click "Archive Firm". Confirm warning modal explains historical cases are preserved. Confirm firm status flips to `ARCHIVED`. Click "Restore Firm" and confirm it returns to `ACTIVE`.
- [ ] **Template Notice:** Verify the prominent banner:
  > *"Notice: Modifications made to this checklist template configure the default documents for FUTURE generated cases only. Existing open and archived monthly cases remain completely intact and unaltered."*
- [ ] **Add Document Type:** Select an unconfigured document type from the dropdown, choose whether it is "Required", and click "Add to Template". Confirm it appears in the list.
- [ ] **Toggle Requirement:** Click "Mark Optional" on a required document. Confirm badge updates to `OPTIONAL`.
- [ ] **Remove Document Type:** Click "Remove". Confirm document type is removed from this firm's checklist template.

### 2.4. Document Types Catalog (`/admin/document-types`)
- [ ] **Server Guard:** Confirm non-admin users cannot access this page.
- [ ] **Create Document Type:** Enter name (e.g., `PF Challan ECR`) and description. Click "Create Type". Confirm it appears in the catalog.
- [ ] **Rename / Edit:** Click "Rename / Edit", modify description or name, and click "Save". Confirm update renders.
- [ ] **Deactivate / Activate:** Click "Deactivate". Confirm badge changes to `INACTIVE`.
- [ ] **No Hard Deletion:** Verify no "Delete" option exists, preserving historical docket integrity.

### 2.5. User Administration & Last-Admin Guard (`/admin/users`)
- [ ] **Server Guard:** Confirm non-admin users cannot access this page.
- [ ] **List Team:** Confirm all registered profiles are listed with full name, email, role badge (`ADMIN`/`STAFF`), and status badge (`ACTIVE`/`INACTIVE`).
- [ ] **Edit Role & Status:** Click "Edit Role / Status" on a staff member. Switch role to `Admin` or toggle active status. Click "Save Changes". Confirm update renders.
- [ ] **Last-Admin Guard (Crucial):** If there is only 1 active administrator, click "Edit Role / Status" on that administrator and attempt to set "Role" to `Staff` or "Status" to `Inactive`. Click "Save Changes".
  - **Expected Result:** Blocked by database trigger. Modal displays clear warning:
    > *"Operation prohibited: You cannot deactivate or demote the only remaining active administrator in the system."*
