import type { Metadata } from 'next'
import { EmptyStateCard } from '@/components/EmptyStateCard'

export const metadata: Metadata = {
  title: 'Pending Work | FinanceFlow',
  description: 'Track urgent tasks, pending filings, and inward documents awaiting review',
}

export default function PendingWorkPage() {
  return (
    <div className="space-y-6">
      <EmptyStateCard
        title="Pending Work &amp; Follow-ups"
        subtitle="Operational queue for accounting documents, vouchers, and pending replies"
        phaseText="PLANNED FOR PHASE 3"
        description="No pending work items registered. In Phase 3, this screen will prioritize tasks by due date, urgency level, and assigned staff member."
        plannedFeatures={[
          'Prioritized queues for GST filings, income tax responses, and audit vouchers',
          'Status tracking with explicit text labels: PENDING, IN-REVIEW, DISPATCHED, COMPLETED',
          'Staff assignment, internal notes, and supervisor sign-offs',
          'Overdue alert badges and automatic follow-up reminders',
        ]}
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      />
    </div>
  )
}
