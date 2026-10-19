# FinanceFlow — Operational Metrics Specification

> **Document Version:** 1.0.0  
> **Phase:** 6 — Dashboard, Pending Work & Search  
> **Source of Truth:** Real-time database views (`case_status`, `case_document_status`, and tables `firms`, `profiles`)  
> **Timezone Requirement:** `Asia/Kolkata` (IST, UTC+05:30)

---

## 1. Executive Summary & Design Principles

All metrics displayed on the Dashboard (`/`), Pending Work (`/pending`), Compliance Cases (`/cases`), and reports are **100% computed from real-time database views and queries**. 

### Core Rules:
1. **Zero Hardcoded Values:** No metric card or breakdown table may use mock, hardcoded, or statically estimated counts.
2. **Distinct Counting (No Double Counting):** Any metric counting firms or entities across multiple cases or documents MUST use `COUNT(DISTINCT ...)` to prevent duplicate counts when multiple records exist for the same entity.
3. **Archived Firm Exclusion:** All case-level and document-level operational metrics exclude archived/inactive firms (`firm_is_active = false`). Only active firms (`is_active = true`) are tracked in active compliance operations.
4. **Single Source of Truth:** The Dashboard, `/pending`, and `/cases` detail views query the exact same underlying views:
   - Case metrics come strictly from `public.case_status`.
   - Document metrics come strictly from `public.case_document_status`.
5. **Kolkata Timezone Integrity:** Any calculation checking today's date (`due today`) or overdue status (`is_overdue`) computes the reference date against `(now() AT TIME ZONE 'Asia/Kolkata')::date`.

---

## 2. Metric Definitions & Formulas

### 2.1 Firm-Level Metrics

| Metric Identifier | Dashboard Card Label | Target Entity | Source Table / View | Precise SQL / Filter Condition | Destination Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `active_firms` | **Active Firms** | `firms` | `public.firms` | `COUNT(DISTINCT id) FROM public.firms WHERE is_active = true` | `/firms` |
| `firms_needing_attention` | **Firms Needing Attention** | `firms` | `public.case_status` | `COUNT(DISTINCT firm_id) FROM public.case_status WHERE firm_is_active = true AND period_month = :selected_month AND status <> 'Completed' AND (is_overdue = true OR due_date = (now() AT TIME ZONE 'Asia/Kolkata')::date)` | `/cases?month=:selected_month&attention=true` |

#### Detailed Logic:
- **Active Firms:** Represents all operating client entities registered in FinanceFlow. Excludes archived firms (`is_active = false`).
- **Firms Needing Attention:** Distinct client firms that have at least one case in the selected month that is either **Overdue** (`due_date < current_kolkata_date`) OR **Due Today** (`due_date = current_kolkata_date`) and is **NOT Completed** (`status <> 'Completed'`).
  - *No Double Counting:* If a firm has both an overdue Cycle A case and a due-today Cycle B case, the firm is counted exactly once (`DISTINCT firm_id`).
  - *Archived firms excluded:* Cases belonging to `firm_is_active = false` are omitted.

---

### 2.2 Case-Level Metrics (Selected Month, Active Firms Only)

Source View: `public.case_status`  
Filter Scope: `period_month = :selected_month AND firm_is_active = true`

| Metric Identifier | Dashboard Card Label | Status String in `case_status` | Precise SQL Filter Condition | Destination Link |
| :--- | :--- | :--- | :--- | :--- |
| `cases_awaiting_docs` | **Awaiting Documents** | `'Awaiting Documents'` | `status = 'Awaiting Documents'` | `/cases?month=:selected_month&status=Awaiting+Documents` |
| `cases_pending_dispatch`| **Pending Dispatch** | `'Pending Dispatch'` | `status = 'Pending Dispatch'` | `/cases?month=:selected_month&status=Pending+Dispatch` |
| `cases_completed` | **Completed** | `'Completed'` | `status = 'Completed'` | `/cases?month=:selected_month&status=Completed` |
| `cases_overdue` | **Overdue Cases** | Any non-Completed | `is_overdue = true` (i.e. `due_date < (now() AT TIME ZONE 'Asia/Kolkata')::date AND status <> 'Completed'`) | `/cases?month=:selected_month&overdue=true` |
| `cases_due_today` | **Due Today** | Any non-Completed | `due_date = (now() AT TIME ZONE 'Asia/Kolkata')::date AND status <> 'Completed'` | `/cases?month=:selected_month&due_today=true` |
| `cases_needs_setup` | **Needs Setup** | `'No Required Documents'` | `status = 'No Required Documents'` | `/cases?month=:selected_month&status=No+Required+Documents` |

#### Detailed Logic:
- **Awaiting Documents:** Cases where at least one required checklist document has not yet been received (`missing_count > 0`).
- **Pending Dispatch:** Cases where all required checklist documents have been received, but one or more active required documents have not yet been included in an active outward dispatch (`missing_count = 0 AND undispatched_count > 0`).
- **Completed:** Cases where all required checklist documents have been both received and dispatched (`missing_count = 0 AND undispatched_count = 0 AND required_count > 0`).
- **Needs Setup ("No Required Documents"):** Cases with zero required documents configured (`required_count = 0`). These can never evaluate to Completed.
- **Overdue:** Cases whose statutory cycle due date has elapsed and are not completed. Note: Overdue is an orthogonal urgency dimension; an overdue case is simultaneously in `Awaiting Documents` or `Pending Dispatch` or `Needs Setup`.
- **Due Today:** Cases due on today's date in `Asia/Kolkata` that are not completed.

---

### 2.3 Document-Level Metrics (Selected Month, Active Firms Only)

Source View: `public.case_document_status`  
Joined via `cases c` and `firms f`: `c.period_month = :selected_month AND f.is_active = true` (and `cd.removed_at IS NULL`).

| Metric Identifier | Dashboard Card Label | Status in `case_document_status` | Precise SQL Filter Condition | Destination Link |
| :--- | :--- | :--- | :--- | :--- |
| `docs_received_not_dispatched` | **Received - Not Dispatched** | `'Received - Not Dispatched'` | `status = 'Received - Not Dispatched'` | `/pending?month=:selected_month&status=received_not_dispatched` |
| `docs_awaiting_receipt` | **Awaiting Receipt** | `'Awaiting Receipt'` | `status = 'Awaiting Receipt'` | `/pending?month=:selected_month&status=awaiting_receipt` |

#### Detailed Logic:
- **Received - Not Dispatched:** Documents that have been marked as received by staff (`received_at IS NOT NULL`), but are not part of any active outward dispatch docket (`NOT EXISTS active non-voided dispatch item`).
- **Awaiting Receipt:** Documents in active cases that have not yet been delivered by the client firm (`received_at IS NULL`).
- **Pending Queue Scope:** The total pending documents queue is the sum:
  $$\text{Total Pending Documents} = \text{Received - Not Dispatched} + \text{Awaiting Receipt}$$
  Dispatched documents are excluded from `/pending`.

---

### 2.4 Staff Workload Metrics ("Workload by Employee")

Source Views: `public.case_status`, `public.case_document_status`, and `public.profiles`.  
Aggregated by `assigned_to` profile (with `Unassigned` bucket for cases where `assigned_to IS NULL`).

For each employee (in selected month, active firms only):
1. **Assigned Cases:** `COUNT(case_id)`
2. **Awaiting Docs:** `COUNT(case_id) FILTER (WHERE status = 'Awaiting Documents')`
3. **Pending Dispatch:** `COUNT(case_id) FILTER (WHERE status = 'Pending Dispatch')`
4. **Completed Cases:** `COUNT(case_id) FILTER (WHERE status = 'Completed')`
5. **Overdue Cases:** `COUNT(case_id) FILTER (WHERE is_overdue = true)`
6. **Pending Docs:** Count of unremoved, undispatched documents belonging to cases assigned to this employee.

---

## 3. Seed Scenario Reference Values (Baseline Test Expectations)

Based on `supabase/seed.sql` for the current month (`2026-10-01`):

### Firms:
- **Apex Logistics Pvt Ltd:** `is_active = true`
- **Bharat Engineering Works:** `is_active = true`
- **Cauvery Textiles & Garments:** `is_active = true`
- **Doon Valley Agro Foods:** `is_active = true`
- **Evergreen Solar Solutions:** `is_active = false` (ARCHIVED)
- **Active Firms Count:** **`4`**

### Seed Cases:
- **Case A (Apex Logistics, A_11th, due 11th):** 5 required, all dispatched $\to$ `Completed`, not overdue.
- **Case B (Bharat Engineering, B_20th, due 20th):** 5 required received, 4 dispatched $\to$ `Pending Dispatch` (1 undispatched doc), not overdue.
- **Case C (Cauvery Textiles, A_11th, due 11th):** 5 required, 3 received, 2 missing $\to$ `Awaiting Documents`, **`is_overdue = true`**.
- **Case D (Doon Valley Agro, B_20th, due 20th):** 5 required, all dispatched (2 batches) $\to$ `Completed`, not overdue.
- **Case E (Apex Logistics, B_20th, due 20th):** 5 required received, 0 dispatched $\to$ `Pending Dispatch` (5 undispatched docs), not overdue.
- **Case F (Bharat Engineering, A_11th, due 11th):** 4 required dispatched, 1 optional unreceived $\to$ `Completed`, not overdue.
- **Case G (Cauvery Textiles, B_20th, due 20th):** 0 documents $\to$ `No Required Documents` ("Needs setup"), not overdue.
- **Case H (Evergreen Solar, A_11th, due 11th):** Archived firm $\to$ **EXCLUDED from all active metrics**.

### Summary Matrix for Current Month Seed:
| Metric | Expected Seed Value | Contributing Entities |
| :--- | :--- | :--- |
| **Active Firms** | **4** | Apex, Bharat, Cauvery, Doon |
| **Firms Needing Attention** | **1** | Cauvery (Case C is overdue) |
| **Awaiting Documents** | **1** | Case C |
| **Pending Dispatch** | **2** | Case B, Case E |
| **Completed** | **3** | Case A, Case D, Case F |
| **Needs Setup** | **1** | Case G |
| **Overdue Cases** | **1** | Case C |
| **Due Today Cases** | **0** | (None due on 19th; Case C due 11th, B/D/E/G due 20th) |
| **Received - Not Dispatched Docs** | **9** | Case B: 1 doc; Case C: 3 docs; Case E: 5 docs |
| **Awaiting Receipt Docs** | **3** | Case C: 2 docs; Case F: 1 optional doc |
| **Total Active Seed Cases** | **7** | Cases A, B, C, D, E, F, G |

---

## 4. Cross-Page Consistency Guarantees

FinanceFlow strictly enforces cross-page number consistency:
$$\text{Dashboard Card Count} = \text{Rows returned in the pre-filtered target list}$$

Specifically:
- The count on **`Awaiting Documents`** card ($N$) equals the total count displayed on `/cases?month=...&status=Awaiting+Documents`.
- The count on **`Pending Dispatch`** card ($N$) equals the total count on `/cases?month=...&status=Pending+Dispatch`.
- The count on **`Overdue Cases`** card ($N$) equals the total count on `/cases?month=...&overdue=true`.
- The count on **`Received - Not Dispatched`** card ($N$) equals the total count on `/pending?month=...&status=received_not_dispatched`.
- The count on **`Awaiting Receipt`** card ($N$) equals the total count on `/pending?month=...&status=awaiting_receipt`.
- The count on **`Active Firms`** card ($N$) equals the active count on `/firms`.
