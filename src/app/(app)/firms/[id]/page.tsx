import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserRole } from '@/utils/auth'
import { FirmDetailsEditor } from './FirmDetailsEditor'
import { FirmTemplateEditor, type TemplateItem } from './FirmTemplateEditor'

interface FirmDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata(props: FirmDetailPageProps): Promise<Metadata> {
  const params = await props.params
  const supabase = await createClient()
  const { data: firm } = await supabase
    .from('firms')
    .select('name')
    .eq('id', params.id)
    .single()

  return {
    title: firm ? `${firm.name} | Client Firm | FinanceFlow` : 'Firm Details | FinanceFlow',
  }
}

export default async function FirmDetailPage(props: FirmDetailPageProps) {
  const params = await props.params
  const firmId = params.id

  const [role, supabase] = await Promise.all([
    getCurrentUserRole(),
    createClient(),
  ])
  const isAdmin = role === 'admin'

  // 1. Fetch Firm record
  const firmQuery = supabase
    .from('firms')
    .select(
      `
      id,
      name,
      contact_person,
      contact_email,
      contact_phone,
      default_employee,
      is_active,
      created_at,
      updated_at,
      profiles:profiles!firms_default_employee_fkey(id, full_name)
    `
    )
    .eq('id', firmId)
    .single()

  // 2. Fetch configured checklist template items
  const templateItemsQuery = supabase
    .from('firm_template_items')
    .select(
      `
      id,
      firm_id,
      document_type_id,
      is_required,
      document_types:document_types(id, name, description, is_active)
    `
    )
    .eq('firm_id', firmId)

  // 3. Fetch active document types in the catalog
  const availableDocumentTypesQuery = supabase
    .from('document_types')
    .select('id, name, description, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // 4. Fetch active office staff members for default employee reassignment
  const staffMembersQuery = supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const [
    { data: firm, error: firmError },
    { data: templateItems },
    { data: availableDocumentTypes },
    { data: staffMembers },
  ] = await Promise.all([
    firmQuery,
    templateItemsQuery,
    availableDocumentTypesQuery,
    staffMembersQuery,
  ])

  if (firmError || !firm) {
    notFound()
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation Breadcrumb */}
      <nav className="flex items-center text-sm font-medium text-slate-500">
        <Link href="/firms" className="hover:text-slate-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Client Firms
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-900 font-semibold">{firm.name}</span>
      </nav>

      {/* Firm Profile & Contact Editor */}
      <FirmDetailsEditor
        firm={firm}
        staffMembers={staffMembers || []}
        isAdmin={isAdmin}
      />

      {/* Checklist Template Editor */}
      <FirmTemplateEditor
        firmId={firm.id}
        firmName={firm.name}
        templateItems={(templateItems as unknown as TemplateItem[]) || []}
        availableDocumentTypes={availableDocumentTypes || []}
        isAdmin={isAdmin}
      />
    </div>
  )
}
