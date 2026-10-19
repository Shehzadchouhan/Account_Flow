# Phase 7 — Excel/CSV Import and Export Test & Verification Guide

This document defines the implementation architecture, automated verification suite, and manual validation procedures for **Phase 7: Excel/CSV Import and Export**.

---

## 1. Library Selection & Security Audit

### 1.1 Evaluated Libraries
- **`xlsx` (SheetJS)**:
  - Evaluation: The official npm release `xlsx` is notoriously outdated with unpatched high-severity prototype pollution and Regular Expression Denial of Service (ReDoS) CVEs (`GHSA-4r6h-8v6p-xvw6`). Furthermore, parsing formulas without careful sandbox constraints can lead to code execution or memory exhaustion.
- **`exceljs` (Selected: `exceljs@4.4.0`)**:
  - Evaluation: Actively maintained, native streaming support, robust handling of `.xlsx` and `.csv`, and full TypeScript definitions.
  - Formula Safety: Explicitly configured to extract string values only (`cell.text` / `cell.value`) and **never evaluate formulas**.

### 1.2 `npm audit` Findings & Analysis
Running `npm audit` against `exceljs@4.4.0`:
- **Finding**: 1 moderate vulnerability flagged in transitive sub-dependency `uuid@8.3.2`.
- **Vulnerability Details**: Buffer bounds oversight when using `uuid.v3`, `uuid.v5`, or `uuid.v6` with explicit typed byte arrays.
- **Mitigation & Exploitability Analysis**:
  1. `exceljs` internally uses only `uuid.v4()` (random UUIDs) to assign relationship IDs (`rId1`, `rId2`) in OpenXML parts without custom byte buffers.
  2. `uuid.v3`, `uuid.v5`, and `uuid.v6` are never invoked anywhere in `exceljs` or the FinanceFlow codebase.
  3. Consequently, this vulnerability is completely unexploitable in runtime production.

---

## 2. Security Guarantees

### 2.1 Formula Injection Protection (CSV / Excel Neutralization)
To prevent formula injection attacks (CSV Injection / Formula Injection) where malicious text such as `=1+1`, `=cmd|' /C ...'!A0`, `-5+2`, `+A1`, `@SUM(...)`, or leading tabs/carriage returns execute when opened in Microsoft Excel or Google Sheets:
- Every cell value passed to `generateExcelBuffer` and `generateCsvString` is sanitized using `sanitizeCellForFormulaInjection`.
- Any string beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically escaped with a leading single quote (`'`).
- Valid numeric data (e.g. numeric integers and decimals) is preserved as true numbers without string quoting.

### 2.2 Access Control & Audit Trails
- **Import (`/admin/import`)**:
  - Restricted to active administrators only (`requireAdmin()` in server action, plus `public.is_admin()` SQL guard in `import_firms_batch`).
  - Non-administrators and staff are rejected with HTTP 403 / PostgreSQL exception.
  - Every batch import records an entry in `activity_logs` with `entity_type: 'firms'`, `action: 'import_firms'`, and payload detailing `{ imported_count, skipped_count, created_doc_types }`.
- **Export (`/reports` & `/api/reports/export`)**:
  - Accessible to all active users (`requireAuth()` and `public.is_active_user()`).
  - Inactive users are rejected.
  - Every export invocation writes an audit log entry via `public.log_export_activity` with `{ report, filters, row_count }`.

---

## 3. Core Features Implemented

### 3.1 Admin Batch Firm Importer (`/admin/import`)
1. **File Upload**: Supports `.xlsx` and `.csv`. Enforces maximum 5 MB and maximum 2,000 rows. Rejects any other format or oversized file with user-friendly errors.
2. **Downloadable Templates**: Provided at `/api/admin/template?format=xlsx` and `/api/admin/template?format=csv` with official columns:
   - `Firm Name` (Required)
   - `Contact Person`
   - `Email`
   - `Phone`
   - `Default Employee Email`
   - `Required Documents` (Comma-separated)
   - `Optional Documents` (Comma-separated)
3. **Pre-flight Preview Engine**:
   - Parses the entire file on the server without modifying the database.
   - Categorizes every single row into:
     - `Valid`
     - `Missing name`
     - `Duplicate within file`
     - `Already exists`
     - `Invalid email`
     - `Unknown employee`
     - `Unknown document type`
   - Shows live category count badges, filterable tabs, and pagination preview.
4. **Unknown Document Type Handling**:
   - Lists unknown document types detected in the uploaded file.
   - If admin ticks "Auto-create missing document types", they are inserted into `public.document_types` and attached to firm templates.
   - If not ticked, rows with unknown document types are safely skipped.
5. **Atomic Commit & Error Report**:
   - On confirmation, executes `public.import_firms_batch` in **one atomic database transaction**.
   - If problem rows exist, they are skipped and listed in a downloadable CSV Error Report detailing `Row Number`, `Firm Name`, `Status`, and `Reason`. Nothing is silently dropped.
6. **Re-import Idempotency**:
   - Uploading the same file again skips existing firms without failing or creating duplicates.

### 3.2 Compliance Reports & Export Center (`/reports`)
1. **6 Official Reports Supported**:
   - `Pending Documents`: Backlog of items awaiting receipt or dispatch.
   - `Completed Cases`: Fully cleared cases with all dispatches completed.
   - `Dispatch History`: Complete outbound dispatch register with recipient CA/reviewers and tracking notes.
   - `Work by Employee`: Staff-level distribution of cases, pendencies, and completions.
   - `Received But Not Dispatched`: Operational bottleneck list of received files.
   - `Overdue Cases`: Cases that have passed their statutory due date.
2. **Identical Query Views**: Reads from `case_document_status`, `case_status`, and `dispatches` ensuring 100% agreement with the Dashboard.
3. **Interactive UI & Direct Download**:
   - Live on-screen preview table (first 50 records) with status badges and column widths.
   - Excel (`.xlsx`) and CSV (`.csv`) one-click downloads.
   - Auto-generated standard filename: `FinanceFlow_{ReportName}_{YYYY-MM-DD}.{ext}`.

---

## 4. Automated SQL Test Suite

The automated verification suite is located at:
`supabase/tests/phase7_import_export.sql`

It executes 8 assertions inside an atomic transaction and terminates with `ROLLBACK;`, ensuring zero test data pollution.

### Test Assertions Covered
| Assertion | Description | Expected Outcome |
| :--- | :--- | :--- |
| **Assertion 1** | Security Guard: Non-admin & inactive users call `import_firms_batch` | Access Denied exception thrown; import prevented |
| **Assertion 2** | Messy Batch Processing (blank names, duplicates, ghost employee emails) | Imports 1 valid firm, skips 3 invalid rows without transaction failure |
| **Assertion 3** | Template Items & Default Assignee Persistence | Default staff assigned; required & optional template items linked |
| **Assertion 4** | Unknown Document Type Auto-Creation | Created when confirmed=true; rejected/skipped when confirmed=false |
| **Assertion 5** | Re-import Idempotency | Re-importing identical batch imports 0 firms and creates 0 duplicates |
| **Assertion 6** | Batch Import Audit Logging | `activity_logs` entry created with `import_firms` and accurate counts |
| **Assertion 7** | Export Audit Logging & Permissions | Active user logs export; inactive user denied |
| **Assertion 8** | Cross-Check of All 6 Report Views | All 6 queries execute successfully and match database schema |

### How to Run in Supabase SQL Editor
1. Open the Supabase Dashboard -> **SQL Editor**.
2. Paste the contents of `supabase/tests/phase7_import_export.sql`.
3. Click **Run**.
4. Verify the output log displays:
   ```text
   ALL 8 PHASE 7 AUTOMATED VERIFICATIONS PASSED SUCCESSFULLY!
   ```

---

## 5. Manual UI Verification Matrix

| Step | Test Action | Expected Result |
| :--- | :--- | :--- |
| 1 | Navigate to `/admin/import` as Admin | Page loads with template download buttons, drag-and-drop dropzone, and guidelines |
| 2 | Click "Download Template (.xlsx)" | Downloads `FinanceFlow_Firms_Import_Template.xlsx` with sample data and columns |
| 3 | Upload invalid file (e.g. `.pdf` or file > 5 MB) | Dropzone rejects file with clear validation error message |
| 4 | Upload valid template with 1 new firm, 1 duplicate, 1 blank name | Pre-flight preview displays 1 Valid, 1 Already exists, 1 Missing name |
| 5 | Click "Confirm Import" | Atomically imports valid firm, updates status, and offers Error Report CSV download |
| 6 | Click "Download Error Report (CSV)" | Downloads CSV listing the skipped rows and exact reasons |
| 7 | Re-upload the exact same file | Preview flags the newly imported firm as "Already exists"; confirm skips it safely |
| 8 | Navigate to `/reports` as Staff member | Page loads showing 6 report tabs and active filters |
| 9 | Select "Pending Documents" tab | Preview table updates with pending documents; record count badge displays total |
| 10 | Click "Export Excel (.xlsx)" | Downloads `FinanceFlow_Pending_Documents_YYYY-MM-DD.xlsx` with styled headers |
| 11 | Click "Export CSV (.csv)" | Downloads `FinanceFlow_Pending_Documents_YYYY-MM-DD.csv` with formula injection escaped |
| 12 | Check `activity_logs` in database | Entries logged for both import and export events with full metadata |
