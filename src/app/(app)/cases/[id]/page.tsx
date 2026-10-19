import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserRole } from '@/utils/auth'
import { CaseHeader, type CaseHeaderData } from './CaseHeader'
import { CaseSettingsEditor } from './CaseSettingsEditor'
import { CaseChecklistTable, type CaseDocumentItem } from './CaseChecklistTable'
import { CaseDispatchHistory, type CaseDispatchItem } from './CaseDispatchHistory'

interface CaseDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata(props: CaseDetailPageProps): Promise<Metadata> {
  const params = await props.params
  const supabase = await createClient()
  const { data: c } = await supabase
    .from('case_status')
    .select('firm_name, period_month, cycle')
    .eq('case_id', params.id)
    .single()

  if (!c) {
    return { title: 'Case Details | FinanceFlow' }
  }

  const month = new Date(`${c.period_month}T00:00:00Z`).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return {
    title: `${c.firm_name} (${month} • ${c.cycle}) | FinanceFlow`,
  }
}

export default async function CaseDetailPage(props: CaseDetailPageProps) {
  const params = await props.params
  const caseId = params.id

  const role = await getCurrentUserRole()
  const isAdmin = role === 'admin'

  const supabase = await createClient()

  // 1. Fetch case status and metrics from calculated view
  const { data: caseRecord, error: caseError } = await supabase
    .from('case_status')
    .select(
      `
      case_id,
      firm_id,
      firm_name,
      firm_is_active,
      period_month,
      cycle,
      due_date,
      assigned_to,
      version,
      required_count,
      received_count,
      dispatched_count,
      missing_count,
      undispatched_count,
      status,
      is_overdue,
      profiles:profiles!cases_assigned_to_fkey(full_name)
    `
    )
    .eq('case_id', caseId)
    .single()

  if (caseError || !caseRecord) {
    notFound()
  }

  // 2. Fetch documents from case_document_status view
  const { data: documentsData } = await supabase
    .from('case_document_status')
    .select(
      `
      case_document_id,
      case_id,
      firm_id,
      document_type_id,
      document_type_name,
      is_required,
      received_at,
      received_by,
      notes,
      created_at,
      status
    `
    )
    .eq('case_id', caseId)
    .order('is_required', { ascending: false })
    .order('document_type_name', { ascending: true })

  // 3. Fetch active team members for assignee dropdown
  const { data: staffMembers } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  // 4. Fetch active document types for adding documents to case
  const { data: availableDocumentTypes } = await supabase
    .from('document_types')
    .select('id, name, description')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // 5. Fetch distinct recipient suggestions for outward dispatch autocomplete
  const { data: recipientData } = await supabase.rpc('get_distinct_recipients')
  const distinctRecipients = (recipientData as string[]) || []

  // 6. Fetch outward dispatches history for this case
  const { data: dispatchesData } = await supabase
    .from('dispatches')
    .select(`
      id,
      case_id,
      recipient,
      sent_at,
      recorded_by,
      email_reference,
      idempotency_key,
      voided_at,
      voided_by,
      void_reason,
      created_at,
      recorder:profiles!dispatches_recorded_by_fkey(full_name),
      voider:profiles!dispatches_voided_by_fkey(full_name),
      dispatch_items(
        id,
        is_active,
        case_document_id,
        case_document:case_documents(
          id,
          document_type:document_types(name)
        )
      )
    `)
    .eq('case_id', caseId)
    .order('sent_at', { ascending: false })

  const caseHeaderData = caseRecord as unknown as CaseHeaderData
  const documents = (documentsData as unknown as CaseDocumentItem[]) || []
  const dispatches = (dispatchesData as unknown as CaseDispatchItem[]) || []

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Case Header */}
      <CaseHeader caseData={caseHeaderData} />

      {/* Admin Case Settings Drawer (Due Date & Assignee) */}
      {isAdmin && (
        <CaseSettingsEditor
          caseId={caseHeaderData.case_id}
          dueDate={caseHeaderData.due_date}
          assignedTo={caseHeaderData.assigned_to}
          version={caseHeaderData.version}
          staffMembers={staffMembers || []}
        />
      )}

      {/* Document Checklist Table */}
      <CaseChecklistTable
        caseId={caseHeaderData.case_id}
        firmName={caseHeaderData.firm_name}
        periodMonth={caseHeaderData.period_month}
        cycle={caseHeaderData.cycle}
        documents={documents}
        availableDocumentTypes={availableDocumentTypes || []}
        distinctRecipients={distinctRecipients}
        isAdmin={isAdmin}
      />

      {/* Outward Dispatch History & Admin Voiding */}
      <CaseDispatchHistory
        caseId={caseHeaderData.case_id}
        dispatches={dispatches}
        isAdmin={isAdmin}
      />
    </div>
  )
}
