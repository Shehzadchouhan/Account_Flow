# FinanceFlow — Phase 2 Plan: Database Design, Security Rules, Status Views & Seed Data

> **Status:** Revised per user review. Awaiting final user approval before Step 2 implementation.
> **Scope:** Phase 2 only (Schema, Constraints, Triggers, Views, RLS, Seed Data, Test Plan). No UI screens.

---

## 1. Overview & Business Context

- **Application Domain:** Document tracking and compliance dispatch for an Indian finance and taxation office.
- **Key Concepts:**
  - **Firm:** Client business entity (company, partnership, LLP, proprietorship).
  - **Case:** Operational work docket representing `Firm + Month + Deadline Cycle` (Cycle A: ~11th, Cycle B: ~20th). `due_date` is an editable date field, never hardcoded.
  - **Case Documents:** Checklist of required and optional documents for that case.
  - **Dispatch:** An outward transmission (email containing files sent to a recipient such as a CA or tax authority). Multiple dispatches per case are supported.
  - **Status:** **Never stored or manually set.** Always calculated in real time via PostgreSQL views.
  - **Storage:** Metadata only. File contents are not stored in the database.

---

## 2. Table Specifications (Exact Columns, Types & Constraints)

### 2.1. `profiles`
User profile extension tied directly to Supabase Auth (`auth.users`).

| Column | Type | Constraints & Defaults | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | Matches Supabase Auth user ID |
| `full_name` | `text` | `NOT NULL CHECK (length(trim(full_name)) > 0)` | User's full name |
| `role` | `text` | `NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff'))` | User permission role |
| `is_active` | `boolean` | `NOT NULL DEFAULT false` | **Inactive by default.** Admins must activate users. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Record creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last update timestamp |

- **Signup Safety:**
  - Auto-creation trigger on `auth.users` creates profiles with `is_active = false`.
  - Inactive users are rejected by all RLS policies (`is_active_user()` returns `false`).
  - **Action Required in Supabase Dashboard:** Public signup must be disabled in Supabase Auth settings (`Authentication -> Providers/Settings -> Disable "Allow new users to sign up"`).
- **Immutability:** Users cannot change their own or others' `role` or `is_active` status (guarded by RLS and trigger).

---

### 2.2. `firms`
Client business entities.

| Column | Type | Constraints & Defaults | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique firm identifier |
| `name` | `text` | `NOT NULL CHECK (length(trim(name)) > 0)` | Legal / trade name |
| `contact_person` | `text` | `NULL` | Primary client contact |
| `contact_email` | `text` | `NULL` | Client notification email |
| `contact_phone` | `text` | `NULL` | Client phone number |
| `default_employee` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | Default assigned staff member |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | Active client firm flag |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last update timestamp |

- **Unique Constraint:** Case-insensitive unique name:
  `CREATE UNIQUE INDEX firms_name_ci_idx ON firms (LOWER(TRIM(name)));`
- *Note:* `pan`, `gstin`, and `address` have been removed to keep the schema lean for Phase 2.

---

### 2.3. `document_types`
Master catalog of document categories.

| Column | Type | Constraints & Defaults | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique identifier |
| `name` | `text` | `NOT NULL CHECK (length(trim(name)) > 0)` | Document type name (e.g. "Sales Register") |
| `description` | `text` | `NULL` | Optional guidance notes |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | Active flag |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last update timestamp |

- **Unique Constraint:** Case-insensitive unique name:
  `CREATE UNIQUE INDEX document_types_name_ci_idx ON document_types (LOWER(TRIM(name)));`

---

### 2.4. `firm_template_items`
Standard checklist template items configured per firm.

| Column | Type | Constraints & Defaults | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique identifier |
| `firm_id` | `uuid` | `NOT NULL REFERENCES firms(id) ON DELETE CASCADE` | Associated firm |
| `document_type_id`| `uuid` | `NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT` | Associated document type |
| `is_required` | `boolean` | `NOT NULL DEFAULT true` | Default requirement flag |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last update timestamp |

- **Unique Constraint:** `UNIQUE (firm_id, document_type_id)`

---

### 2.5. `cases`
Operational period docket for a firm.

| Column | Type | Constraints & Defaults | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique case identifier |
| `firm_id` | `uuid` | `NOT NULL REFERENCES firms(id) ON DELETE RESTRICT` | Associated firm |
| `period_month` | `date` | `NOT NULL CHECK (period_month = date_trunc('month', period_month)::date)` | Enforces 1st day of month |
| `cycle` | `text` | `NOT NULL CHECK (cycle IN ('A_11th', 'B_20th'))` | Deadline cycle |
| `due_date` | `date` | `NOT NULL` | Editable statutory/internal deadline |
| `assigned_to` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | Assigned staff member |
| `version` | `integer` | `NOT NULL DEFAULT 1 CHECK (version >= 1)` | Optimistic locking counter |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last update timestamp |

- **Unique Constraint (Generator Idempotency):** `UNIQUE (firm_id, period_month, cycle)`
- **Optimistic Locking:** Managed by trigger incrementing `version`. The app updates with `WHERE id = $1 AND version = $2` and detects concurrency conflicts when rows affected = 0.

---

### 2.6. `case_documents`
Individual document checklist entries for a specific case.

| Column | Type | Constraints & Defaults | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique record identifier |
| `case_id` | `uuid` | `NOT NULL REFERENCES cases(id) ON DELETE CASCADE` | Parent case |
| `document_type_id`| `uuid` | `NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT` | Associated document type |
| `is_required` | `boolean` | `NOT NULL DEFAULT true` | Mandatory for case completion |
| `received_at` | `timestamptz` | `NULL` | Timestamp when document was received |
| `received_by` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | Staff member who received document |
| `notes` | `text` | `NULL` | Operational notes |
| `removed_at` | `timestamptz` | `NULL` | Soft delete timestamp (never hard deleted) |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last update timestamp |

- **Integrity Constraints:**
  - `CHECK ((received_at IS NULL AND received_by IS NULL) OR (received_at IS NOT NULL))`
  - Partial Unique Index:
    `CREATE UNIQUE INDEX case_documents_active_idx ON case_documents (case_id, document_type_id) WHERE (removed_at IS NULL);`
- **Column-Level Protection Trigger (`trg_case_documents_column_guard`):**
  - Non-admins may **only** update `received_at`, `received_by`, `notes`, `updated_at`.
  - Non-admins cannot change `case_id`, `document_type_id`, `is_required`, or `removed_at`.
  - Forces `received_by := auth.uid()` whenever receiving.
  - Blocks clearing `received_at` if the document is part of an active dispatch item.

---

### 2.7. `dispatches`
Outward transmissions (emails with files sent to CAs, auditors, or authorities).

| Column | Type | Constraints & Defaults | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique dispatch identifier |
| `case_id` | `uuid` | `NOT NULL REFERENCES cases(id) ON DELETE RESTRICT` | Associated case |
| `recipient` | `text` | `NOT NULL CHECK (length(trim(recipient)) > 0)` | Recipient name/email (e.g. CA Sharma) |
| `sent_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Time email/dispatch was sent |
| `recorded_by` | `uuid` | `NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT` | User who recorded dispatch |
| `email_reference` | `text` | `NULL` | Subject line or tracking ID |
| `voided_at` | `timestamptz` | `NULL` | Timestamp if voided |
| `voided_by` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | Admin who voided the dispatch |
| `void_reason` | `text` | `NULL` | Mandatory reason when voided |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Record creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last update timestamp |

- **Integrity Constraint (Void Consistency):**
  - `CHECK ((voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL) OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL AND length(trim(void_reason)) > 0))`
- **No Direct UPDATE / INSERT by Staff:** Only admins or the `void_dispatch()` / `create_dispatch()` `SECURITY DEFINER` functions can modify dispatches.

---

### 2.8. `dispatch_items`
Join table connecting a dispatch with the specific `case_documents` included in it.

| Column | Type | Constraints & Defaults | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique identifier |
| `dispatch_id` | `uuid` | `NOT NULL REFERENCES dispatches(id) ON DELETE RESTRICT` | Associated dispatch |
| `case_document_id`| `uuid` | `NOT NULL REFERENCES case_documents(id) ON DELETE RESTRICT` | Document dispatched |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | Active flag (false if dispatch is voided)|
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last update timestamp |

- **Single Active Dispatch Rule:**
  - A `case_document` may be in only ONE active dispatch item at a time.
  - Enforced via partial unique index:
    `CREATE UNIQUE INDEX dispatch_items_active_doc_idx ON dispatch_items (case_document_id) WHERE (is_active = true);`
- **No UPDATE Policy:** Cannot be updated directly by users; deactivated only via `void_dispatch()`.

---

### 2.9. `activity_logs`
Immutable audit trail for compliance and tracking.

| Column | Type | Constraints & Defaults | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique log identifier |
| `user_id` | `uuid` | `REFERENCES profiles(id) ON DELETE RESTRICT` | Performing user (**ON DELETE RESTRICT**) |
| `action` | `text` | `NOT NULL CHECK (length(trim(action)) > 0)` | Action verb (e.g. 'RECEIVE_DOCUMENT') |
| `entity_type` | `text` | `NOT NULL CHECK (length(trim(entity_type)) > 0)` | Entity name (e.g. 'case_documents') |
| `entity_id` | `uuid` | `NULL` | Primary key of target entity |
| `details` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | Context payload |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Log entry timestamp |

- **User Retention Policy:** Users are deactivated (`is_active = false`), **never deleted**. `ON DELETE RESTRICT` protects audit integrity.
- **System-Written Only:** No user has `INSERT` access. Written solely by database triggers and `SECURITY DEFINER` functions.
- **Append-Only Trigger:** Blocks `UPDATE` and `DELETE`.

---

## 3. Database Indexes

1. **`cases(due_date)`**: Supports sorting by due date, pending queues, and overdue checks.
2. **`cases(assigned_to)`**: Accelerates filtering by staff assignee.
3. **`cases(firm_id, period_month)`**: Accelerates client firm history lookups and ensures fast idempotent checks.
4. **`case_documents(case_id)`**: Used in every case detail screen and status view calculation.
5. **`case_documents(document_type_id)`**: Used for type lookups and aggregations.
6. **`dispatches(case_id)`**: Used for fetching dispatches belonging to a case.
7. **`dispatch_items(dispatch_id)`**: Used for loading items belonging to a dispatch.
8. **`dispatch_items(case_document_id)`**: Vital for document status calculation.
9. **`firms(LOWER(TRIM(name)))`**: Fast case-insensitive search and duplicate prevention.
10. **`document_types(LOWER(TRIM(name)))`**: Fast case-insensitive document type lookups.
11. **`activity_logs(entity_type, entity_id)`**: Supports audit trail views for specific entities.
12. **`activity_logs(created_at DESC)`**: Supports recent activity feed on dashboard.

---

## 4. Integrity Triggers & Functions

### 4.1. Updated At Trigger (`set_updated_at`)
Standard trigger function setting `updated_at = now()` before any row update on tables with an `updated_at` column.

### 4.2. Append-Only Trigger on `activity_logs`
```sql
CREATE OR REPLACE FUNCTION trg_block_activity_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs is an append-only audit table. UPDATE and DELETE operations are strictly prohibited.';
END;
$$;
```
Applied `BEFORE UPDATE OR DELETE ON activity_logs`.

### 4.3. Prevent Hard Deletes on Dispatches, Dispatch Items, and Activity Logs
```sql
CREATE OR REPLACE FUNCTION trg_prevent_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletion is strictly prohibited on %. Corrections happen only by voiding or soft deletion.', TG_TABLE_NAME;
END;
$$;
```
Applied `BEFORE DELETE ON dispatches`, `dispatch_items`, and `activity_logs`.

### 4.4. Column Protection Trigger on `case_documents`
```sql
CREATE OR REPLACE FUNCTION trg_case_documents_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  v_in_active_dispatch boolean;
BEGIN
  v_is_admin := is_admin();

  -- 1. Non-admin column modification restriction
  IF NOT v_is_admin THEN
    IF OLD.case_id <> NEW.case_id
       OR OLD.document_type_id <> NEW.document_type_id
       OR OLD.is_required <> NEW.is_required
       OR OLD.removed_at IS DISTINCT FROM NEW.removed_at THEN
      RAISE EXCEPTION 'Permission denied: Staff members can only update receipt status and notes.';
    END IF;
  END IF;

  -- 2. Force received_by to current authenticated user when receiving
  IF NEW.received_at IS NOT NULL AND OLD.received_at IS NULL THEN
    NEW.received_by := auth.uid();
  END IF;

  -- 3. Block un-receiving a document if it is in an active dispatch item
  IF OLD.received_at IS NOT NULL AND NEW.received_at IS NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM dispatch_items
      WHERE case_document_id = OLD.id AND is_active = true
    ) INTO v_in_active_dispatch;

    IF v_in_active_dispatch THEN
      RAISE EXCEPTION 'Cannot un-receive document %: it is currently part of an active dispatch. Void the dispatch first.', OLD.id;
    END IF;

    NEW.received_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;
```

### 4.5. Dispatch Item Validation Trigger
Ensures an item added to a dispatch:
1. Belongs to a document of the **same case**.
2. Is **not** being added to an already **voided dispatch**.
3. Has been **received** and is **not soft-deleted**.

```sql
CREATE OR REPLACE FUNCTION trg_validate_dispatch_item()
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
  SELECT case_id, voided_at INTO v_dispatch_case_id, v_dispatch_voided_at
  FROM dispatches WHERE id = NEW.dispatch_id;

  SELECT case_id, received_at, removed_at INTO v_doc_case_id, v_received_at, v_removed_at
  FROM case_documents WHERE id = NEW.case_document_id;

  IF v_dispatch_case_id IS NULL OR v_doc_case_id IS NULL THEN
    RAISE EXCEPTION 'Referenced dispatch or case document does not exist.';
  END IF;

  -- Cannot add items to a voided dispatch
  IF v_dispatch_voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add dispatch item: Dispatch % is voided.', NEW.dispatch_id;
  END IF;

  -- Must belong to the exact same case
  IF v_dispatch_case_id <> v_doc_case_id THEN
    RAISE EXCEPTION 'Case mismatch: Document % belongs to case %, but dispatch % belongs to case %',
      NEW.case_document_id, v_doc_case_id, NEW.dispatch_id, v_dispatch_case_id;
  END IF;

  -- Must be received and unremoved
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
```

### 4.6. Activity Log Triggers for Document Receipt & Dispatch Creation
```sql
-- Activity log trigger on case_documents
CREATE OR REPLACE FUNCTION trg_log_case_document_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF OLD.received_at IS NULL AND NEW.received_at IS NOT NULL THEN
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'RECEIVE_DOCUMENT',
      'case_documents',
      NEW.id,
      jsonb_build_object('case_id', NEW.case_id, 'document_type_id', NEW.document_type_id)
    );
  ELSIF OLD.received_at IS NOT NULL AND NEW.received_at IS NULL THEN
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'UNRECEIVE_DOCUMENT',
      'case_documents',
      NEW.id,
      jsonb_build_object('case_id', NEW.case_id, 'document_type_id', NEW.document_type_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Activity log trigger on dispatches
CREATE OR REPLACE FUNCTION trg_log_dispatch_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    NEW.recorded_by,
    'CREATE_DISPATCH',
    'dispatches',
    NEW.id,
    jsonb_build_object('case_id', NEW.case_id, 'recipient', NEW.recipient)
  );
  RETURN NEW;
END;
$$;
```

### 4.7. Optimistic Locking Trigger on `cases`
```sql
CREATE OR REPLACE FUNCTION trg_case_increment_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically increment version on every successful update
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
```
> **Application Pattern:** The application executes updates with:
> `UPDATE cases SET ... WHERE id = $1 AND version = $2`
> If affected rows = 0, the application detects an optimistic locking conflict and prompts the user to reload.

### 4.8. Atomic Void Dispatch Function (`void_dispatch`)
```sql
CREATE OR REPLACE FUNCTION void_dispatch(p_dispatch_id uuid, p_reason text)
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can void dispatches.';
  END IF;

  -- 2. Parameter validation
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A non-empty void reason is required.';
  END IF;

  -- 3. Retrieve dispatch
  SELECT case_id, voided_at INTO v_case_id, v_voided_at
  FROM dispatches
  WHERE id = p_dispatch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispatch % not found.', p_dispatch_id;
  END IF;

  IF v_voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Dispatch % has already been voided.', p_dispatch_id;
  END IF;

  -- 4. Mark dispatch voided
  UPDATE dispatches
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = trim(p_reason),
      updated_at = now()
  WHERE id = p_dispatch_id;

  -- 5. Deactivate associated dispatch items
  UPDATE dispatch_items
  SET is_active = false,
      updated_at = now()
  WHERE dispatch_id = p_dispatch_id;

  -- 6. Record append-only activity log
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
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
```

### 4.9. Auto-Create Inactive Profile Trigger on Auth Signup
```sql
CREATE OR REPLACE FUNCTION trg_handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- New profiles default to is_active = false; an admin must activate them.
  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'staff',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

---

## 5. Status Views Logic (`WITH (security_invoker = true)`)

### 5.1. View: `case_document_status`
Includes `firm_id` and `document_type_name` for easy filtering and joins:
```sql
CREATE OR REPLACE VIEW case_document_status
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
      FROM dispatch_items di
      JOIN dispatches d ON d.id = di.dispatch_id
      WHERE di.case_document_id = cd.id
        AND di.is_active = true
        AND d.voided_at IS NULL
    ) THEN 'Dispatched'
    WHEN cd.received_at IS NOT NULL THEN 'Received - Not Dispatched'
    ELSE 'Awaiting Receipt'
  END AS status
FROM case_documents cd
JOIN cases c ON c.id = cd.case_id
JOIN document_types dt ON dt.id = cd.document_type_id
WHERE cd.removed_at IS NULL;
```

### 5.2. View: `case_status`
Includes `firm_id`, `firm_name`, and `firm_is_active`.
Calculates status using **only required, unremoved documents** (`is_required = true AND removed_at IS NULL`):

```sql
CREATE OR REPLACE VIEW case_status
WITH (security_invoker = true)
AS
WITH required_doc_metrics AS (
  SELECT
    c.id AS case_id,
    COUNT(cd.id) AS required_count,
    COUNT(cd.id) FILTER (WHERE cd.received_at IS NOT NULL) AS received_count,
    COUNT(cd.id) FILTER (
      WHERE cd.received_at IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM dispatch_items di
          JOIN dispatches d ON d.id = di.dispatch_id
          WHERE di.case_document_id = cd.id
            AND di.is_active = true
            AND d.voided_at IS NULL
        )
    ) AS dispatched_count
  FROM cases c
  LEFT JOIN case_documents cd
    ON cd.case_id = c.id
   AND cd.is_required = true
   AND cd.removed_at IS NULL
  GROUP BY c.id
),
calculated_cases AS (
  SELECT
    c.id AS case_id,
    c.firm_id,
    f.name AS firm_name,
    f.is_active AS firm_is_active,
    c.period_month,
    c.cycle,
    c.due_date,
    c.assigned_to,
    c.version,
    c.created_at,
    c.updated_at,
    COALESCE(m.required_count, 0) AS required_count,
    COALESCE(m.received_count, 0) AS received_count,
    COALESCE(m.dispatched_count, 0) AS dispatched_count,
    (COALESCE(m.required_count, 0) - COALESCE(m.received_count, 0)) AS missing_count,
    (COALESCE(m.received_count, 0) - COALESCE(m.dispatched_count, 0)) AS undispatched_count,
    CASE
      WHEN COALESCE(m.required_count, 0) = 0 THEN 'No Required Documents'
      WHEN (COALESCE(m.required_count, 0) - COALESCE(m.received_count, 0)) > 0 THEN 'Awaiting Documents'
      WHEN (COALESCE(m.received_count, 0) - COALESCE(m.dispatched_count, 0)) > 0 THEN 'Pending Dispatch'
      ELSE 'Completed'
    END AS status
  FROM cases c
  JOIN firms f ON f.id = c.firm_id
  JOIN required_doc_metrics m ON m.case_id = c.id
)
SELECT
  cc.*,
  (cc.due_date < (now() AT TIME ZONE 'Asia/Kolkata')::date AND cc.status <> 'Completed') AS is_overdue
FROM calculated_cases cc;
```

---

## 6. RLS Security Architecture, Hardening & Matrix

### 6.1. Permissions Revocation (Default Deny for Anon & Public)
Every table and view must be completely inaccessible to unauthenticated users (`anon` and `PUBLIC`):
```sql
-- Revoke all table permissions from anon and PUBLIC
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, PUBLIC;

-- Grant usage to authenticated users only
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated;
```

### 6.2. Security Definer Helper Functions
```sql
CREATE OR REPLACE FUNCTION is_active_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_active = true AND role = 'admin'
  );
$$;
```

### 6.3. Revised RLS Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | `is_active_user()` | `is_admin()` or auth trigger | `is_admin()` | Denied (`false`) |
| `firms` | `is_active_user()` | `is_admin()` | `is_admin()` | Denied (`false`) |
| `document_types` | `is_active_user()` | `is_admin()` | `is_admin()` | Denied (`false`) |
| `firm_template_items` | `is_active_user()` | `is_admin()` | `is_admin()` | `is_admin()` |
| `cases` | `is_active_user()` | `is_admin()` | `is_admin()` | Denied (`false`) |
| `case_documents` | `is_active_user()` | `is_admin()` | `is_active_user()` (Trigger restricts staff to receipt columns) | Denied (`false`) (use `removed_at`) |
| `dispatches` | `is_active_user()` | `is_admin()` (Staff insert via `create_dispatch()` in Phase 5) | **No UPDATE Policy** (Void function only) | Denied (`false`) |
| `dispatch_items` | `is_active_user()` | `is_admin()` (Staff insert via `create_dispatch()` in Phase 5) | **No UPDATE Policy** (Void function only) | Denied (`false`) |
| `activity_logs` | `is_active_user()` | **No User INSERT** (Triggers & `SECURITY DEFINER` only) | Denied (`false` + trigger) | Denied (`false` + trigger) |

---

## 7. Seed Data Outline (`supabase/seed.sql`)

### 7.1. Parameterization
- Script parameter at top:
  `v_admin_email text := 'admin@financeflow.local';`
- Looks up profile for `v_admin_email`. If none exists, gracefully outputs a notice and skips without crashing.
- Includes a clearly commented cleanup script:
  `-- CLEANUP: DELETE FROM firms WHERE name IN (...);`

### 7.2. 5 Fake Client Firms (Indian Business Entities)
1. **Apex Logistics Pvt Ltd** (Contact: Rajesh Verma, email: `rajesh@apexlogistics.fake`)
2. **Bharat Engineering Works** (Contact: Suresh Patel, email: `suresh@bharateng.fake`)
3. **Cauvery Textiles & Garments** (Contact: Meenakshi Sundaram, email: `meena@cauverytextiles.fake`)
4. **Doon Valley Agro Foods** (Contact: Amit Rawat, email: `amit@doonagro.fake`)
5. **Evergreen Solar Solutions** (Contact: Priya Nair, email: `priya@evergreensolar.fake`, `is_active = false` [Archived Firm])

### 7.3. 5 Document Types
1. "Sales Register"
2. "Purchase Register"
3. "Bank Statement"
4. "GSTR-3B Summary"
5. "Expense Vouchers"

### 7.4. Seed Cases for Current Month (8 Scenarios)
- **Case A (Apex Logistics - Cycle A_11th):**
  - 5 required documents created and all 5 received.
  - 1 dispatch recorded with all 5 documents.
  - **Expected Status:** `Completed` (`missing_count = 0`, `undispatched_count = 0`).
- **Case B (Bharat Engineering - Cycle B_20th):**
  - 5 required documents created and all 5 received.
  - 1 dispatch recorded with 4 documents (1 not dispatched).
  - **Expected Status:** `Pending Dispatch` (`missing_count = 0`, `undispatched_count = 1`).
- **Case C (Cauvery Textiles - Cycle A_11th):**
  - 5 required documents created; 3 received, 2 missing.
  - 0 dispatches.
  - **Expected Status:** `Awaiting Documents` (`missing_count = 2`, `received_count = 3`).
- **Case D (Doon Valley Agro - Cycle B_20th):**
  - 5 required documents created and all 5 received.
  - Dispatched in 2 separate batches (Batch 1: 3 documents, Batch 2: 2 documents).
  - **Expected Status:** `Completed` (both dispatches visible and active).
- **Case E (Apex Logistics - Cycle B_20th):**
  - 5 required documents created and all 5 received.
  - 0 dispatches.
  - **Expected Status:** `Pending Dispatch` (`missing_count = 0`, `undispatched_count = 5`).
- **Case F (Bharat Engineering - Cycle A_11th [Optional Document Missing]):**
  - 4 required documents (all received & dispatched).
  - 1 **optional** document (`is_required = false`, not received).
  - **Expected Status:** `Completed` (proves optional doc does NOT block completion).
- **Case G (Cauvery Textiles - Cycle B_20th [Zero Required Documents]):**
  - 0 required documents.
  - **Expected Status:** `No Required Documents` (proves zero required documents is never `Completed`).
- **Case H (Evergreen Solar - Cycle A_11th [Archived Firm]):**
  - Open case for archived firm (`firm_is_active = false`).
  - **Expected Status:** `firm_is_active = false` in `case_status`.

---

## 8. Test Plan (`supabase/tests/status_scenarios.sql`)

All tests run inside an isolated transaction (`BEGIN; ... ROLLBACK;`).

| # | Test Assertion | Validation Method |
|---|---|---|
| **1** | **Case A $\to$ Completed** | Assert `status = 'Completed'`, `missing_count = 0`, `undispatched_count = 0`. |
| **2** | **Case B $\to$ Pending Dispatch** | Assert `status = 'Pending Dispatch'`, `undispatched_count = 1`. |
| **3** | **Case C $\to$ Awaiting Documents** | Assert `status = 'Awaiting Documents'`, `missing_count = 2`, `received_count = 3`. |
| **4** | **Case D $\to$ Multi-batch Dispatches** | Assert `status = 'Completed'`, active dispatches count = 2. |
| **5** | **Dynamic Recalculation on New Document** | Insert 6th required document into Case A $\to$ Assert status switches from `Completed` to `Awaiting Documents`. |
| **6** | **Voiding Dispatch $\to$ Pending Dispatch** | Call `void_dispatch()` for Case A dispatch $\to$ Assert status reverts to `Pending Dispatch`, items deactivated, and `activity_logs` entry exists. |
| **7** | **Single Active Dispatch Item Constraint** | Attempt inserting an active `dispatch_item` for an already dispatched document $\to$ Assert partial unique index throws violation error. |
| **8** | **Zero Required Documents Handling** | Query Case G $\to$ Assert `status = 'No Required Documents'` (never `Completed`). |
| **9** | **Append-Only `activity_logs`** | Attempt `UPDATE` and `DELETE` on `activity_logs` $\to$ Assert trigger raises exception. |
| **10** | **Idempotent Case Uniqueness** | Attempt duplicate `(firm_id, period_month, cycle)` $\to$ Assert unique constraint violation error. |
| **11** | **Manual RLS Simulation Guide** | Set `SET LOCAL ROLE authenticated;` and `SET LOCAL request.jwt.claims = '...';` to test staff role restrictions. |
| **12** | **Optional Doc Missing but Case Completed** | Query Case F $\to$ Assert `status = 'Completed'` even with 1 optional unreceived document. |
| **13** | **Staff Cannot Change `is_required` or `removed_at`** | Simulating staff role, attempt updating `is_required` or `removed_at` on `case_documents` $\to$ Assert trigger raises exception. |
| **14** | **Staff Cannot Spoof `user_id` on Dispatches or Logs** | Verify direct user insert into `activity_logs` is denied, and `case_documents` receipt trigger forces `received_by := auth.uid()`. |
| **15** | **New Signup Profile is Inactive and Denied Access** | Create a test user with `is_active = false` $\to$ Query `cases` $\to$ Assert 0 rows returned under RLS. |
| **16** | **Un-receiving a Dispatched Document is Blocked** | Attempt setting `received_at = NULL` on a document in an active dispatch $\to$ Assert trigger raises exception. |
| **17** | **Adding Item to Voided Dispatch is Blocked** | Attempt adding `dispatch_item` to a voided dispatch $\to$ Assert trigger raises exception. |
| **18** | **Anon Role Cannot Read Any Table or View** | Under `anon` role, query `cases`, `firms`, `case_status` $\to$ Assert `PERMISSION DENIED`. |
| **19** | **Archived-Firm Cases Identifiable via `firm_is_active`** | Query Case H $\to$ Assert `firm_is_active = false`. |

---

## 9. Migration Files & Execution Sequence

Migrations will be authored in `supabase/migrations/`:
1. `20261019000001_initial_schema.sql` (Tables, Foreign Keys, CHECK constraints, Indexes)
2. `20261019000002_integrity_triggers.sql` (Optimistic locking, audit append-only, column protection, cross-case validator, `void_dispatch` function)
3. `20261019000003_status_views.sql` (`case_document_status` and `case_status` with `security_invoker`)
4. `20261019000004_permissions_and_rls.sql` (Anon revocation, `is_active_user()`, `is_admin()`, and RLS policies)

---

## 10. Application Code Updates (Phase 2 Integration)

1. **`src/utils/auth.ts`**:
   - Update `getCurrentUserRole()` to query `profiles.role` using the server Supabase client:
     ```typescript
     const supabase = await createClient()
     const { data } = await supabase
       .from('profiles')
       .select('role')
       .eq('id', user.id)
       .single()
     return (data?.role as UserRole) || 'staff'
     ```
   - Keep `requireAdmin()` strictly enforcing the `admin` role server-side.
2. **Database Types (`src/types/database.types.ts`)**:
   - Add strong TypeScript definitions representing all tables, views, and enums.

---

*End of Revised Phase 2 Plan. Awaiting final user approval before Step 2 implementation.*
