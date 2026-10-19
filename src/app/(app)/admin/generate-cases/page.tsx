import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/utils/auth'
import { CaseGeneratorForm } from './CaseGeneratorForm'

export const metadata: Metadata = {
  title: 'Generate Monthly Cases | FinanceFlow',
  description: 'Generate compliance dockets for active client firms with preview and dry run',
}

export default async function GenerateCasesPage() {
  await requireAdmin()

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center text-sm font-medium text-slate-500">
        <Link href="/admin" className="hover:text-slate-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Administration
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-900 font-semibold">Generate Cases</span>
      </nav>

      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Monthly Case Generator
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Generate compliance cycle dockets for all active client firms. Copies checklist templates into operational cases with dry-run verification.
        </p>
      </div>

      <CaseGeneratorForm />
    </div>
  )
}
