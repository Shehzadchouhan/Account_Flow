import type { Metadata } from 'next'
import { EmptyStateCard } from '@/components/EmptyStateCard'

export const metadata: Metadata = {
  title: 'Cases & Matters | FinanceFlow',
  description: 'Manage legal, tax, and audit cases across client firms',
}

export default function CasesPage() {
  return (
    <div className="space-y-6">
      <EmptyStateCard
        title="Cases &amp; Matters"
        subtitle="Repository of assessment matters, appeals, notices, and financial dockets"
        phaseText="PLANNED FOR PHASE 3"
        description="No cases recorded yet. In Phase 3, this module will enable office staff to organize files by case number, client firm, financial year, and department authority."
        plannedFeatures={[
          'Detailed case profiles with DIN/Notice numbers and assessment years',
          'Document attachments: assessment orders, scrutiny letters, appeal forms',
          'Chronological hearing dates, submission logs, and hearing officer records',
          'Multi-firm linking and related case grouping',
        ]}
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        )}
      />
    </div>
  )
}
