import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/utils/auth'
import { FirmImporter } from './FirmImporter'

export const metadata: Metadata = {
  title: 'Batch Firm Import | FinanceFlow',
  description: 'Upload Excel (.xlsx) or CSV (.csv) files to import client firms and document templates',
}

export default async function AdminImportPage() {
  await requireAdmin()

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              &larr; Back to Administration
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Batch Client Firm Importer
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Import client firms, contact profiles, default staff assignments, and compliance checklist templates in bulk
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold shrink-0">
          <span className="h-2 w-2 rounded-full bg-purple-600 shrink-0" aria-hidden="true" />
          <span>ADMINISTRATOR ONLY</span>
        </div>
      </div>

      {/* Main Importer View */}
      <FirmImporter />
    </div>
  )
}
