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
  const [params, role, supabase] = await Promise.all([
    props.params,
    getCurrentUserRole(),
    createClient(),
  ])
  const caseId = params.id
  const isAdmin = role === 'admin'

  // 1. Fetch case status and metrics from calculated view
  const caseRecordQuery = supabase
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

  const documentsQuery = supabase
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
      status,
      file_url,
      file_name,
      file_size,
      file_type
    `
    )
    .eq('case_id', caseId)
    .order('is_required', { ascending: false })
    .order('document_type_name', { ascending: true })

  const staffMembersQuery = supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const availableDocumentTypesQuery = supabase
    .from('document_types')
    .select('id, name, description')
    .eq('is_active', true)
    .order('name', { ascending: true })

  const recipientQuery = supabase.rpc('get_distinct_recipients')

  const dispatchesQuery = supabase
    .from('dispatches')
    .select(`
      id,
      case_id,
      recipient,
      sent_at,
      recorded_by,
      email_reference,
      receipt_file_url,
      receipt_file_name,
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

  const [
    { data: caseRecord, error: caseError },
    { data: documentsData },
    { data: staffMembers },
    { data: availableDocumentTypes },
    { data: recipientData },
    { data: dispatchesData },
  ] = await Promise.all([
    caseRecordQuery,
    documentsQuery,
    staffMembersQuery,
    availableDocumentTypesQuery,
    recipientQuery,
    dispatchesQuery,
  ])

  if (caseError || !caseRecord) {
    notFound()
  }

  // 2. Fetch firm contact info for reminder emails
  const { data: firmRecord } = await supabase
    .from('firms')
    .select('contact_person, contact_email, contact_phone')
    .eq('id', caseRecord.firm_id)
    .single()
  const distinctRecipients = (recipientData as string[]) || []

  const caseHeaderData = caseRecord as unknown as CaseHeaderData
  const documents = (documentsData as unknown as CaseDocumentItem[]) || []
  const dispatches = (dispatchesData as unknown as CaseDispatchItem[]) || []

  // Compute missing required document names
  const missingDocuments = documents
    .filter((doc) => doc.is_required && !doc.received_at)
    .map((doc) => doc.document_type_name)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Case Header */}
      <CaseHeader
        caseData={caseHeaderData}
        firmContact={firmRecord}
        missingDocuments={missingDocuments}
      />

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
        firmName={caseHeaderData.firm_name}
        firmContact={firmRecord}
      />
    </div>
  )
}
