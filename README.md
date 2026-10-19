# FinanceFlow

**Document Tracking & Dispatch Management Web Application**

FinanceFlow is a tailored web application designed for small finance, taxation, and accounts offices in India. It streamlines tracking of inward client documents (books of accounts, physical vouchers, assessment notices) and outward dispatches (replies, appeals, Speed Post, and private courier consignments).

---

## 📌 Features & Scope

### Phase 1 (Current Skeleton)
- **Modern Next.js Architecture:** Built with Next.js App Router, React 19, TypeScript, and Tailwind CSS.
- **Supabase Authentication Helpers:** Ready-to-connect browser, server, and middleware clients via `@supabase/ssr` and `@supabase/supabase-js`.
- **Strict Route Protection:** Protected routes enforced at both the Next.js middleware and server layout levels.
- **Role-Based Access Skeleton:** Integrated `getCurrentUserRole()` helper (with Phase 2 database integration stubs) and a server-side `requireAdmin()` guard protecting the Admin page.
- **Responsive Business Layout:** High-contrast desktop sidebar navigation and a mobile top menu with touch-friendly tap targets (&ge; 44px).
- **Accessible UI:** Accessible form controls, visible keyboard focus indicators, explicit text-plus-color status indicators, and informative empty states for all main sections.

---

## 🗺️ Roadmap of Planned Phases

| Phase | Title | Key Objectives |
|---|---|---|
| **Phase 1** (Current) | **Project Setup & Skeleton** | Next.js App Router, Tailwind CSS, Supabase SSR helpers, auth layout, route guards, and placeholders. |
| **Phase 2** | **Supabase Schema & Profiles** | Create PostgreSQL tables (`profiles`, `firms`, `audit_logs`), configure Row Level Security (RLS), and implement actual user roles (`admin` / `staff`). |
| **Phase 3** | **Cases & Inward Document Tracking** | Document receipt workflow, client firm association, notice/DIN indexing, and assigned staff task queues. |
| **Phase 4** | **Dispatch & Courier Management** | Outgoing parcel logs, India Post Speed Post tracking numbers, private courier integrations (Blue Dart/DTDC), and dispatch receipts. |
| **Phase 5** | **Reports, Registers & Compliance** | Statutory inward registers, dispatch summaries, pending compliance reports, and audit trail exports. |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: LTS version (v20+ or v24+)
- **npm**: v10+

### 1. Installation
Clone the repository and install the dependencies:
```bash
npm install
```

### 2. Environment Configuration
Copy the example environment configuration file:
```bash
cp .env.local.example .env.local
```
*(On Windows PowerShell: `Copy-Item .env.local.example .env.local`)*

Open `.env.local` and provide your Supabase project credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```
> **Security Note:** `.env.local` is listed in `.gitignore` and must never be committed to source control. Never log secrets or user credentials.

### 3. Running the Development Server
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

- Visiting `/` when unauthenticated will automatically redirect you to `/login`.
- The login form provides access to authorized staff members.

### 4. Building for Production
To create a production-optimized build:
```bash
npm run build
```
To run the production server:
```bash
npm run start
```

### 5. Linting
To run the ESLint checks:
```bash
npm run lint
```

---

## 📂 Project Directory Structure

```text
├── src/
│   ├── app/
│   │   ├── (app)/               # Authenticated application route group
│   │   │   ├── layout.tsx       # Server-side auth guard & AppLayoutNav wrapper
│   │   │   ├── page.tsx         # Dashboard overview (/)
│   │   │   ├── pending-work/    # Pending work queue (/pending-work)
│   │   │   ├── cases/           # Case & matters management (/cases)
│   │   │   ├── firms/           # Client firms directory (/firms)
│   │   │   ├── reports/         # Dispatch registers & reports (/reports)
│   │   │   └── admin/           # Administration panel (/admin) - guarded by requireAdmin()
│   │   ├── auth/
│   │   │   └── actions.ts       # Server Actions for login and logout
│   │   ├── login/
│   │   │   └── page.tsx         # Accessible email + password login portal (/login)
│   │   ├── globals.css          # Tailwind CSS configuration and theme variables
│   │   └── layout.tsx           # Root HTML layout and typography
│   ├── components/
│   │   ├── AppLayoutNav.tsx     # Responsive desktop sidebar & mobile navigation menu
│   │   ├── EmptyStateCard.tsx   # Empty state card with text+color status badges
│   │   └── LoginForm.tsx        # Accessible login form with validation and loading states
│   ├── middleware.ts            # Next.js middleware for session refresh & route protection
│   └── utils/
│       ├── auth.ts              # getCurrentUser(), getCurrentUserRole(), requireAdmin()
│       └── supabase/
│           ├── client.ts        # Browser-side Supabase client factory
│           ├── server.ts        # Server-side Supabase client factory (cookies)
│           └── middleware.ts    # Middleware session updater
├── .env.local.example           # Example environment template
├── .gitignore                   # Git ignore rules protecting environment files
├── package.json                 # Project dependencies & scripts
├── tsconfig.json                # TypeScript compiler configuration
└── README.md                    # Project documentation
```

---

## 🔒 Security & Accessibility Rules
- **Server and Middleware Protection:** Authentication is checked in `middleware.ts` and double-checked on the server via `requireAuth()` and `requireAdmin()`.
- **Text + Color Indicators:** Status badges display explicit textual status labels (e.g., `STATUS: PLANNED FOR PHASE 2`) alongside color for accessibility.
- **Large Tap Targets:** Touch targets on mobile navigation and buttons maintain a minimum dimension of 44x44px.
