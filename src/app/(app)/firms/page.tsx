import type { Metadata } from 'next'
import { EmptyStateCard } from '@/components/EmptyStateCard'

export const metadata: Metadata = {
  title: 'Client Firms | FinanceFlow',
  description: 'Manage client firms, GSTINs, PANs, and primary contact persons',
}

export default function FirmsPage() {
  return (
    <div className="space-y-6">
      <EmptyStateCard
        title="Client Firms &amp; Companies"
        subtitle="Directory of client entities, tax identifiers, and contact persons"
        phaseText="PLANNED FOR PHASE 2"
        description="No client firms added yet. In Phase 2, this directory will store firm profiles, PAN, GSTIN, registered addresses, and communication logs."
        plannedFeatures={[
          'Firm directory with searchable PAN, GSTIN, and legal business name',
          'Primary contacts: directors, partners, accountants, and phone/email',
          'Firm-level document history and dispatch address presets for speed post/courier',
          'Document vault linking all filings and correspondence per firm',
        ]}
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        )}
      />
    </div>
  )
}
