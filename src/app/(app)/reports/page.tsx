import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/utils/auth'
import {
  getReportData,
  type ReportType,
  type ReportFilterParams,
} from '@/lib/reports-data'
import { ReportsViewer } from './ReportsViewer'

export const metadata: Metadata = {
  title: 'Reports & Export Center | FinanceFlow',
  description: 'Auditable compliance registers, dispatch records, and pendency analytics with Excel/CSV export',
}

interface ReportsPageProps {
  searchParams: Promise<{
    report?: string
    firm_id?: string
    employee?: string
    document_type_id?: string
    status?: string
    due_date_from?: string
    due_date_to?: string
    cycle?: string
    month?: string
  }>
}

function getMonthOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = []
  const today = new Date()

  for (let i = -11; i <= 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const value = `${y}-${m}-01`
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    options.push({ label, value })
  }

  return options
}

const VALID_REPORTS: ReportType[] = [
  'pending_documents',
  'completed_cases',
  'dispatch_history',
  'work_by_employee',
  'received_not_dispatched',
  'overdue_cases',
]

export default async function ReportsPage(props: ReportsPageProps) {
  // 1. Authenticate user (all active staff and admin have access)
  await requireAuth()
  const searchParams = await props.searchParams
  const supabase = await createClient()

  // 2. Resolve active report selection
  const rawReport = searchParams.report as ReportType | undefined
  const activeReport: ReportType =
    rawReport && VALID_REPORTS.includes(rawReport) ? rawReport : 'pending_documents'

  const filters: ReportFilterParams = {
    firm_id: searchParams.firm_id,
    employee: searchParams.employee,
    document_type_id: searchParams.document_type_id,
    status: searchParams.status,
    cycle: searchParams.cycle,
    month: searchParams.month,
    due_date_from: searchParams.due_date_from,
    due_date_to: searchParams.due_date_to,
  }

  // 3. Parallel fetch of dropdown metadata and active report dataset
  const [firmsRes, staffRes, docTypesRes, dataset] = await Promise.all([
    supabase.from('firms').select('id, name').order('name', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    supabase.from('document_types').select('id, name').order('name', { ascending: true }),
    getReportData(supabase, activeReport, filters),
  ])

  const firms = firmsRes.data || []
  const staff = staffRes.data || []
  const documentTypes = docTypesRes.data || []
  const monthOptions = getMonthOptions()

  return (
    <ReportsViewer
      activeReport={activeReport}
      filters={filters}
      dataset={dataset}
      firms={firms}
      staff={staff}
      documentTypes={documentTypes}
      monthOptions={monthOptions}
    />
  )
}
