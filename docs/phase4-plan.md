# FinanceFlow — Phase 4 Plan: Case Generator, Case List, Checklist & Document Receipt

> **Status:** Draft / Proposed Plan. Awaiting user approval before Step 2 implementation.  
> **Scope:** Phase 4 only: Case generation engine (dry-run preview + execution), Case directory with Asia/Kolkata monthly filtering, Case checklist view, single-case bulk document receipt, document undo receipt with active dispatch guard, case document management (add/remove/requirement toggle), and optimistic locking.

---

## 1. Executive Summary & Business Scope

In Phase 4, we build the core operational engine of FinanceFlow:
1. **Case Generator (`/admin/generate-cases`):**
   - Admin-only engine that generates monthly compliance dockets for every active client firm that has at least one template document configured.
   - Idempotent: safe to run multiple times without duplicating cases (`UNIQUE (firm_id, period_month, cycle)`).
   - Two-step execution: **Dry-run preview first** showing what would be created/skipped, followed by an explicit **confirmation step**.
   - Assigns each case to the firm's `default_employee`.
   - Copies configured `firm_template_items` into `case_documents`.
2. **Case Directory (`/cases`):**
   - Filterable, searchable case overview across all client firms.
   - Defaults to the **current month in Asia/Kolkata timezone** (`date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata'))::date`).
   - Filters: Month, Cycle (`A_11th`, `B_20th`), Status, Assigned Employee, Firm, and Overdue Only toggle.
   - Status text and progress counts come **EXCLUSIVELY** from the real-time calculated view `case_status` (never manually set or stored).
3. **Case Checklist & Details (`/cases/[id]`):**
   - Comprehensive case header with firm name, period, cycle, editable due date, assignee, and live progress metrics.
   - Document checklist table using the real-time view `case_document_status`.
   - Single-case **bulk receive** with checkboxes and confirmation modal listing selected documents.
   - **Receive** and **Undo Receive** controls with audit logging.
   - **Active Dispatch Guard:** Blocks un-receiving or removing any document that is part of an active dispatch.
   - Admin-only controls: Edit due date and assignee (with optimistic locking), add/remove documents, and toggle document requirement rule (`REQUIRED` vs `OPTIONAL`).
   - Adding or removing required documents immediately and automatically recalculates the case's status.

---

## 2. Database Changes (Migration 6: `supabase/migrations/20261019000006_phase4_case_functions.sql`)

All database functions are authored as `SECURITY DEFINER` with safe `search_path = public, auth, pg_temp`, revoked from `anon` and `PUBLIC`, and granted to `authenticated`. Each function enforces internal authorization checks.

### 2.1. `generate_cases(p_month date, p_cycle text, p_due_date date, p_dry_run boolean)`
* **Access:** Administrator only (`public.is_admin()`).
* **Input Validation:**
  - `p_month` must equal `date_trunc('month', p_month)::date`.
  - `p_cycle` must be in `('A_11th', 'B_20th')`.
  - `p_due_date` must not be null.
* **Algorithm:**
  1. Identifies all active firms (`is_active = true`).
  2. For each firm:
     - Checks count of configured template items in `firm_template_items`. If 0, records in `skipped_no_template` list with firm ID and name.
     - Checks if a case already exists for `(firm_id, p_month, p_cycle)`. If yes, records in `skipped_existing` list with firm ID and name.
     - If active, has $\ge 1$ template items, and has no existing case:
       - Records in `created` list with firm ID, firm name, and default employee.
       - If `p_dry_run = false`:
         - Inserts into `public.cases (firm_id, period_month, cycle, due_date, assigned_to)` using `ON CONFLICT (firm_id, period_month, cycle) DO NOTHING` returning `id`.
         - Inserts into `public.case_documents (case_id, document_type_id, is_required)` by copying from `firm_template_items` for that firm.
  3. If `p_dry_run = false` and created count > 0:
     - Appends an audit entry to `public.activity_logs` (`action = 'GENERATE_CASES'`).
* **Return Value:** JSONB structure:
  ```json
  {
    "dry_run": true,
    "period_month": "2026-10-01",
    "cycle": "A_11th",
    "due_date": "2026-10-11",
    "created_count": 5,
    "skipped_existing_count": 2,
    "skipped_no_template_count": 1,
    "created_firms": [{"firm_id": "...", "firm_name": "...", "assigned_to": "..."}],
    "skipped_existing_firms": [{"firm_id": "...", "firm_name": "..."}],
    "skipped_no_template_firms": [{"firm_id": "...", "firm_name": "..."}]
  }
  ```

### 2.2. Document Receipt Functions
* **`receive_document(p_case_document_id uuid)`:**
  - Access: Active authenticated user (`public.is_active_user()`).
  - Ensures document exists, `removed_at IS NULL`, and `received_at IS NULL`.
  - Updates `case_documents SET received_at = now(), received_by = auth.uid(), updated_at = now()`.
  - Appends audit log: `action = 'RECEIVE_DOCUMENT'`.
* **`unreceive_document(p_case_document_id uuid)`:**
  - Access: Active authenticated user (`public.is_active_user()`).
  - Ensures document exists, `removed_at IS NULL`, and `received_at IS NOT NULL`.
  - **Active Dispatch Guard:** Checks `public.dispatch_items` joining active dispatches (`d.voided_at IS NULL AND di.is_active = true`). If found, raises exception:
    `'Cannot un-receive document: it is currently part of an active dispatch. Void the dispatch first.'`
  - Updates `case_documents SET received_at = NULL, received_by = NULL, updated_at = now()`.
  - Appends audit log: `action = 'UNRECEIVE_DOCUMENT'`.
* **`bulk_receive_documents(p_case_id uuid, p_case_document_ids uuid[])`:**
  - Access: Active authenticated user (`public.is_active_user()`).
  - **Single-Case Boundary:** Verifies that every document ID in `p_case_document_ids` belongs strictly to `p_case_id` and has `removed_at IS NULL`.
  - Updates all selected documents that are currently unreceived:
    `SET received_at = now(), received_by = auth.uid(), updated_at = now() WHERE id = ANY(p_case_document_ids) AND received_at IS NULL`.
  - Appends audit log: `action = 'BULK_RECEIVE_DOCUMENTS'`.

### 2.3. Case Document Management Functions (Admin Only)
* **`add_case_document(p_case_id uuid, p_document_type_id uuid, p_is_required boolean)`:**
  - Access: Administrator only (`public.is_admin()`).
  - Checks if an active unremoved document of that type already exists in the case (`case_documents_active_idx`). If so, raises friendly error.
  - Inserts new row into `case_documents`.
  - Appends audit log: `action = 'ADD_CASE_DOCUMENT'`.
* **`remove_case_document(p_case_document_id uuid)`:**
  - Access: Administrator only (`public.is_admin()`).
  - Soft-deletes the document via `removed_at = now()`.
  - **Active Dispatch Guard:** Blocks soft-deletion if document is part of an active dispatch item.
  - Appends audit log: `action = 'REMOVE_CASE_DOCUMENT'`.
* **`set_document_required(p_case_document_id uuid, p_is_required boolean)`:**
  - Access: Administrator only (`public.is_admin()`).
  - Updates `is_required` flag on `case_documents`.
  - Appends audit log: `action = 'SET_DOCUMENT_REQUIRED'`.
* **`update_case_document_notes(p_case_document_id uuid, p_notes text)`:**
  - Access: Active authenticated user (`public.is_active_user()`).
  - Updates `notes` and `updated_at` on `case_documents`.

### 2.4. Case Details & Optimistic Locking (`update_case_details`)
* **`update_case_details(p_case_id uuid, p_due_date date, p_assigned_to uuid, p_version integer)`:**
  - Access: Administrator only (`public.is_admin()`).
  - Enforces optimistic concurrency control:
    ```sql
    UPDATE public.cases
    SET due_date = p_due_date,
        assigned_to = p_assigned_to
    WHERE id = p_case_id AND version = p_version;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Concurrency conflict: This case was modified by another user. Please reload the page.';
    END IF;
    ```
  - Note: Trigger `trg_cases_optimistic_lock` automatically increments `version := version + 1`.
  - Appends audit log: `action = 'UPDATE_CASE_DETAILS'`.

---

## 3. Server Actions & Validation Architecture

All mutations are invoked via Next.js Server Actions with strict Zod validation, role authorization, and cache revalidation.

### 3.1. Validation Schemas (`src/lib/validations/case.ts`)
* **`generateCasesSchema`:**
  - `month`: string (YYYY-MM or YYYY-MM-01 format, coerced to first day of month).
  - `cycle`: enum (`'A_11th'` | `'B_20th'`).
  - `due_date`: string (ISO date `YYYY-MM-DD`).
  - `dry_run`: boolean (default true).
* **`updateCaseDetailsSchema`:**
  - `case_id`: uuid.
  - `due_date`: string (ISO date `YYYY-MM-DD`).
  - `assigned_to`: optional uuid or empty string (coerced to null).
  - `version`: integer min 1.
* **`addCaseDocumentSchema`:**
  - `case_id`: uuid.
  - `document_type_id`: uuid.
  - `is_required`: boolean.
* **`updateDocumentNotesSchema`:**
  - `case_document_id`: uuid.
  - `notes`: optional string (max 1000 chars, trimmed).

### 3.2. Server Action Modules
* **`src/app/(app)/cases/actions.ts`:**
  - `generateCasesAction(prevState, formData)`: Executes dry run or generation via `supabase.rpc('generate_cases', ...)`.
  - `receiveDocumentAction(caseDocumentId, caseId)`: Marks a single document received.
  - `unreceiveDocumentAction(caseDocumentId, caseId)`: Reverses receipt; catches active dispatch error.
  - `bulkReceiveDocumentsAction(caseId, documentIds)`: Marks multiple documents in a case received.
  - `updateCaseNotesAction(caseDocumentId, caseId, notes)`: Updates notes on a checklist item.
  - `updateCaseDetailsAction(prevState, formData)`: Updates due date and assignee with optimistic locking check.
  - `addCaseDocumentAction(caseId, documentTypeId, isRequired)`: Admin addition of document.
  - `removeCaseDocumentAction(caseDocumentId, caseId)`: Admin removal of document.
  - `setDocumentRequiredAction(caseDocumentId, caseId, isRequired)`: Admin toggle of required flag.

---

## 4. UI Architecture & Screen Specifications

### 4.1. Case Generator Portal (`/admin/generate-cases`)
* **Access:** Admin only (`await requireAdmin()`).
* **Default Values:**
  - Month: Current or upcoming calendar month in `Asia/Kolkata`.
  - Cycle: `A_11th` (Cycle A: Due 11th) or `B_20th` (Cycle B: Due 20th).
  - Due Date: Dynamically suggests the 11th or 20th of the selected month, but allows full manual date picking.
* **Workflow:**
  1. User selects parameters and clicks **"Preview Generation (Dry Run)"**.
  2. Server action executes with `p_dry_run = true` without modifying database state.
  3. UI displays a detailed Preview Summary card:
     - **To be created:** Green badge with count, list of firm names, and default assignees.
     - **Skipped — Already exists:** Slate badge with count and firm names.
     - **Skipped — No template:** Amber warning badge with count and firm names (with direct links to `/firms/[id]` to configure templates).
  4. Only after previewing does the **"Confirm & Generate Cases"** button become active.
  5. On confirmation, executes `p_dry_run = false`, shows success results, and offers a direct link: `"View Generated Cases in Directory &rarr;"`.

### 4.2. Case Directory (`/cases`)
* **Access:** All active users.
* **Data Source:** Directly queries `public.case_status` view.
* **Filters & Search Bar:**
  - **Month filter:** Defaults to current month in `Asia/Kolkata` (`YYYY-MM-01`). Dropdown includes past 12 months, next 3 months, and "All Months".
  - **Cycle filter:** `All Cycles`, `Cycle A (11th)`, `Cycle B (20th)`.
  - **Status filter:** `All Statuses`, `Awaiting Documents`, `Pending Dispatch`, `Completed`, `No Required Documents`.
  - **Assigned Staff filter:** Dropdown of active team members + "Unassigned".
  - **Firm filter:** Dropdown or quick filter.
  - **Overdue Only toggle:** Checkbox/pill filtering `is_overdue = true`.
  - **Search input:** Firm name search (case-insensitive `ILIKE`).
* **Table View:**
  - Firm Name (links to `/cases/[id]`).
  - Period Month & Cycle (e.g., `Oct 2026 • Cycle A (11th)`).
  - Due Date (prominently flagged in red/amber if overdue).
  - Assigned Staff member badge.
  - Progress ratio (`X/Y Documents Required`, `Z Dispatched`).
  - Status badge: TEXT plus color (`AWAITING DOCUMENTS`, `PENDING DISPATCH`, `COMPLETED`, `NO REQUIRED DOCUMENTS`).
  - Action: "Open Checklist &rarr;".
* **Pagination:** 25 items per page (`?page=1`).
* **Empty States:** Distinct states for "No cases found for [Month]" vs "No cases matching search criteria".

### 4.3. Case Details & Checklist (`/cases/[id]`)
* **Access:** All active users view and manage receipts; admin users manage case settings and document list.
* **Header:**
  - Firm Name (links to firm profile), Period Month, Cycle badge, Due Date, Assignee badge.
  - Status Badge (calculated from `case_status`).
  - Summary Metrics: Required Count, Received Count, Dispatched Count, Missing Count.
  - Overdue alert banner if `due_date < today` in `Asia/Kolkata` and status is not `Completed`.
* **Admin Case Settings Drawer/Panel:**
  - Edit Due Date (input type date).
  - Edit Assigned Staff (select active profile).
  - Hidden input for `version` (optimistic lock).
  - If concurrent modification occurs, displays:
    *"Concurrency Conflict: This case was modified by another user. Please reload the page to see the latest updates."*
* **Checklist Table (`case_document_status` view):**
  - Checkbox per document (disabled if already received, enabled for bulk receive).
  - Document Name.
  - Rule Badge (`REQUIRED` in blue, `OPTIONAL` in slate).
  - Status Badge (`Awaiting Receipt` in amber, `Received - Not Dispatched` in emerald, `Dispatched` in purple).
  - Received Info: Date/time and Received By user name.
  - Notes: Click to edit notes inline with instant save.
  - Actions:
    - If Awaiting: "Mark Received" button (with confirmation).
    - If Received: "Undo Receipt" button (blocked if in active dispatch).
    - Admin only: "Toggle Requirement", "Remove Document".
* **Bulk Receive Floating Bar:**
  - Appears when $\ge 1$ checkboxes are selected in the table.
  - Shows: *"3 documents selected"*.
  - Button: *"Receive Selected Documents"*.
  - Opens modal listing the exact document titles: *"Confirm receipt of the following 3 documents for this case?"*.
  - Calls `bulkReceiveDocumentsAction(caseId, [ids])`.
* **Add Document to Case (Admin only):**
  - Selector of active document types not already in this case.
  - "Required" checkbox.
  - "Add to Case" button.

---

## 5. Test Plan & Scenarios (`docs/phase4-tests.md`)

We will author `docs/phase4-tests.md` containing automated SQL assertions inside a transaction (`BEGIN ... ROLLBACK`) and manual UI verification steps:

### 5.1. Automated SQL Test Assertions
1. **Generator Idempotency:** Running `generate_cases()` twice for the same period and cycle creates cases on the 1st run and reports all in `skipped_existing` on the 2nd run (`created_count = 0`).
2. **Dry Run Zero-Mutation:** Calling `generate_cases(..., p_dry_run = true)` returns preview counts but modifies 0 rows across `cases`, `case_documents`, and `activity_logs`.
3. **Template-less Firm Handling:** Active firms with 0 configured template items are skipped and reported in `skipped_no_template`.
4. **Status View Calculation on Document Addition:** Adding a required document to a `Completed` case dynamically flips status to `Awaiting Documents`.
5. **Status View Calculation on Document Removal:** Removing a missing required document from an `Awaiting Documents` case automatically flips status to `Completed` (if all other required docs are received).
6. **Active Dispatch Guard on Undo Receipt:** Attempting to `unreceive_document()` on a document tied to an active dispatch item raises an exception.
7. **Optimistic Locking Guard:** Calling `update_case_details()` with an outdated version raises a concurrency conflict exception.
8. **Staff Authorization Guard:** Non-admin user calling `generate_cases()` or `update_case_details()` is rejected with `Access denied`.
9. **Bulk Receive Case Boundary:** `bulk_receive_documents()` rejects any call attempting to pass document IDs belonging to another case.

### 5.2. Manual UI Checklist
- Verify default case filter selects current month in Asia/Kolkata.
- Verify status badges always display explicit TEXT plus color.
- Verify bulk receive confirmation modal lists selected document names.
- Verify optimistic locking concurrency conflict banner when two tabs attempt to save changes.
- Verify touch targets $\ge 44\text{px}$ on mobile screens.

---

## 6. Implementation Checklist (Step 2)

| Step | Component | Action |
|---|---|---|
| **1** | Migration 6 | Create `supabase/migrations/20261019000006_phase4_case_functions.sql`. |
| **2** | Types | Update `src/types/database.types.ts` with new RPC functions. |
| **3** | Validations | Create `src/lib/validations/case.ts` with Zod schemas. |
| **4** | Server Actions | Create `src/app/(app)/cases/actions.ts`. |
| **5** | UI - Generator | Build `/admin/generate-cases` with dry run preview and confirm. |
| **6** | UI - Case Directory | Build `/cases` with filters, Asia/Kolkata default, search, and pagination. |
| **7** | UI - Checklist | Build `/cases/[id]` with header, checklist table, bulk receive, and admin controls. |
| **8** | Navigation | Link `/admin/generate-cases` in Admin overview. |
| **9** | Test Guide | Author `docs/phase4-tests.md` with SQL assertions and UI checklist. |
| **10** | Verification | Run `npm run lint` and `npm run build`. |

---

## 7. Assumptions & Decisions for User Confirmation

1. **Cycle Due Dates:** Cycle A defaults to the 11th and Cycle B defaults to the 20th of the target month in UI pickers, but the due date is always editable before generation and editable by admins afterwards.
2. **Bulk Receive Scope:** Bulk receive is strictly scoped to one case at a time via checkboxes in `/cases/[id]`. There is no cross-case bulk selection.
3. **Soft-deletion of Documents:** Removing a document from a case sets `removed_at = now()`. The partial unique index allows re-adding that document type if needed.
4. **Current Month in Asia/Kolkata:** Defaulting the directory to the current month in `Asia/Kolkata` ensures users across India see the active month regardless of server timezone.

---

*End of Phase 4 Plan. Awaiting user approval to proceed to Step 2 (Implementation).*
