import type { Metadata } from 'next'
import { EmptyStateCard } from '@/components/EmptyStateCard'

export const metadata: Metadata = {
  title: 'Dashboard | FinanceFlow',
  description: 'FinanceFlow accounts office overview and activity dashboard',
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Office Overview &amp; Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Welcome to FinanceFlow &mdash; Document Tracking and Dispatch Management for accounts offices.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Pending Dispatches
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">0</span>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm border border-amber-200">
              STATUS: PENDING SETUP
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Awaiting Phase 3 dispatch module
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Cases
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">0</span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200">
              STATUS: READY FOR PHASE 2
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Awaiting Phase 2 database schema
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Registered Firms
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">0</span>
            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
              STATUS: SKELETON
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Awaiting Phase 2 client firm records
          </p>
        </div>
      </div>

      <EmptyStateCard
        title="Recent Office Activity"
        subtitle="Tracking document handoffs, acknowledgments, and outgoing dispatches"
        phaseText="PHASE 1 SKELETON"
        description="No office activity recorded yet. In later phases, this section will stream live updates of documents received, inward stamps, court/tribunal submissions, and speed post dispatches."
        plannedFeatures={[
          'Real-time timeline of incoming bills, notices, and client records',
          'Document dispatch tracking with Speed Post & Courier tracking IDs',
          'Automated reminders for urgent compliance dates and pending queries',
        ]}
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        )}
      />
    </div>
  )
}
