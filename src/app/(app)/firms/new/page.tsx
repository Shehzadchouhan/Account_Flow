import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/utils/auth'
import { createClient } from '@/utils/supabase/server'
import { FirmCreateForm } from './FirmCreateForm'

export const metadata: Metadata = {
  title: 'Add Client Firm | FinanceFlow',
  description: 'Register a new client firm in the office directory',
}

export default async function NewFirmPage() {
  await requireAdmin()

  const supabase = await createClient()
  const { data: staffMembers } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <nav className="flex items-center text-sm font-medium text-slate-500">
        <Link href="/firms" className="hover:text-slate-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Client Firms
        </Link>
      </nav>

      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Add New Client Firm
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter company details and assign a default office staff member. You can configure checklist templates on the next screen.
        </p>
      </div>

      {/* Form Container */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <FirmCreateForm staffMembers={staffMembers || []} />
      </div>
    </div>
  )
}
