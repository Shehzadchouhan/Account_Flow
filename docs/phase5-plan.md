# FinanceFlow — Phase 5 Plan: Outward Dispatch Management & Delivery Tracking

> **Status:** Draft / Proposed Plan. Awaiting user approval before Step 2 implementation.  
> **Scope:** Phase 5 only: Outward Dispatch Creation (`create_dispatch`), Idempotency Keys, Active Dispatch Locking, Document Dispatch History per case, Admin-Only Voiding (`void_dispatch`), and Global Outward Dispatches Directory (`/dispatches`).

---

## 1. Executive Summary & Business Scope

In Phase 5, we build the outward fulfillment and communication tracking layer of FinanceFlow:
1. **Outward Dispatches Definition:**
   - A *Dispatch* represents an outward transmission (email, speed post, courier) sent to an external stakeholder (such as a Chartered Accountant, tax authority, or partner).
   - A single case can have **multiple dispatches** (e.g. Batch 1 sent on the 5th, Batch 2 sent on the 9th).
   - Only documents that are **Received and not yet dispatched** (`Received - Not Dispatched`) are eligible to be included in a dispatch.
   - When all required documents of a case are dispatched, the real-time view `case_status` automatically transitions from `Pending Dispatch` to `Completed`.
2. **Double-Submit Protection & Idempotency (`idempotency_key`):**
   - Dispatches include a unique `idempotency_key` (client-generated UUID generated when the dispatch modal opens).
   - If a network retry or double-click occurs with the same idempotency key, `create_dispatch()` returns the existing dispatch without creating duplicates or failing.
3. **Immutability & Correction by Voiding:**
   - Dispatches and dispatch items are **strictly append-only**. Direct client `INSERT`, `UPDATE`, and `DELETE` are prohibited by RLS.
   - The only way to correct a dispatch is for an administrator to invoke `void_dispatch()` with a mandatory explanation.
   - Voiding deactivates all attached `dispatch_items` and immediately returns documents to `Received - Not Dispatched`, safely reverting the case status to `Pending Dispatch` while permanently keeping the historical void record visible for compliance audits.
4. **Outward Dispatch UI:**
   - **On `/cases/[id]`:**
     - Interactive **"Record Dispatch"** dialog showing only received undispatched documents.
     - **"Dispatch all received documents of this case"** shortcut button.
     - Recipient input with suggestions from previous distinct recipients.
     - Case Dispatch History showing all past transmissions, attached documents, and clear `VOIDED` badges with void reasons.
     - Admin-only **"Void Dispatch"** modal requiring an audit explanation.
   - **Global Directory (`/dispatches`):**
     - Office-wide dispatch ledger filterable by date range, client firm, recipient, recorded by, and void status.

---

## 2. Database Changes (Migration 7: `supabase/migrations/20261019000007_phase5_dispatch_management.sql`)

All database functions are authored as `SECURITY DEFINER` with safe `search_path = public, auth, pg_temp`, revoked from `anon` and `PUBLIC`, and granted to `authenticated`.

### 2.1. Add `idempotency_key` to `public.dispatches`
```sql
ALTER TABLE public.dispatches ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS dispatches_idempotency_key_uniq
  ON public.dispatches (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

### 2.2. Atomic Function `create_dispatch()`
* **Signature:**
  ```sql
  public.create_dispatch(
    p_case_id uuid,
    p_recipient text,
    p_case_document_ids uuid[],
    p_sent_at timestamptz,
    p_email_reference text,
    p_idempotency_key text
  ) RETURNS jsonb
  ```
* **Security & Permissions:**
  - `SECURITY DEFINER`
  - Active users only (`public.is_active_user()`).
  - `recorded_by` is strictly set to `auth.uid()` (never passed from client).
* **Validation Rules:**
  1. **Idempotency Guard:** If `p_idempotency_key` is provided and a dispatch with that key already exists, returns the existing dispatch:
     `{"success": true, "dispatch_id": v_existing_id, "is_duplicate": true}` without raising an error.
  2. **Recipient Check:** `p_recipient` must be non-empty after trimming.
  3. **Document Array Check:** `p_case_document_ids` must have length $\ge 1$.
  4. **Future Timestamp Check:** `p_sent_at` cannot be in the future (allowing a 5-minute clock drift margin):
     `IF p_sent_at > (now() + interval '5 minutes') THEN RAISE EXCEPTION 'Dispatch sent_at timestamp cannot be in the future.'; END IF;`
  5. **Document Integrity Checks (for every document in array):**
     - Must belong to `p_case_id` and have `removed_at IS NULL`.
     - Must be **marked received** (`received_at IS NOT NULL`). If any un-received document is selected, throws:
       `'Document % is not received. Only received documents can be dispatched.'`
     - Must **NOT be in an active dispatch** (`di.is_active = true AND d.voided_at IS NULL`). If already dispatched, throws:
       `'Document % is already part of an active dispatch.'`
* **Execution:**
  1. Inserts into `public.dispatches (case_id, recipient, sent_at, recorded_by, email_reference, idempotency_key)`
     returning `id INTO v_new_dispatch_id`.
  2. Inserts rows into `public.dispatch_items (dispatch_id, case_document_id, is_active)` for each selected document.
  3. Appends an audit log into `public.activity_logs`:
     `action = 'CREATE_DISPATCH'`, `entity_type = 'dispatches'`, `entity_id = v_new_dispatch_id`.
* **Return Value:**
  `{"success": true, "dispatch_id": v_new_dispatch_id, "is_duplicate": false}`

### 2.3. Direct Insert RLS Hardening
To guarantee that no client code can bypass the validations and activity logging of `create_dispatch()`:
```sql
-- Drop any direct INSERT policies on dispatches and dispatch_items
DROP POLICY IF EXISTS dispatches_insert_admin ON public.dispatches;
DROP POLICY IF EXISTS dispatch_items_insert_admin ON public.dispatch_items;
```
*(All dispatches and dispatch items must be created exclusively via `create_dispatch()` and voided exclusively via `void_dispatch()`)*.

### 2.4. Helper Function `get_distinct_recipients()`
Provides suggestions for the recipient autocomplete datalist in the dispatch modal:
```sql
CREATE OR REPLACE FUNCTION public.get_distinct_recipients()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT COALESCE(array_agg(r.recipient ORDER BY r.recipient), ARRAY[]::text[])
  FROM (
    SELECT DISTINCT recipient
    FROM public.dispatches
    WHERE length(trim(recipient)) > 0
    ORDER BY recipient
    LIMIT 100
  ) r;
$$;
```

---

## 3. Server Actions & Validation Architecture

### 3.1. Zod Validation Schemas (`src/lib/validations/dispatch.ts`)
* **`createDispatchSchema`:**
  - `case_id`: uuid.
  - `recipient`: string, min 2, max 200, trimmed.
  - `case_document_ids`: array of uuids, min 1.
  - `sent_at`: string (ISO datetime string, optional/defaults to now).
  - `email_reference`: optional string, max 250, trimmed.
  - `idempotency_key`: optional string, max 100.
* **`voidDispatchSchema`:**
  - `dispatch_id`: uuid.
  - `case_id`: uuid.
  - `reason`: string, min 5, max 500, trimmed (mandatory audit explanation).

### 3.2. Server Action Modules (`src/app/(app)/cases/dispatch-actions.ts`)
* **`createDispatchAction(prevState, formData)`:**
  - Enforces `requireAuth()`.
  - Validates payload with `createDispatchSchema`.
  - Calls `supabase.rpc('create_dispatch', ...)`.
  - Revalidates `/cases/[id]`, `/cases`, and `/dispatches`.
  - Returns `{ success: true, dispatchId: data.dispatch_id, isDuplicate: data.is_duplicate }`.
* **`voidDispatchAction(prevState, formData)`:**
  - Enforces `requireAdmin()`.
  - Validates payload with `voidDispatchSchema`.
  - Calls `supabase.rpc('void_dispatch', { p_dispatch_id, p_reason })`.
  - Revalidates `/cases/[id]`, `/cases`, and `/dispatches`.
  - Returns `{ success: true }`.
* **`getDistinctRecipientsAction()`:**
  - Calls `supabase.rpc('get_distinct_recipients')`.
  - Returns array of string suggestions.

---

## 4. UI Architecture & Screen Specifications

### 4.1. "New Dispatch" Dialog on Case Page (`/cases/[id]`)
* **Entry Points:**
  - Primary button: **"Record Dispatch"** in the case actions bar.
  - Shortcut button: **"Dispatch All Received Documents"** (enabled when $\ge 1$ documents are received and un-dispatched).
* **Document Selection Table:**
  - Shows only documents with status `Received - Not Dispatched`.
  - Checkboxes for selecting specific documents to include.
  - Shows total selected count.
* **Form Controls:**
  - **Recipient:** Text input with an HTML5 `<datalist>` populated by `get_distinct_recipients()`.
  - **Sent Date & Time:** `datetime-local` input, defaulted to current time in `Asia/Kolkata`.
  - **Email Subject / Reference:** Optional input (e.g. *"Email to CA: October Sales & Bank Dockets"*).
  - **Idempotency Key:** Hidden input populated with `crypto.randomUUID()` upon opening the dialog.
* **Summary & Confirmation Step:**
  - Lists the selected document names, recipient, and date/time.
  - Prominent warning: *"Transmitting documents marks them as DISPATCHED. They cannot be edited or removed unless this dispatch is voided by an administrator."*
  - **"Confirm & Record Dispatch"** button (disabled while pending).

### 4.2. Case Dispatch History on Case Page (`/cases/[id]`)
* Located directly below the Checklist table.
* Lists all outward transmissions recorded for this case (both active and voided).
* Each dispatch card displays:
  - **Header:** Sent Date & Time (formatted in `Asia/Kolkata`), Recipient name, and Status Badge:
    - Active: `ACTIVE DISPATCH` (blue/indigo text + color).
    - Voided: `VOIDED` (red/amber text + color) with subtext displaying:
      *"Voided by Admin on [Date] — Reason: [Reason]"*.
  - **Metadata:** Recorded by staff member, Email reference / courier tracking number.
  - **Included Documents:** List of documents that were transmitted in this batch.
  - **Void Button (Admin only):**
    - Visible only for active dispatches.
    - Opens **Void Confirmation Dialog** requiring an explicit void reason (min 5 chars).
    - Calls `voidDispatchAction`.

### 4.3. Global Outward Dispatches Directory (`/dispatches`)
* Added to main sidebar navigation (`AppLayoutNav.tsx`).
* Office-wide ledger of all outward dispatches across all client firms.
* **Filters:**
  - Date Range (`from_date` and `to_date`).
  - Client Firm dropdown.
  - Recipient search.
  - Recorded By staff dropdown.
  - Status filter: `All Dispatches`, `Active Only` (default), `Voided Only`.
* **Table Columns:**
  - Sent Date & Time (`Asia/Kolkata`)
  - Client Firm & Case Period (links to `/cases/[id]`)
  - Recipient
  - Email Reference / Subject
  - Documents Included (count & popover/list)
  - Recorded By (Staff name)
  - Status Badge (`ACTIVE DISPATCH` or `VOIDED`)
  - Action: "View Case &rarr;" (and "Void" button for admins on active dispatches).
* **Pagination:** 25 items per page (`?page=1`).

---

## 5. Test Plan & Scenarios (`docs/phase5-tests.md`)

We will author `docs/phase5-tests.md` containing automated SQL test assertions inside a transaction (`BEGIN ... ROLLBACK`) and manual UI testing steps:

### 5.1. Automated SQL Test Assertions
1. **Successful Dispatch Creation:** `create_dispatch()` creates a dispatch, inserts `dispatch_items`, logs activity, and sets document status in `case_document_status` to `'Dispatched'`.
2. **Case Completion:** When all required documents of a case are dispatched, `case_status.status` evaluates dynamically to `'Completed'`.
3. **Multi-Batch Independence:** Dispatching document A in Batch 1 and document B in Batch 2 preserves both dispatches independently.
4. **Active Dispatch Conflict Guard:** Attempting to include a document that is already in an active dispatch throws:
   `'Document % is already part of an active dispatch.'`
5. **Idempotency Key Deduping:** Calling `create_dispatch()` twice with the exact same `idempotency_key` creates only ONE dispatch and returns `is_duplicate = true` on the second call.
6. **Void Dispatch Status Rollback:** Calling `void_dispatch()` marks the dispatch as voided, deactivates its items, returns documents to `'Received - Not Dispatched'`, and rolls case status back to `'Pending Dispatch'`.
7. **Staff Void Guard:** Non-admin staff attempting to call `void_dispatch()` is rejected with `Access denied`.
8. **Un-received Document Guard:** Attempting to dispatch a document that has not been marked received throws:
   `'Document % is not received. Only received documents can be dispatched.'`
9. **Future Timestamp Guard:** Calling `create_dispatch()` with `sent_at > now() + 5 minutes` throws:
   `'Dispatch sent_at timestamp cannot be in the future.'`
10. **Direct Insert RLS Guard:** Direct client `INSERT` into `dispatches` and `dispatch_items` is rejected by Row Level Security.

### 5.2. Manual UI Checklist
- Verify recipient suggestions datalist populates with previous recipient names.
- Verify "Dispatch all received documents" button auto-selects all eligible items.
- Verify void dialog requires a non-empty explanation before enabling confirmation.
- Verify double-click submission is prevented by button disabling and idempotency key.
- Verify touch targets $\ge 44\text{px}$ on mobile screens.

---

## 6. Implementation Checklist (Step 2)

| Step | Component | Action |
|---|---|---|
| **1** | Migration 7 | Create `supabase/migrations/20261019000007_phase5_dispatch_management.sql`. |
| **2** | Types | Update `src/types/database.types.ts` with `dispatches.idempotency_key` and RPC functions. |
| **3** | Validations | Create `src/lib/validations/dispatch.ts`. |
| **4** | Server Actions | Create `src/app/(app)/cases/dispatch-actions.ts`. |
| **5** | UI - Dispatch Dialog | Build `RecordDispatchModal.tsx` on `/cases/[id]`. |
| **6** | UI - Case History | Build `CaseDispatchHistory.tsx` on `/cases/[id]` with admin void modal. |
| **7** | UI - Case Integration | Update `/cases/[id]/page.tsx` with dispatch dialog and history. |
| **8** | UI - Global Dispatches | Build `/dispatches` directory with filters and pagination. |
| **9** | Navigation | Add `/dispatches` to `AppLayoutNav.tsx`. |
| **10** | Test Guide | Author `docs/phase5-tests.md` with SQL assertions and UI checklist. |
| **11** | Verification | Run `npm run lint` and `npm run build`. |

---

## 7. Assumptions & Decisions for User Confirmation

1. **Sent Date Default:** The sent timestamp defaults to the current moment in Indian Standard Time (`Asia/Kolkata`), but can be adjusted backwards if recording a dispatch that occurred earlier in the day. Future timestamps beyond 5 minutes are strictly blocked.
2. **Direct Client Insert Prohibition:** Dropping direct insert policies on `dispatches` and `dispatch_items` guarantees that even admins must create dispatches through `create_dispatch()`, ensuring audit trails and validations can never be bypassed.
3. **Void Reason Mandatory:** A minimum 5-character reason is enforced whenever an admin voids a dispatch to ensure accountability.

---

*End of Phase 5 Plan. Awaiting user approval to proceed to Step 2 (Implementation).*
