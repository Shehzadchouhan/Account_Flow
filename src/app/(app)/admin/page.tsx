import type { Metadata } from 'next'
import { requireAdmin } from '@/utils/auth'
import { EmptyStateCard } from '@/components/EmptyStateCard'

export const metadata: Metadata = {
  title: 'Administration | FinanceFlow',
  description: 'Manage staff roles, office configuration, and master system settings',
}

export default async function AdminPage() {
  // Server-side guard: enforce admin role authorization
  const user = await requireAdmin()

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Administration &amp; Access Controls
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Guarded by server-side <code className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-sm font-mono text-xs">requireAdmin()</code> check.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" aria-hidden="true" />
          <span>ACCESS GRANTED: ADMIN ({user.email})</span>
        </div>
      </div>

      <EmptyStateCard
        title="Staff &amp; Master Data Management"
        subtitle="Configure user roles, dispatch courier partners, and tax jurisdictions"
        phaseText="PLANNED FOR PHASE 2"
        description="No administration settings configured yet. In Phase 2, administrators will manage user permissions ('admin' vs 'staff'), assign firm access, and configure office parameters."
        plannedFeatures={[
          'User Management: Invite staff members and assign roles (admin/staff)',
          'Profile Table Administration (Phase 2 schema)',
          'Courier Partners Master: Speed Post, Blue Dart, DTDC, Professional Couriers',
          'Document Type Categories: Assessment Orders, Show-cause Notices, Audit Books, Bank Statements',
        ]}
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      />
    </div>
  )
}
