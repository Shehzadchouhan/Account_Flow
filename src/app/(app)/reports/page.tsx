import type { Metadata } from 'next'
import { EmptyStateCard } from '@/components/EmptyStateCard'

export const metadata: Metadata = {
  title: 'Reports & Registers | FinanceFlow',
  description: 'Inward registers, dispatch records, and pending compliance reports',
}

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <EmptyStateCard
        title="Reports &amp; Dispatch Registers"
        subtitle="Auditable registers of all incoming physical files and outgoing consignments"
        phaseText="PLANNED FOR PHASE 5"
        description="No reports generated yet. In Phase 5, this reporting engine will generate periodic inward registers, speed post logs, courier summaries, and pendency analytics."
        plannedFeatures={[
          'Daily and monthly Inward Document Register export (PDF/Excel)',
          'Postal & Courier Dispatch Register with consignment numbers and delivery proofs',
          'Staff pendency reports: files pending review over 7, 15, and 30 days',
          'Audit trail reports showing user edits, date stamps, and dispatch statuses',
        ]}
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      />
    </div>
  )
}
