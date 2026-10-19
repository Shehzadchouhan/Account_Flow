# FinanceFlow — Phase 6 Verification & Test Guide

> **Phase 6:** Dashboard, Pending Work Queue, Search, & Cross-Page Consistency  
> **Testing Scope:** Database Migration 8 (`supabase/migrations/20261019000008_phase6_indexes_and_views.sql`), Automated Database Assertions (`supabase/tests/phase6_metrics_and_pending.sql`), and End-to-End User Journey Tests.

---

## 1. Automated Database Verification Script (SQL Editor)

Run the script below directly in your **Supabase Dashboard SQL Editor**. It executes inside a transaction and ends with `ROLLBACK`, guaranteeing zero residual changes to your database while executing all 8 operational assertions.

```sql
-- Run supabase/tests/phase6_metrics_and_pending.sql in Supabase SQL Editor
\i supabase/tests/phase6_metrics_and_pending.sql
```

### Assertions Tested:
1. **Baseline Seed Scenario Counts:** Validates exact expected counts for current month active seed data (4 active firms, 1 firm needing attention, 1 awaiting docs, 2 pending dispatch, 3 completed, 1 needs setup, 1 overdue, 9 received-not-dispatched, 3 awaiting receipt).
2. **Archived Firm Exclusion:** Asserts that archived firm `Evergreen Solar Solutions` is strictly excluded from `case_status` and `case_document_status` active views.
3. **Dynamic Metric Transition on Document Receipt:** Validates that receiving documents on Case C dynamically increments `Received - Not Dispatched`, decrements `Awaiting Receipt`, and transitions the case from `Awaiting Documents` to `Pending Dispatch`.
4. **Dynamic Metric Transition on Dispatch Creation:** Validates that dispatching Case C transitions it to `Completed`, decrements `Pending Dispatch`, eliminates the overdue state, and reduces firms needing attention from 1 to 0.
5. **Dynamic Metric Transition on Dispatch Voiding:** Validates that voiding the dispatch immediately restores Case C to `Pending Dispatch`, restores its `is_overdue = true` status, and increments firms needing attention back to 1.
6. **Due Today Dynamic Metric Evaluation:** Verifies that a case due on `(now() AT TIME ZONE 'Asia/Kolkata')::date` increments `cases_due_today` and contributes to firms needing attention.
7. **Cross-Page Consistency Guarantees:** Asserts mathematical equality between case document view counts and case status view sums.
8. **Workload Partition Integrity:** Validates that the sum of partitioned employee cases equals the total monthly active cases.

---

## 2. End-to-End Manual UI Verification Matrix

### Test Suite 1: Dashboard (`/`) Month Selector & Urgency Monitors

| Test ID | Action | Expected Result | Pass Criteria |
| :--- | :--- | :--- | :--- |
| **UI-6.1** | Navigate to `/` | Dashboard renders with Month Selector defaulting to current month in `Asia/Kolkata`. | Month selector shows current month; all cards populate with live counts. |
| **UI-6.2** | Inspect **Active Firms** card | Displays `4` distinct clients. | Clicking card navigates to `/firms`. |
| **UI-6.3** | Inspect **Firms Needing Attention** card | Displays `1` (Cauvery Textiles & Garments). | Clicking card navigates to `/cases?month=2026-10-01&attention=true`. |
| **UI-6.4** | Inspect **Overdue Cases** card | Displays `1` (Case C). Urgent red styling. | Clicking card navigates to `/cases?month=2026-10-01&overdue=true`. |
| **UI-6.5** | Change month selector to prior month | URL updates to `/?month=YYYY-MM-01`. All cards refresh to that month's data. | Zero hardcoded counts; empty state appears if no cases exist. |

---

### Test Suite 2: Case Compliance Cards & Cross-Page Consistency

| Test ID | Dashboard Card | Target URL | Expected Row Count in List | Consistency Check |
| :--- | :--- | :--- | :--- | :--- |
| **UI-6.6** | **Awaiting Documents** (`1`) | `/cases?month=2026-10-01&status=Awaiting+Documents` | Exactly 1 case (Cauvery A_11th) | **PASS:** Card count = List count |
| **UI-6.7** | **Pending Dispatch** (`2`) | `/cases?month=2026-10-01&status=Pending+Dispatch` | Exactly 2 cases (Bharat B_20th, Apex B_20th) | **PASS:** Card count = List count |
| **UI-6.8** | **Completed** (`3`) | `/cases?month=2026-10-01&status=Completed` | Exactly 3 cases (Apex A_11th, Doon B_20th, Bharat A_11th) | **PASS:** Card count = List count |
| **UI-6.9** | **Needs Setup** (`1`) | `/cases?month=2026-10-01&status=No+Required+Documents` | Exactly 1 case (Cauvery B_20th) | **PASS:** Card count = List count |
| **UI-6.10** | **Received - Not Dispatched** (`9`) | `/pending?month=2026-10-01&status=received_not_dispatched` | Exactly 9 documents | **PASS:** Card count = List count |
| **UI-6.11** | **Awaiting Receipt** (`3`) | `/pending?month=2026-10-01&status=awaiting_receipt` | Exactly 3 documents | **PASS:** Card count = List count |

---

### Test Suite 3: Pending Work Queue (`/pending`)

| Test ID | Action | Expected Result | Pass Criteria |
| :--- | :--- | :--- | :--- |
| **UI-6.12** | Open `/pending` | Table displays one row per pending checklist item with: Client Firm, Case Month/Cycle, Document Name, Status Badge, Plain-language reason, Due Date, Overdue label, and Assignee. | Table renders with 12 total pending documents (9 received-not-dispatched + 3 awaiting-receipt). |
| **UI-6.13** | Verify plain-language reasons | Rows with `Received - Not Dispatched` display `"Received but not dispatched"`. Rows with `Awaiting Receipt` display `"Awaiting receipt from firm"`. | Plain-language reason pill matches document receipt status. |
| **UI-6.14** | Click "Filter to My Work" button | URL updates to `/pending?my_work=true`. List filters to documents assigned to current logged-in user. | Employee dropdown is disabled; active filter pill appears. |
| **UI-6.15** | Filter by Firm: `Apex Logistics` | List filters to only Apex pending documents (5 docs). | Exactly 5 rows returned. |
| **UI-6.16** | Sort by Due Date: `due_date_desc` | Rows reorder with latest statutory deadlines first. | Sorting preserves all active filters. |
| **UI-6.17** | Click "View Case &rarr;" on any row | Navigates directly to `/cases/[case_id]`. | Destination case details screen opens. |

---

### Test Suite 4: Workload by Employee Table

| Test ID | Action | Expected Result | Pass Criteria |
| :--- | :--- | :--- | :--- |
| **UI-6.18** | Inspect "Workload by Employee" table on `/` | Rows list each active staff member plus `Unassigned` if any unassigned cases exist. | Table shows Assigned Cases, Awaiting Docs, Pending Dispatch, Completed, Overdue Cases, and Pending Docs. |
| **UI-6.19** | Sum check across columns | Sum of Assigned Cases across rows = Total Cases (7). Sum of Pending Docs across rows = Total Pending Docs (12). | Zero discrepancy between summary cards and employee breakdown. |
| **UI-6.20** | Click "Inspect cases &rarr;" on an employee | Navigates to `/cases?month=2026-10-01&employee=[id]`. | Pre-filtered list for that employee renders. |

---

### Test Suite 5: Global Search Box (Header)

| Test ID | Action | Expected Result | Pass Criteria |
| :--- | :--- | :--- | :--- |
| **UI-6.21** | Press `Ctrl+K` or `/` anywhere | Header search input gains focus automatically. | Hotkey works across all application views. |
| **UI-6.22** | Type `"Apex"` | Debounced server search triggers; floating dropdown renders with Apex under **Client Firms** and Apex compliance dockets under **Compliance Cases**. | Max 5 items per category; click navigates to entity. |
| **UI-6.23** | Type `"Sales"` | Dropdown renders under **Checklist Documents** listing Sales Registers across cases. | Each document row links to its case. |
| **UI-6.24** | Type non-existent query `"xyz999"` | Dropdown renders clean empty state: *"No matching firms, cases, or documents found"*. | No errors; polite empty state. |
| **UI-6.25** | Press `Esc` or click outside | Search dropdown closes immediately. | Clean dismissal. |
