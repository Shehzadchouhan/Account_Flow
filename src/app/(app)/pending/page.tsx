import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/utils/auth'
import { StatusBadge } from '@/components/StatusBadge'
import { EmailReminderButton } from '@/components/EmailReminderButton'
import { formatDateIST, formatMonthYear } from '@/lib/date-utils'
import type { CaseCycle, CaseDocumentStatusType } from '@/types/database.types'

export const metadata: Metadata = {
  title: 'Pending Work Queue | FinanceFlow',
  description: 'Document-level pending work queue: documents awaiting receipt from firms and received documents pending dispatch',
}

interface PendingPageProps {
  searchParams: Promise<{
    firm_id?: string
    employee?: string
    document_type_id?: string
    status?: string
    due_date_from?: string
    due_date_to?: string
    cycle?: string
    month?: string
    my_work?: string
    sort?: string
    page?: string
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

interface PendingDocumentRow {
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
  received_by: string | null
  notes: string | null
  created_at: string
  status: CaseDocumentStatusType
  is_overdue: boolean
}

export default async function PendingWorkPage(props: PendingPageProps) {
  const user = await requireAuth()
  const searchParams = await props.searchParams

  const firmFilter = searchParams.firm_id || 'all'
  const employeeFilter = searchParams.employee || 'all'
  const docTypeFilter = searchParams.document_type_id || 'all'
  const statusFilter = searchParams.status || 'all'
  const dueDateFrom = searchParams.due_date_from || ''
  const dueDateTo = searchParams.due_date_to || ''
  const cycleFilter = searchParams.cycle || 'all'
  const monthFilter = searchParams.month || 'all'
  const isMyWork = searchParams.my_work === 'true'
  const sortOrder = searchParams.sort === 'due_date_desc' ? 'desc' : 'asc'
  const currentPage = Math.max(1, parseInt(searchParams.page || '1', 10))
  const pageSize = 25

  const supabase = await createClient()

  // 1. Fetch metadata for filter dropdowns
  const [firmsRes, staffRes, docTypesRes] = await Promise.all([
    supabase.from('firms').select('id, name, contact_person, contact_email, contact_phone').order('name', { ascending: true }),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name', { ascending: true }),
    supabase.from('document_types').select('id, name').order('name', { ascending: true }),
  ])

  const firmsList = firmsRes.data || []
  const staffList = staffRes.data || []
  const docTypesList = docTypesRes.data || []
  const monthOptions = getMonthOptions()

  // Map firm contacts for 1-click reminders
  const firmContactMap = new Map<string, { contact_person: string | null; contact_email: string | null }>()
  for (const firm of firmsList) {
    firmContactMap.set(firm.id, {
      contact_person: firm.contact_person,
      contact_email: firm.contact_email,
    })
  }

  // 2. Query case_document_status view
  // Scope: Active firms only and undispatched documents
  let query = supabase
    .from('case_document_status')
    .select(
      `
      case_document_id,
      case_id,
      firm_id,
      firm_name,
      firm_is_active,
      period_month,
      cycle,
      due_date,
      assigned_to,
      assigned_to_name,
      document_type_id,
      document_type_name,
      is_required,
      received_at,
      received_by,
      notes,
      created_at,
      status,
      is_overdue
    `,
      { count: 'exact' }
    )
    .eq('firm_is_active', true)
    .neq('status', 'Dispatched')

  // Apply filters
  if (firmFilter !== 'all') {
    query = query.eq('firm_id', firmFilter)
  }

  // "My work" toggle overrides or sets employee filter to current logged in user
  if (isMyWork) {
    query = query.eq('assigned_to', user.id)
  } else if (employeeFilter === 'unassigned') {
    query = query.is('assigned_to', null)
  } else if (employeeFilter !== 'all') {
    query = query.eq('assigned_to', employeeFilter)
  }

  if (docTypeFilter !== 'all') {
    query = query.eq('document_type_id', docTypeFilter)
  }

  if (statusFilter === 'received_not_dispatched') {
    query = query.eq('status', 'Received - Not Dispatched')
  } else if (statusFilter === 'awaiting_receipt') {
    query = query.eq('status', 'Awaiting Receipt')
  }

  if (dueDateFrom) {
    query = query.gte('due_date', dueDateFrom)
  }
  if (dueDateTo) {
    query = query.lte('due_date', dueDateTo)
  }

  if (cycleFilter !== 'all') {
    query = query.eq('cycle', cycleFilter as CaseCycle)
  }

  if (monthFilter !== 'all') {
    query = query.eq('period_month', monthFilter)
  }

  const fromIndex = (currentPage - 1) * pageSize
  const toIndex = fromIndex + pageSize - 1

  const { data: rawRows, count: totalCount, error } = await query
    .order('due_date', { ascending: sortOrder === 'asc' })
    .order('firm_name', { ascending: true })
    .range(fromIndex, toIndex)

  const rows = (rawRows || []) as unknown as PendingDocumentRow[]
  const totalPages = Math.ceil((totalCount || 0) / pageSize) || 1

  const hasFilters = Boolean(
    firmFilter !== 'all' ||
      (employeeFilter !== 'all' && !isMyWork) ||
      docTypeFilter !== 'all' ||
      statusFilter !== 'all' ||
      dueDateFrom ||
      dueDateTo ||
      cycleFilter !== 'all' ||
      monthFilter !== 'all' ||
      isMyWork ||
      sortOrder === 'desc'
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Pending Work Queue
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              {totalCount || 0} Pending Documents
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Granular document-level operational backlog: records awaiting client receipt and received records pending outward dispatch
          </p>
        </div>

        {/* Quick My Work Toggle */}
        <div className="flex items-center gap-3">
          <Link
            href={
              isMyWork
                ? '/pending'
                : `/pending?my_work=true${monthFilter !== 'all' ? `&month=${monthFilter}` : ''}`
            }
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors shadow-2xs min-h-[40px] ${
              isMyWork
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{isMyWork ? 'Showing My Work (Assigned to Me)' : 'Filter to My Work'}</span>
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <form method="GET" action="/pending" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          {isMyWork && <input type="hidden" name="my_work" value="true" />}

          {/* Firm Filter */}
          <div className="md:col-span-3">
            <label htmlFor="firm_id" className="block text-xs font-medium text-slate-700 mb-1">
              Client Firm
            </label>
            <select
              id="firm_id"
              name="firm_id"
              defaultValue={firmFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Active Firms</option>
              {firmsList.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className="md:col-span-2">
            <label htmlFor="month" className="block text-xs font-medium text-slate-700 mb-1">
              Compliance Month
            </label>
            <select
              id="month"
              name="month"
              defaultValue={monthFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Months</option>
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Cycle Filter */}
          <div className="md:col-span-2">
            <label htmlFor="cycle" className="block text-xs font-medium text-slate-700 mb-1">
              Cycle
            </label>
            <select
              id="cycle"
              name="cycle"
              defaultValue={cycleFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Cycles</option>
              <option value="A_11th">Cycle A (11th)</option>
              <option value="B_20th">Cycle B (20th)</option>
            </select>
          </div>

          {/* Document Type Filter */}
          <div className="md:col-span-3">
            <label htmlFor="document_type_id" className="block text-xs font-medium text-slate-700 mb-1">
              Document Type
            </label>
            <select
              id="document_type_id"
              name="document_type_id"
              defaultValue={docTypeFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Document Types</option>
              {docTypesList.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pending Status Filter */}
          <div className="md:col-span-2">
            <label htmlFor="status" className="block text-xs font-medium text-slate-700 mb-1">
              Document Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Pending</option>
              <option value="awaiting_receipt">Awaiting Receipt</option>
              <option value="received_not_dispatched">Received - Not Dispatched</option>
            </select>
          </div>

          {/* Employee Filter */}
          <div className="md:col-span-3">
            <label htmlFor="employee" className="block text-xs font-medium text-slate-700 mb-1">
              Assigned Employee
            </label>
            <select
              id="employee"
              name="employee"
              disabled={isMyWork}
              defaultValue={employeeFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px] disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="all">All Staff Members</option>
              <option value="unassigned">Unassigned Only</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date Range: From */}
          <div className="md:col-span-3">
            <label htmlFor="due_date_from" className="block text-xs font-medium text-slate-700 mb-1">
              Due Date From
            </label>
            <input
              type="date"
              id="due_date_from"
              name="due_date_from"
              defaultValue={dueDateFrom}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
          </div>

          {/* Due Date Range: To */}
          <div className="md:col-span-3">
            <label htmlFor="due_date_to" className="block text-xs font-medium text-slate-700 mb-1">
              Due Date To
            </label>
            <input
              type="date"
              id="due_date_to"
              name="due_date_to"
              defaultValue={dueDateTo}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
          </div>

          {/* Due Date Sort Order */}
          <div className="md:col-span-2">
            <label htmlFor="sort" className="block text-xs font-medium text-slate-700 mb-1">
              Sort By Due Date
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={sortOrder === 'desc' ? 'due_date_desc' : 'due_date_asc'}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="due_date_asc">Due Date (Earliest first)</option>
              <option value="due_date_desc">Due Date (Latest first)</option>
            </select>
          </div>

          {/* Apply Filter Button */}
          <div className="md:col-span-1 flex items-end">
            <button
              type="submit"
              className="w-full px-3 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-500 min-h-[40px]"
            >
              Apply
            </button>
          </div>

          {/* Active filter badge row & clear button */}
          {hasFilters && (
            <div className="md:col-span-12 flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-700">Active Filters:</span>
                {firmFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                    Firm: {firmsList.find((f) => f.id === firmFilter)?.name || firmFilter}
                  </span>
                )}
                {monthFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                    Month: {formatMonthYear(monthFilter)}
                  </span>
                )}
                {cycleFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                    Cycle: {cycleFilter === 'A_11th' ? 'Cycle A' : 'Cycle B'}
                  </span>
                )}
                {statusFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                    Status: {statusFilter === 'received_not_dispatched' ? 'Received - Not Dispatched' : 'Awaiting Receipt'}
                  </span>
                )}
                {isMyWork && (
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 font-semibold">
                    My Work Only
                  </span>
                )}
                {(dueDateFrom || dueDateTo) && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                    Due: {dueDateFrom || 'Start'} to {dueDateTo || 'End'}
                  </span>
                )}
              </div>

              <Link
                href="/pending"
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline shrink-0"
              >
                Clear all filters
              </Link>
            </div>
          )}
        </form>
      </div>

      {/* Pending Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">
            Failed to load pending documents: {error.message}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {hasFilters ? 'No pending documents match your filters' : 'Backlog All Clear!'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              {hasFilters
                ? 'Try broadening your filter criteria or clearing all filters to view the full pending queue.'
                : 'All checklist documents across operating cases have been received and dispatched.'}
            </p>
            {hasFilters && (
              <div className="mt-4">
                <Link
                  href="/pending"
                  className="inline-flex items-center px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                  Clear Filters
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3">Client Firm</th>
                  <th scope="col" className="px-4 py-3">Compliance Case</th>
                  <th scope="col" className="px-4 py-3">Checklist Document</th>
                  <th scope="col" className="px-4 py-3">Calculated Status</th>
                  <th scope="col" className="px-4 py-3">Reason / Next Step</th>
                  <th scope="col" className="px-4 py-3">Due Date (IST)</th>
                  <th scope="col" className="px-4 py-3">Assignee</th>
                  <th scope="col" className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const plainReason =
                    row.status === 'Received - Not Dispatched'
                      ? 'Received but not dispatched'
                      : 'Awaiting receipt from firm'

                  return (
                    <tr key={row.case_document_id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Firm */}
                      <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                        <Link
                          href={`/firms/${row.firm_id}`}
                          className="hover:text-blue-600 transition-colors"
                        >
                          {row.firm_name}
                        </Link>
                      </td>

                      {/* Case (Month / Cycle) */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-slate-900 font-medium">
                          {formatMonthYear(row.period_month)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.cycle === 'A_11th' ? 'Cycle A (11th)' : 'Cycle B (20th)'}
                        </div>
                      </td>

                      {/* Document */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {row.document_type_name}
                        </div>
                        <div className="mt-0.5">
                          {row.is_required ? (
                            <span className="text-2xs font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              REQUIRED
                            </span>
                          ) : (
                            <span className="text-2xs font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                              OPTIONAL
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={row.status} />
                      </td>

                      {/* Plain-Language Reason */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                            row.status === 'Received - Not Dispatched'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              row.status === 'Received - Not Dispatched'
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                            }`}
                          />
                          {plainReason}
                        </span>
                      </td>

                      {/* Due Date & Overdue Label */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={row.is_overdue ? 'font-semibold text-red-600' : 'text-slate-700'}>
                            {formatDateIST(row.due_date)}
                          </span>
                          {row.is_overdue && (
                            <span className="px-1.5 py-0.5 text-2xs font-extrabold uppercase tracking-wider rounded bg-red-100 text-red-800 border border-red-300">
                              OVERDUE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Assignee */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                        {row.assigned_to_name ? (
                          <span className="font-medium text-slate-800">{row.assigned_to_name}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Action Links */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {row.status === 'Awaiting Receipt' && (
                            <EmailReminderButton
                              variant="compact"
                              firmName={row.firm_name}
                              contactPerson={firmContactMap.get(row.firm_id)?.contact_person}
                              contactEmail={firmContactMap.get(row.firm_id)?.contact_email}
                              periodMonth={row.period_month}
                              cycle={row.cycle}
                              dueDate={row.due_date}
                              missingDocuments={[row.document_type_name]}
                              senderName={row.assigned_to_name}
                            />
                          )}
                          <Link
                            href={`/cases/${row.case_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 rounded-lg border border-blue-200 transition-colors"
                          >
                            <span>View Case</span>
                            <span aria-hidden="true">&rarr;</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalCount !== null && totalCount > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold text-slate-900">{fromIndex + 1}</span> to{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(toIndex + 1, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-slate-900">{totalCount}</span> pending documents
            </div>

            <div className="flex items-center gap-1.5">
              {currentPage > 1 ? (
                <Link
                  href={`/pending?page=${currentPage - 1}${firmFilter !== 'all' ? `&firm_id=${firmFilter}` : ''}${monthFilter !== 'all' ? `&month=${monthFilter}` : ''}${cycleFilter !== 'all' ? `&cycle=${cycleFilter}` : ''}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}${isMyWork ? '&my_work=true' : ''}${sortOrder === 'desc' ? '&sort=due_date_desc' : ''}`}
                  className="px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 font-medium text-slate-700 transition-colors"
                >
                  Previous
                </Link>
              ) : (
                <span className="px-2.5 py-1.5 rounded border border-slate-200 bg-slate-100 font-medium text-slate-400 cursor-not-allowed">
                  Previous
                </span>
              )}

              <span className="px-2 font-medium text-slate-700">
                Page {currentPage} of {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Link
                  href={`/pending?page=${currentPage + 1}${firmFilter !== 'all' ? `&firm_id=${firmFilter}` : ''}${monthFilter !== 'all' ? `&month=${monthFilter}` : ''}${cycleFilter !== 'all' ? `&cycle=${cycleFilter}` : ''}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}${isMyWork ? '&my_work=true' : ''}${sortOrder === 'desc' ? '&sort=due_date_desc' : ''}`}
                  className="px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 font-medium text-slate-700 transition-colors"
                >
                  Next
                </Link>
              ) : (
                <span className="px-2.5 py-1.5 rounded border border-slate-200 bg-slate-100 font-medium text-slate-400 cursor-not-allowed">
                  Next
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
