# FinanceFlow Authorization Matrix & Security Policy

This document provides the authoritative audit and reference specification for access control across all pages, server actions, route handlers, and database operations in FinanceFlow.

---

## 1. Security Architecture & Defense-in-Depth

FinanceFlow enforces security through three coordinated layers:

```
[ Layer 1: Client / Browser ]
          │
          ▼
[ Layer 2: Next.js Server Layer ]
  ├─ Edge Proxy / Middleware: Session cookie validation
  ├─ Page Components: requireAuth() / requireAdmin() redirects
  ├─ Server Actions: assertAuth() / assertAdmin() structured errors
  └─ Route Handlers: assertAuth() / assertAdmin() HTTP 401 / 403 responses
          │
          ▼
[ Layer 3: PostgreSQL Database Engine ]
  ├─ Row-Level Security (RLS) on all 8 tables
  ├─ Helper Functions: public.is_active_user(), public.is_admin()
  ├─ SECURITY DEFINER RPCs with parameter verification
  └─ Integrity Triggers: Append-only ledger, last-admin lock, dispatch immutability
```

---

## 2. Server Actions Matrix

| File Path | Action Name | Allowed Roles | Enforcement Mechanism | Failure Response (Staff / Inactive / Unauthenticated) |
| :--- | :--- | :--- | :--- | :--- |
| `src/app/auth/actions.ts` | `login` | Public | Credentials verify via Supabase Auth | `{ success: false, error: 'Invalid login credentials' }` |
| `src/app/auth/actions.ts` | `logout` | Authenticated | Supabase `auth.signOut()` | Redirect to `/login` |
| `src/app/actions/search.ts` | `searchGlobal` | Active Staff & Admin | `assertAuth()` + RLS on tables | `{ success: false, error: 'Unauthorized: ...' }` |
| `src/app/(app)/cases/actions.ts` | `generateCasesAction` | Admin Only | `assertAdmin()` + `public.is_admin()` in RPC | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/cases/actions.ts` | `updateCaseDetailsAction` | Admin Only | `assertAdmin()` + `public.is_admin()` in RPC | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/cases/actions.ts` | `addCaseDocumentAction` | Admin Only | `assertAdmin()` + `public.is_admin()` in RPC | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/cases/actions.ts` | `removeCaseDocumentAction` | Admin Only | `assertAdmin()` + `public.is_admin()` in RPC | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/cases/actions.ts` | `setDocumentRequiredAction` | Admin Only | `assertAdmin()` + `public.is_admin()` in RPC | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/cases/actions.ts` | `receiveDocumentAction` | Active Staff & Admin | `assertAuth()` + `public.is_active_user()` | `{ success: false, error: 'Unauthorized: ...' }` |
| `src/app/(app)/cases/actions.ts` | `unreceiveDocumentAction` | Active Staff & Admin | `assertAuth()` + `public.is_active_user()` | `{ success: false, error: 'Unauthorized: ...' }` |
| `src/app/(app)/cases/actions.ts` | `bulkReceiveDocumentsAction` | Active Staff & Admin | `assertAuth()` + `public.is_active_user()` | `{ success: false, error: 'Unauthorized: ...' }` |
| `src/app/(app)/cases/actions.ts` | `updateCaseNotesAction` | Active Staff & Admin | `assertAuth()` + `public.is_active_user()` | `{ success: false, error: 'Unauthorized: ...' }` |
| `src/app/(app)/cases/dispatch-actions.ts` | `createDispatchAction` | Active Staff & Admin | `assertAuth()` + `public.is_active_user()` | `{ success: false, error: 'Unauthorized: ...' }` |
| `src/app/(app)/cases/dispatch-actions.ts` | `voidDispatchAction` | Admin Only | `assertAdmin()` + `public.is_admin()` in RPC | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/cases/dispatch-actions.ts` | `getDistinctRecipientsAction` | Active Staff & Admin | `assertAuth()` + `public.is_active_user()` | Returns `[]` |
| `src/app/(app)/firms/actions.ts` | `createFirmAction` | Admin Only | `assertAdmin()` + RLS check | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/firms/actions.ts` | `updateFirmAction` | Admin Only | `assertAdmin()` + RLS check | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/firms/actions.ts` | `toggleFirmActiveAction` | Admin Only | `assertAdmin()` + RLS check | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/firms/actions.ts` | `addTemplateItemAction` | Admin Only | `assertAdmin()` + RLS check | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/firms/actions.ts` | `updateTemplateItemAction` | Admin Only | `assertAdmin()` + RLS check | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/firms/actions.ts` | `removeTemplateItemAction` | Admin Only | `assertAdmin()` + RLS check | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/admin/users/actions.ts` | `updateUserProfileAction` | Admin Only | `assertAdmin()` + RLS & Trigger Guard | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/admin/document-types/actions.ts` | `createDocumentTypeAction` | Admin Only | `assertAdmin()` + RLS check | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/admin/document-types/actions.ts` | `updateDocumentTypeAction` | Admin Only | `assertAdmin()` + RLS check | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/admin/document-types/actions.ts` | `toggleDocumentTypeActiveAction` | Admin Only | `assertAdmin()` + RLS check | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/admin/import/actions.ts` | `parseImportAction` | Admin Only | `assertAdmin()` server-side guard | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |
| `src/app/(app)/admin/import/actions.ts` | `confirmImportAction` | Admin Only | `assertAdmin()` + `public.is_admin()` in RPC | `{ success: false, error: 'Forbidden: Administrator privileges required.' }` |

---

## 3. Route Handlers Matrix

| Route URL | HTTP Method | Allowed Roles | Enforcement Layer | Unauthenticated Response | Staff / Inactive Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/admin/template` | GET | Admin Only | `assertAdmin()` | HTTP 401 Unauthorized | HTTP 403 Forbidden |
| `/api/reports/export` | GET | Active Staff & Admin | `assertAuth()` + RLS views | HTTP 401 Unauthorized | HTTP 401 / 403 Error |

---

## 4. Application Pages Matrix

| Page URL | Description | Allowed Roles | Enforcement Mechanism | Unauthenticated Redirection | Staff / Inactive Redirection |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | Authentication Portal | Public | Inverted guard (`getCurrentUser()`) | N/A (Shows form) | Redirects to `/` if already logged in |
| `/` | Operational Compliance Dashboard | Active Staff & Admin | `requireAuth()` | Redirects to `/login` | Inactive redirects to `/login?error=account_deactivated` |
| `/pending` | Document-level Pending Work Queue | Active Staff & Admin | `requireAuth()` | Redirects to `/login` | Inactive redirects to `/login?error=account_deactivated` |
| `/pending-work` | Route Alias for Pending Work Queue | Active Staff & Admin | Next.js redirect to `/pending` | Redirects to `/login` | Inactive redirects to `/login?error=account_deactivated` |
| `/cases` | Compliance Cases Register | Active Staff & Admin | `requireAuth()` | Redirects to `/login` | Inactive redirects to `/login?error=account_deactivated` |
| `/cases/[id]` | Case Detail, Checklist & Dispatch Hub | Active Staff & Admin | `requireAuth()` | Redirects to `/login` | Inactive redirects to `/login?error=account_deactivated` |
| `/dispatches` | Outbound Dispatch History Register | Active Staff & Admin | `requireAuth()` | Redirects to `/login` | Inactive redirects to `/login?error=account_deactivated` |
| `/firms` | Client Firms Directory | Active Staff & Admin | `requireAuth()` | Redirects to `/login` | Inactive redirects to `/login?error=account_deactivated` |
| `/firms/[id]` | Firm Detail & Template Configuration | Active Staff & Admin | `requireAuth()` | Redirects to `/login` | Inactive redirects to `/login?error=account_deactivated` |
| `/firms/new` | Register New Client Firm | Admin Only | `requireAdmin()` | Redirects to `/login` | Staff redirects to `/` |
| `/reports` | Compliance Reports & Export Center | Active Staff & Admin | `requireAuth()` | Redirects to `/login` | Inactive redirects to `/login?error=account_deactivated` |
| `/admin` | Administration Control Center | Admin Only | `requireAdmin()` | Redirects to `/login` | Staff redirects to `/` |
| `/admin/users` | User & Role Management | Admin Only | `requireAdmin()` | Redirects to `/login` | Staff redirects to `/` |
| `/admin/document-types` | Master Document Type Catalog | Admin Only | `requireAdmin()` | Redirects to `/login` | Staff redirects to `/` |
| `/admin/generate-cases` | Monthly Case Docket Generator | Admin Only | `requireAdmin()` | Redirects to `/login` | Staff redirects to `/` |
| `/admin/import` | Excel/CSV Batch Firm Importer | Admin Only | `requireAdmin()` | Redirects to `/login` | Staff redirects to `/` |
| `/admin/activity` | System Activity & Forensic Audit Log | Admin Only | `requireAdmin()` | Redirects to `/login` | Staff redirects to `/` |

---

## 5. Deactivated User & Revocation Policy

When an administrator toggles an employee's account to inactive (`is_active = false`):
1. **Database Layer (RLS)**: PostgreSQL helper function `public.is_active_user()` immediately returns `false` for all session JWTs matching `auth.uid() = profile.id`. RLS prevents selecting or modifying any firms, cases, documents, or dispatches.
2. **Server Action Layer**: Every server action calls `assertAuth()` or `assertAdmin()`, which inspects `profile.is_active`. Deactivated accounts immediately fail with:
   `Unauthorized: Account is deactivated.`
3. **Page Navigation Layer**: `requireAuth()` inspects `profile.is_active` on every request. Deactivated accounts are immediately redirected to `/login?error=account_deactivated`.

---

## 6. Hardening & Gap Analysis Completed

| Security Item | Before Phase 8 | Hardened in Phase 8 |
| :--- | :--- | :--- |
| **Inactive Session Handling** | Allowed `requireAuth()` to pass if valid Supabase JWT existed, relying solely on DB RLS | `getCurrentUserProfile()` actively queries `is_active`; immediately blocks actions and redirects pages |
| **Server Action Error Consistency** | `requireAdmin()` called `redirect('/')`, throwing `NEXT_REDIRECT` which converted to inconsistent text in actions | `assertAdmin()` throws explicit `Forbidden: Administrator privileges required.` Error caught cleanly by action state handlers |
| **Global Search Access** | Called `getCurrentUserRole()` without validating active session | Added `await assertAuth()` to `searchGlobal` |
| **API Template Route** | Always returned status 403 on catch | Maps unauthenticated errors to 401 and forbidden roles to 403 |
| **Audit Log Ledger Route** | Route did not exist | Created `/admin/activity` with admin-only guard, filter parameters, and entity deep-links |
