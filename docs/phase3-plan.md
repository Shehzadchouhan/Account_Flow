# FinanceFlow — Phase 3 Plan: Firms, Document Types, Templates & User Admin

> **Status:** Draft / Proposed Plan. Awaiting user approval before Step 2 implementation.
> **Scope:** Phase 3 only: Firm directory, Firm creation/editing, Firm checklist template editor, Document types catalog management, User administration, Email backfill, and Last-admin protection.

---

## 1. Executive Summary & Business Context

In Phase 3, we build the administrative core of FinanceFlow:
1. **Client Firms Directory (`/firms`, `/firms/new`, `/firms/[id]`):** Searchable, filterable client business registry with contact persons and assigned default staff members. Soft archive/restore capabilities instead of hard delete.
2. **Firm Template Editor (`/firms/[id]`):** Checklist configuration defining which document types a firm requires each month, with explicit notice that changes apply only to **future** generated cases.
3. **Document Types Catalog (`/admin/document-types`):** Master document dictionary (Sales Register, Purchase Register, etc.) with rename and activate/deactivate controls (never hard deleted).
4. **User Administration (`/admin/users`):** Admin portal for activating staff accounts and managing roles (`admin` vs `staff`), protected by a database trigger preventing deactivation/demotion of the last active administrator.
5. **Database Enhancements (Migration 5):**
   - Add `email` column to `public.profiles`.
   - Update auth signup trigger to populate `profiles.email` automatically.
   - Backfill existing users' email from `auth.users`.
   - Enforce database trigger blocking deactivation or demotion of the last active admin.
   - Database triggers for audit logging on administrative mutations.

---

## 2. Database Changes (Migration 5: `20261019000005_profiles_email_and_admin_guard.sql`)

As required, database modifications are isolated to a brand new migration file.

### 2.1. Add `profiles.email` & Backfill
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
```

### 2.2. Update Auth Signup Trigger
Updates `trg_handle_new_auth_user` to persist `email` on signup:
```sql
CREATE OR REPLACE FUNCTION public.trg_handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'staff',
    false
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;
```

### 2.3. Last-Admin Protection Trigger
Prevents the system from entering an orphaned state where zero active administrators exist:
```sql
CREATE OR REPLACE FUNCTION public.trg_protect_last_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining_admins int;
BEGIN
  -- If updating an active admin to inactive, or changing role away from 'admin', or deleting
  IF (TG_OP = 'DELETE' AND OLD.role = 'admin' AND OLD.is_active = true) OR
     (TG_OP = 'UPDATE' AND OLD.role = 'admin' AND OLD.is_active = true AND
      (NEW.role <> 'admin' OR NEW.is_active = false)) THEN

    SELECT COUNT(*) INTO v_remaining_admins
    FROM public.profiles
    WHERE role = 'admin' AND is_active = true AND id <> OLD.id;

    IF v_remaining_admins = 0 THEN
      RAISE EXCEPTION 'Operation prohibited: Cannot deactivate or demote the last remaining active administrator.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_last_admin_guard ON public.profiles;
CREATE TRIGGER trg_profiles_last_admin_guard
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_protect_last_admin();
```

### 2.4. Audit Logging Triggers on Administrative Tables
Triggers on `firms`, `document_types`, `firm_template_items`, and `profiles` to automatically append audit records into `activity_logs`:
* `trg_log_firm_activity`: Logs `CREATE_FIRM`, `UPDATE_FIRM`, `ARCHIVE_FIRM`, `RESTORE_FIRM`.
* `trg_log_document_type_activity`: Logs `CREATE_DOCUMENT_TYPE`, `UPDATE_DOCUMENT_TYPE`, `TOGGLE_DOCUMENT_TYPE_ACTIVE`.
* `trg_log_template_activity`: Logs `ADD_TEMPLATE_ITEM`, `UPDATE_TEMPLATE_ITEM`, `REMOVE_TEMPLATE_ITEM`.
* `trg_log_profile_activity`: Logs `UPDATE_PROFILE_ROLE`, `TOGGLE_USER_ACTIVE`.

---

## 3. Server Actions & Validation Architecture

All mutations are performed via Next.js Server Actions enforcing:
1. `await requireAdmin()` check at the server layer.
2. Input validation using `zod` with trimmed strings, length limits, and loose email/phone formats.
3. Friendly error messages for unique constraint violations (e.g., duplicate firm name code `23505`).
4. Path revalidation via `revalidatePath()`.

### 3.1. Zod Validation Schemas (`src/lib/validations/`)
* **`firmSchema`:**
  * `name`: string, min 2, max 200, trimmed.
  * `contact_person`: optional string, max 100, trimmed.
  * `contact_email`: optional string, email format, max 150.
  * `contact_phone`: optional string, max 25 (accepts standard Indian formats: `+91 ...`, 10 digits).
  * `default_employee`: optional uuid or empty string (coerced to null).
  * `is_active`: boolean (default true).
* **`documentTypeSchema`:**
  * `name`: string, min 2, max 150, trimmed.
  * `description`: optional string, max 500, trimmed.
  * `is_active`: boolean (default true).
* **`templateItemSchema`:**
  * `firm_id`: uuid.
  * `document_type_id`: uuid.
  * `is_required`: boolean.
* **`userProfileUpdateSchema`:**
  * `full_name`: string, min 2, max 100, trimmed.
  * `role`: enum (`admin` | `staff`).
  * `is_active`: boolean.

### 3.2. Server Action Modules
* **`src/app/(app)/firms/actions.ts`:**
  * `createFirmAction(prevState, formData)`
  * `updateFirmAction(firmId, prevState, formData)`
  * `toggleFirmActiveAction(firmId, isActive)`
  * `addTemplateItemAction(firmId, documentTypeId, isRequired)`
  * `updateTemplateItemAction(itemId, firmId, isRequired)`
  * `removeTemplateItemAction(itemId, firmId)`
* **`src/app/(app)/admin/document-types/actions.ts`:**
  * `createDocumentTypeAction(prevState, formData)`
  * `updateDocumentTypeAction(id, prevState, formData)`
  * `toggleDocumentTypeActiveAction(id, isActive)`
* **`src/app/(app)/admin/users/actions.ts`:**
  * `updateUserProfileAction(userId, prevState, formData)` (handles last-admin exception with user-friendly toast/error)

---

## 4. UI Architecture & Screen Specifications

### 4.1. Firms List (`/firms`)
* **Access:** All active users can view. Admin users see "Add Firm" button and row edit controls.
* **Header:** Title, total active/archived counts, "Add Client Firm" button (admin only).
* **Search & Filters:**
  * Server-side case-insensitive search (`LOWER(name) LIKE %search%`).
  * Status filter pills: `Active` (default), `Archived`, `All`.
  * Assigned Staff dropdown filter (`default_employee`).
* **Table Columns:**
  * Firm Name (links to `/firms/[id]`)
  * Primary Contact (person, email, phone)
  * Default Staff Assignee (badge)
  * Status badge (`ACTIVE` in emerald, `ARCHIVED` in slate/amber with text + color)
  * Actions (Edit, Archive/Restore)
* **Pagination:** 25 items per page (`?page=1`), with "Previous" and "Next" controls.
* **Empty State:** Distinct informative states for "No firms found matching your search" vs "No client firms registered yet".

### 4.2. Create & Edit Firm (`/firms/new` & `/firms/[id]`)
* **`/firms/new`:**
  * Guarded by `requireAdmin()`.
  * Clean form with explicit labels, autofocus, field descriptions, and loading indicator.
  * Shows friendly duplicate alert if firm name already exists.
* **`/firms/[id]`:**
  * Header showing firm name, status badge, and "Archive / Restore Firm" button (with confirmation modal/prompt).
  * Tab 1: **Firm Details** (editable by admin).
  * Tab 2: **Document Checklist Template**:
    * Prominent banner: *"Notice: Template adjustments configure the default checklist for FUTURE monthly cases. Existing generated cases remain unaltered."*
    * Table of configured document types with Required/Optional toggle and Remove button.
    * "Add Document Type to Template" selector showing unselected active document types.

### 4.3. Document Types Master (`/admin/document-types`)
* **Access:** Admin only (`requireAdmin()`).
* **Features:**
  * Create new document type with Name and Description.
  * Inline or modal rename/edit.
  * Activate / Deactivate switch (deactivated types cannot be added to new templates).
  * Clear notice that document types are **never hard deleted** to preserve historical compliance dockets.

### 4.4. User Administration (`/admin/users`)
* **Access:** Admin only (`requireAdmin()`).
* **Features:**
  * Lists all registered user profiles with `full_name`, `email`, `role`, and `is_active`.
  * Edit modal / panel allowing admins to:
    * Update `full_name`.
    * Change `role` between `Staff` and `Admin`.
    * Toggle `is_active` (activate new signups, deactivate former employees).
  * Protected by last-admin trigger: if an admin tries to deactivate or demote the last remaining active admin, displays a clear warning: *"Cannot deactivate or demote the only remaining active administrator."*
  * Notice: *"New users sign up or are invited via the Supabase Dashboard. Account approval and role assignment take place here."*

### 4.5. Admin Dashboard Navigation (`/admin`)
* Update placeholder `/admin` overview page with direct quick-action cards to:
  * **User Administration & Roles** (`/admin/users`)
  * **Document Types Catalog** (`/admin/document-types`)

---

## 5. Test Plan & Scenarios (`docs/phase3-tests.md`)

We will author `docs/phase3-tests.md` containing automated SQL test assertions and a manual UI checklist:

### 5.1. Database & Server Tests
1. **Server-Side Authorization:** Non-admin (staff) attempting to call firm creation or user role edit Server Actions is rejected with `Access denied`.
2. **Duplicate Firm Name Variants:** Inserting `"apex logistics pvt ltd"` when `"Apex Logistics Pvt Ltd"` exists throws a duplicate name exception handled with a friendly message.
3. **Last-Admin Protection:** Attempting to update the last active admin to `role = 'staff'` or `is_active = false` raises `Operation prohibited: Cannot deactivate or demote the last remaining active administrator.`
4. **Archived Firms Filter:** Confirm default `/firms` query filters `is_active = true` unless requested otherwise.
5. **Document Type in Use Protection:** Attempting hard deletion of a document type referenced by `firm_template_items` or `case_documents` is blocked by `ON DELETE RESTRICT`.

### 5.2. Manual UI Checklist
- Verify search query debounces or submits cleanly via server query parameters.
- Verify status badges always display explicit TEXT (`ACTIVE`, `ARCHIVED`) alongside color.
- Verify form labels and keyboard focus outlines.
- Verify mobile viewport layout on narrow widths ($\ge 44\text{px}$ touch targets).

---

## 6. Implementation Checklist (Step 2)

| Step | Component | Action |
|---|---|---|
| **1** | Dependency | Install `zod` (`npm install zod`). |
| **2** | Migration | Create `supabase/migrations/20261019000005_profiles_email_and_admin_guard.sql`. |
| **3** | Types | Update `src/types/database.types.ts` with `profiles.email`. |
| **4** | Validation | Create `src/lib/validations/` schemas. |
| **5** | Server Actions | Author Server Actions for firms, templates, document types, and users. |
| **6** | UI - Firms | Build `/firms`, `/firms/new`, and `/firms/[id]` with template editor. |
| **7** | UI - Document Types | Build `/admin/document-types` page and modal components. |
| **8** | UI - Users | Build `/admin/users` page and edit modal. |
| **9** | Admin Overview | Update `/admin` page with links to the new modules. |
| **10** | Testing Docs | Create `docs/phase3-tests.md` manual and automated test guide. |
| **11** | Verification | Run `npm run lint` and `npm run build`. |

---

## 7. Assumptions & Decisions for User Confirmation

1. **User Creation:** Users are created/invited via Supabase Dashboard (or auth signup), and admins manage their activation (`is_active`) and roles (`admin`/`staff`) inside `/admin/users`. No service-role key is used in client or Next.js code.
2. **Archive vs Delete:** Firms and Document Types are never hard-deleted; they are deactivated/archived (`is_active = false`).
3. **Template Scope Notice:** A prominent warning will be displayed on the firm checklist template editor explaining that changes affect future generated cases only.
4. **Input Sanitization:** Contact emails and phone numbers are validated loosely so international or non-standard Indian landline formats aren't rejected.

---

*End of Phase 3 Plan. Awaiting user approval to proceed to Step 2 (Implementation).*
