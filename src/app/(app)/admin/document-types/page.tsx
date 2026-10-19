import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/utils/auth'
import { createClient } from '@/utils/supabase/server'
import { DocumentTypeManager } from './DocumentTypeManager'

export const metadata: Metadata = {
  title: 'Document Types Master | FinanceFlow',
  description: 'Manage master document types checklist dictionary',
}

export default async function DocumentTypesPage() {
  await requireAdmin()

  const supabase = await createClient()
  const { data: documentTypes, error } = await supabase
    .from('document_types')
    .select('id, name, description, is_active, created_at')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm font-medium text-slate-500">
        <Link href="/admin" className="hover:text-slate-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Administration
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-900 font-semibold">Document Types</span>
      </nav>

      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Document Types Master Catalog
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Master registry of compliance documents, registers, and tax filings configured for firm checklist templates
        </p>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load document types: {error.message}
        </div>
      ) : (
        <DocumentTypeManager documentTypes={documentTypes || []} />
      )}
    </div>
  )
}
