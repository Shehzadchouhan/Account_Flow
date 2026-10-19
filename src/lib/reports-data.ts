import { SupabaseClient } from '@supabase/supabase-js'
import {
  formatDateIST,
  formatDateTimeIST,
  formatMonthYear,
} from '@/lib/date-utils'
import type { ColumnDefinition } from './export-utils'
import type {
  Database,
  CaseCycle,
  CaseDocumentStatusType,
  CaseStatusType,
  UserRole,
} from '@/types/database.types'

export type ReportType =
  | 'pending_documents'
  | 'completed_cases'
  | 'dispatch_history'
  | 'work_by_employee'
  | 'received_not_dispatched'
  | 'overdue_cases'

export interface ReportFilterParams {
  firm_id?: string
  employee?: string
  document_type_id?: string
  status?: string
  cycle?: string
  month?: string
  due_date_from?: string
  due_date_to?: string
}

export interface ReportDataset {
  reportName: string
  sheetTitle: string
  columns: ColumnDefinition[]
  data: Record<string, unknown>[]
}

interface CaseDocRow {
  case_document_id: string
  case_id: string
  firm_id: string
  firm_name: string
  firm_is_active: boolean
  period_month: string
  cycle: CaseCycle
  due_date: string
  assigned_to: string | null
  assigned_to_name: string | null
  document_type_id: string
  document_type_name: string
  is_required: boolean
  received_at: string | null
  status: CaseDocumentStatusType
  is_overdue: boolean
}

interface CaseStatusRow {
  case_id: string
  firm_name: string
  period_month: string
  cycle: CaseCycle
  due_date: string
  required_count: number
  received_count: number
  dispatched_count: number
  missing_count: number
  undispatched_count: number
  status: CaseStatusType
  assigned_to?: string | null
  is_overdue?: boolean
  profiles: { full_name: string } | null
}

interface DispatchRow {
  id: string
  case_id: string
  recipient: string
  sent_at: string
  email_reference: string | null
  voided_at: string | null
  void_reason: string | null
  cases: {
    period_month: string
    cycle: string
    firms: { name: string }
  } | null
  profiles: { full_name: string } | null
}

interface ProfileRow {
  id: string
  full_name: string
  role: UserRole
}

/**
 * Fetches and formats data for any of the 6 official FinanceFlow compliance reports.
 * Reads strictly from the same database views used by Dashboard and operational views.
 */
export async function getReportData(
  supabase: SupabaseClient<Database>,
  reportType: ReportType,
  filters: ReportFilterParams
): Promise<ReportDataset> {
  const firmFilter = filters.firm_id && filters.firm_id !== 'all' ? filters.firm_id : null
  const employeeFilter = filters.employee && filters.employee !== 'all' ? filters.employee : null
  const docTypeFilter = filters.document_type_id && filters.document_type_id !== 'all' ? filters.document_type_id : null
  const statusFilter = filters.status && filters.status !== 'all' ? filters.status : null
  const cycleFilter = filters.cycle && filters.cycle !== 'all' ? filters.cycle : null
  const monthFilter = filters.month && filters.month !== 'all' ? filters.month : null

  switch (reportType) {
    // -------------------------------------------------------------------------
    // 1. Pending Documents Report
    // -------------------------------------------------------------------------
    case 'pending_documents': {
      let query = supabase
        .from('case_document_status')
        .select('*')
        .eq('firm_is_active', true)
        .neq('status', 'Dispatched')

      if (firmFilter) query = query.eq('firm_id', firmFilter)
      if (employeeFilter === 'unassigned') {
        query = query.is('assigned_to', null)
      } else if (employeeFilter) {
        query = query.eq('assigned_to', employeeFilter)
      }
      if (docTypeFilter) query = query.eq('document_type_id', docTypeFilter)
      if (statusFilter === 'received_not_dispatched') {
        query = query.eq('status', 'Received - Not Dispatched')
      } else if (statusFilter === 'awaiting_receipt') {
        query = query.eq('status', 'Awaiting Receipt')
      }
      if (cycleFilter) query = query.eq('cycle', cycleFilter as CaseCycle)
      if (monthFilter) query = query.eq('period_month', monthFilter)
      if (filters.due_date_from) query = query.gte('due_date', filters.due_date_from)
      if (filters.due_date_to) query = query.lte('due_date', filters.due_date_to)

      const { data: rawRows, error } = await query
        .order('due_date', { ascending: true })
        .order('firm_name', { ascending: true })

      if (error) throw new Error(error.message)
      const rows = (rawRows || []) as unknown as CaseDocRow[]

      const columns: ColumnDefinition[] = [
        { header: 'Client Firm', key: 'firm_name', width: 28 },
        { header: 'Period Month', key: 'period_month', width: 15 },
        { header: 'Cycle', key: 'cycle', width: 14 },
        { header: 'Document Name', key: 'document_type_name', width: 24 },
        { header: 'Requirement', key: 'is_required', width: 14 },
        { header: 'Status', key: 'status', width: 22 },
        { header: 'Operational Reason', key: 'plain_reason', width: 26 },
        { header: 'Due Date (IST)', key: 'due_date', width: 15 },
        { header: 'Overdue', key: 'is_overdue', width: 12 },
        { header: 'Assigned Employee', key: 'assigned_to_name', width: 22 },
      ]

      const formatted = rows.map((r) => ({
        firm_name: r.firm_name,
        period_month: formatMonthYear(r.period_month),
        cycle: r.cycle === 'A_11th' ? 'Cycle A (11th)' : 'Cycle B (20th)',
        document_type_name: r.document_type_name,
        is_required: r.is_required ? 'Required' : 'Optional',
        status: r.status,
        plain_reason:
          r.status === 'Received - Not Dispatched'
            ? 'Received but not dispatched'
            : 'Awaiting receipt from firm',
        due_date: formatDateIST(r.due_date),
        is_overdue: r.is_overdue ? 'YES (OVERDUE)' : 'No',
        assigned_to_name: r.assigned_to_name || 'Unassigned',
      }))

      return {
        reportName: 'Pending_Documents',
        sheetTitle: 'Pending Documents',
        columns,
        data: formatted,
      }
    }

    // -------------------------------------------------------------------------
    // 2. Completed Cases Report
    // -------------------------------------------------------------------------
    case 'completed_cases': {
      let query = supabase
        .from('case_status')
        .select(`
          case_id, firm_name, period_month, cycle, due_date,
          required_count, received_count, dispatched_count, status,
          profiles:profiles!cases_assigned_to_fkey(full_name)
        `)
        .eq('firm_is_active', true)
        .eq('status', 'Completed')

      if (firmFilter) query = query.eq('firm_id', firmFilter)
      if (employeeFilter === 'unassigned') {
        query = query.is('assigned_to', null)
      } else if (employeeFilter) {
        query = query.eq('assigned_to', employeeFilter)
      }
      if (cycleFilter) query = query.eq('cycle', cycleFilter as CaseCycle)
      if (monthFilter) query = query.eq('period_month', monthFilter)

      const { data: rawRows, error } = await query
        .order('period_month', { ascending: false })
        .order('firm_name', { ascending: true })

      if (error) throw new Error(error.message)
      const rows = (rawRows || []) as unknown as CaseStatusRow[]

      const columns: ColumnDefinition[] = [
        { header: 'Client Firm', key: 'firm_name', width: 28 },
        { header: 'Period Month', key: 'period_month', width: 15 },
        { header: 'Cycle', key: 'cycle', width: 14 },
        { header: 'Due Date (IST)', key: 'due_date', width: 15 },
        { header: 'Required Docs', key: 'required_count', width: 15 },
        { header: 'Received Docs', key: 'received_count', width: 15 },
        { header: 'Dispatched Docs', key: 'dispatched_count', width: 16 },
        { header: 'Compliance Status', key: 'status', width: 18 },
        { header: 'Assigned Employee', key: 'assigned_to_name', width: 22 },
      ]

      const formatted = rows.map((r) => {
        const staff = r.profiles
        return {
          firm_name: r.firm_name,
          period_month: formatMonthYear(r.period_month),
          cycle: r.cycle === 'A_11th' ? 'Cycle A (11th)' : 'Cycle B (20th)',
          due_date: formatDateIST(r.due_date),
          required_count: r.required_count,
          received_count: r.received_count,
          dispatched_count: r.dispatched_count,
          status: r.status,
          assigned_to_name: staff?.full_name || 'Unassigned',
        }
      })

      return {
        reportName: 'Completed_Cases',
        sheetTitle: 'Completed Cases',
        columns,
        data: formatted,
      }
    }

    // -------------------------------------------------------------------------
    // 3. Dispatch History Report
    // -------------------------------------------------------------------------
    case 'dispatch_history': {
      let query = supabase.from('dispatches').select(`
        id, case_id, recipient, sent_at, email_reference, voided_at, void_reason,
        cases!inner (
          period_month, cycle,
          firms!inner (id, name)
        ),
        profiles:profiles!dispatches_recorded_by_fkey (full_name)
      `)

      if (firmFilter) {
        query = query.eq('cases.firms.id', firmFilter)
      }
      if (monthFilter) {
        query = query.eq('cases.period_month', monthFilter)
      }
      if (cycleFilter) {
        query = query.eq('cases.cycle', cycleFilter as CaseCycle)
      }
      if (statusFilter === 'active') {
        query = query.is('voided_at', null)
      } else if (statusFilter === 'voided') {
        query = query.not('voided_at', 'is', null)
      }

      const { data: rawRows, error } = await query.order('sent_at', { ascending: false })
      if (error) throw new Error(error.message)
      const rows = (rawRows || []) as unknown as DispatchRow[]

      const columns: ColumnDefinition[] = [
        { header: 'Client Firm', key: 'firm_name', width: 28 },
        { header: 'Compliance Period', key: 'period_month', width: 16 },
        { header: 'Cycle', key: 'cycle', width: 14 },
        { header: 'Recipient CA / Reviewer', key: 'recipient', width: 30 },
        { header: 'Dispatched At (IST)', key: 'sent_at', width: 22 },
        { header: 'Email / Post Reference', key: 'email_reference', width: 25 },
        { header: 'Recorded By', key: 'recorded_by_name', width: 20 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Void Reason', key: 'void_reason', width: 25 },
      ]

      const formatted = rows.map((d) => {
        const c = d.cases
        const recorder = d.profiles
        return {
          firm_name: c?.firms?.name || 'Unknown',
          period_month: formatMonthYear(c?.period_month),
          cycle: c?.cycle === 'A_11th' ? 'Cycle A (11th)' : 'Cycle B (20th)',
          recipient: d.recipient,
          sent_at: formatDateTimeIST(d.sent_at),
          email_reference: d.email_reference || '—',
          recorded_by_name: recorder?.full_name || 'System User',
          status: d.voided_at ? 'VOIDED' : 'ACTIVE',
          void_reason: d.void_reason || '—',
        }
      })

      return {
        reportName: 'Dispatch_History',
        sheetTitle: 'Dispatch History',
        columns,
        data: formatted,
      }
    }

    // -------------------------------------------------------------------------
    // 4. Work by Employee Report
    // -------------------------------------------------------------------------
    case 'work_by_employee': {
      const selectedMonth = monthFilter || new Date().toISOString().slice(0, 7) + '-01'

      const [staffRes, casesRes, docsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
        supabase
          .from('case_status')
          .select('case_id, assigned_to, status, is_overdue')
          .eq('period_month', selectedMonth)
          .eq('firm_is_active', true),
        supabase
          .from('case_document_status')
          .select('case_document_id, assigned_to, status')
          .eq('period_month', selectedMonth)
          .eq('firm_is_active', true)
          .neq('status', 'Dispatched'),
      ])

      const staffList = (staffRes.data || []) as unknown as ProfileRow[]
      const cases = (casesRes.data || []) as unknown as CaseStatusRow[]
      const docs = (docsRes.data || []) as unknown as CaseDocRow[]

      const map = new Map<string | null, Record<string, unknown>>()
      staffList.forEach((s) => {
        map.set(s.id, {
          employee_name: s.full_name,
          role: s.role.toUpperCase(),
          period_month: formatMonthYear(selectedMonth),
          total_cases: 0,
          awaiting_docs: 0,
          pending_dispatch: 0,
          completed: 0,
          overdue_cases: 0,
          pending_docs: 0,
        })
      })

      map.set(null, {
        employee_name: 'Unassigned',
        role: 'UNASSIGNED',
        period_month: formatMonthYear(selectedMonth),
        total_cases: 0,
        awaiting_docs: 0,
        pending_dispatch: 0,
        completed: 0,
        overdue_cases: 0,
        pending_docs: 0,
      })

      cases.forEach((c) => {
        const row = map.get(c.assigned_to || null) || map.get(null)!
        row.total_cases = (row.total_cases as number) + 1
        if (c.status === 'Awaiting Documents') row.awaiting_docs = (row.awaiting_docs as number) + 1
        if (c.status === 'Pending Dispatch') row.pending_dispatch = (row.pending_dispatch as number) + 1
        if (c.status === 'Completed') row.completed = (row.completed as number) + 1
        if (c.is_overdue) row.overdue_cases = (row.overdue_cases as number) + 1
      })

      docs.forEach((d) => {
        const row = map.get(d.assigned_to) || map.get(null)!
        row.pending_docs = (row.pending_docs as number) + 1
      })

      const columns: ColumnDefinition[] = [
        { header: 'Employee Name', key: 'employee_name', width: 22 },
        { header: 'Role', key: 'role', width: 14 },
        { header: 'Period Month', key: 'period_month', width: 15 },
        { header: 'Total Assigned Cases', key: 'total_cases', width: 20 },
        { header: 'Awaiting Docs', key: 'awaiting_docs', width: 16 },
        { header: 'Pending Dispatch', key: 'pending_dispatch', width: 16 },
        { header: 'Completed Cases', key: 'completed', width: 16 },
        { header: 'Overdue Cases', key: 'overdue_cases', width: 16 },
        { header: 'Pending Documents', key: 'pending_docs', width: 18 },
      ]

      const data = Array.from(map.values()).filter(
        (r) => (r.total_cases as number) > 0 || r.employee_name !== 'Unassigned'
      )

      return {
        reportName: 'Work_By_Employee',
        sheetTitle: 'Workload by Employee',
        columns,
        data,
      }
    }

    // -------------------------------------------------------------------------
    // 5. Received But Not Dispatched Report
    // -------------------------------------------------------------------------
    case 'received_not_dispatched': {
      let query = supabase
        .from('case_document_status')
        .select('*')
        .eq('firm_is_active', true)
        .eq('status', 'Received - Not Dispatched')

      if (firmFilter) query = query.eq('firm_id', firmFilter)
      if (employeeFilter === 'unassigned') {
        query = query.is('assigned_to', null)
      } else if (employeeFilter) {
        query = query.eq('assigned_to', employeeFilter)
      }
      if (docTypeFilter) query = query.eq('document_type_id', docTypeFilter)
      if (cycleFilter) query = query.eq('cycle', cycleFilter as CaseCycle)
      if (monthFilter) query = query.eq('period_month', monthFilter)

      const { data: rawRows, error } = await query
        .order('due_date', { ascending: true })
        .order('firm_name', { ascending: true })

      if (error) throw new Error(error.message)
      const rows = (rawRows || []) as unknown as CaseDocRow[]

      const columns: ColumnDefinition[] = [
        { header: 'Client Firm', key: 'firm_name', width: 28 },
        { header: 'Period Month', key: 'period_month', width: 15 },
        { header: 'Cycle', key: 'cycle', width: 14 },
        { header: 'Document Name', key: 'document_type_name', width: 24 },
        { header: 'Received At (IST)', key: 'received_at', width: 20 },
        { header: 'Due Date (IST)', key: 'due_date', width: 15 },
        { header: 'Overdue', key: 'is_overdue', width: 12 },
        { header: 'Assigned Employee', key: 'assigned_to_name', width: 22 },
      ]

      const formatted = rows.map((r) => ({
        firm_name: r.firm_name,
        period_month: formatMonthYear(r.period_month),
        cycle: r.cycle === 'A_11th' ? 'Cycle A (11th)' : 'Cycle B (20th)',
        document_type_name: r.document_type_name,
        received_at: formatDateTimeIST(r.received_at),
        due_date: formatDateIST(r.due_date),
        is_overdue: r.is_overdue ? 'YES (OVERDUE)' : 'No',
        assigned_to_name: r.assigned_to_name || 'Unassigned',
      }))

      return {
        reportName: 'Received_Not_Dispatched',
        sheetTitle: 'Received Not Dispatched',
        columns,
        data: formatted,
      }
    }

    // -------------------------------------------------------------------------
    // 6. Overdue Cases Report
    // -------------------------------------------------------------------------
    case 'overdue_cases': {
      let query = supabase
        .from('case_status')
        .select(`
          case_id, firm_name, period_month, cycle, due_date,
          required_count, missing_count, undispatched_count, status,
          profiles:profiles!cases_assigned_to_fkey(full_name)
        `)
        .eq('firm_is_active', true)
        .eq('is_overdue', true)

      if (firmFilter) query = query.eq('firm_id', firmFilter)
      if (employeeFilter === 'unassigned') {
        query = query.is('assigned_to', null)
      } else if (employeeFilter) {
        query = query.eq('assigned_to', employeeFilter)
      }
      if (cycleFilter) query = query.eq('cycle', cycleFilter as CaseCycle)
      if (monthFilter) query = query.eq('period_month', monthFilter)

      const { data: rawRows, error } = await query
        .order('due_date', { ascending: true })
        .order('firm_name', { ascending: true })

      if (error) throw new Error(error.message)
      const rows = (rawRows || []) as unknown as CaseStatusRow[]

      const columns: ColumnDefinition[] = [
        { header: 'Client Firm', key: 'firm_name', width: 28 },
        { header: 'Period Month', key: 'period_month', width: 15 },
        { header: 'Cycle', key: 'cycle', width: 14 },
        { header: 'Statutory Due Date', key: 'due_date', width: 18 },
        { header: 'Required Docs', key: 'required_count', width: 14 },
        { header: 'Missing Docs', key: 'missing_count', width: 14 },
        { header: 'Undispatched Docs', key: 'undispatched_count', width: 18 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Assigned Employee', key: 'assigned_to_name', width: 22 },
      ]

      const formatted = rows.map((r) => {
        const staff = r.profiles
        return {
          firm_name: r.firm_name,
          period_month: formatMonthYear(r.period_month),
          cycle: r.cycle === 'A_11th' ? 'Cycle A (11th)' : 'Cycle B (20th)',
          due_date: formatDateIST(r.due_date),
          required_count: r.required_count,
          missing_count: r.missing_count,
          undispatched_count: r.undispatched_count,
          status: r.status,
          assigned_to_name: staff?.full_name || 'Unassigned',
        }
      })

      return {
        reportName: 'Overdue_Cases',
        sheetTitle: 'Overdue Cases',
        columns,
        data: formatted,
      }
    }
  }
}
