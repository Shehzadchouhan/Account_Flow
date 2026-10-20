import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserRole } from '@/utils/auth'
import { StatusBadge } from '@/components/StatusBadge'
import { getTodayIST } from '@/lib/date-utils'
import type { CaseStatusType, CaseCycle } from '@/types/database.types'

export const metadata: Metadata = {
  title: 'Cases | FinanceFlow',
  description: 'Manage monthly client folders and document checklists',
}

interface CasesPageProps {
  searchParams: Promise<{
    month?: string
    cycle?: string
    status?: string
    employee?: string
    firm_id?: string
    overdue?: string
    due_today?: string
    attention?: string
    active_only?: string
    search?: string
    page?: string
  }>
}

function getCurrentKolkataMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((p) => p.type === 'year')?.value || '2026'
  const month = parts.find((p) => p.type === 'month')?.value || '10'
  return `${year}-${month}-01`
}

// Generate selectable list of recent 12 months and upcoming 3 months
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

interface CaseListItem {
  case_id: string
  firm_id: string
  firm_name: string
  firm_is_active: boolean
  period_month: string
  cycle: CaseCycle
  due_date: string
  assigned_to: string | null
  version: number
  required_count: number
  received_count: number
  dispatched_count: number
  missing_count: number
  undispatched_count: number
  status: CaseStatusType
  is_overdue: boolean
  profiles?: {
    full_name: string
  } | null
}

export default async function CasesPage(props: CasesPageProps) {
  const searchParams = await props.searchParams
  const defaultMonth = getCurrentKolkataMonth()
  const monthFilter = searchParams.month !== undefined ? searchParams.month : defaultMonth
  const cycleFilter = searchParams.cycle || 'all'
  const statusFilter = searchParams.status || 'all'
  const employeeFilter = searchParams.employee || 'all'
  const firmFilter = searchParams.firm_id || 'all'
  const overdueOnly = searchParams.overdue === 'true'
  const search = searchParams.search?.trim() || ''
  const currentPage = Math.max(1, parseInt(searchParams.page || '1', 10))
  const pageSize = 25

  const role = await getCurrentUserRole()
  const isAdmin = role === 'admin'

  const supabase = await createClient()

  // 1. Fetch metadata for filters: active profiles and active firms
  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const { data: firmsList } = await supabase
    .from('firms')
    .select('id, name')
    .order('name', { ascending: true })

  // 2. Build case_status query
  let query = supabase
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
    `,
      { count: 'exact' }
    )

  if (monthFilter && monthFilter !== 'all') {
    query = query.eq('period_month', monthFilter)
  }

  if (cycleFilter && cycleFilter !== 'all') {
    query = query.eq('cycle', cycleFilter as CaseCycle)
  }

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter as CaseStatusType)
  }

  if (employeeFilter === 'unassigned') {
    query = query.is('assigned_to', null)
  } else if (employeeFilter && employeeFilter !== 'all') {
    query = query.eq('assigned_to', employeeFilter)
  }

  if (firmFilter && firmFilter !== 'all') {
    query = query.eq('firm_id', firmFilter)
  }

  // Filter active firms only unless explicitly requested all
  if (searchParams.active_only !== 'false') {
    query = query.eq('firm_is_active', true)
  }

  if (overdueOnly) {
    query = query.eq('is_overdue', true)
  }

  const todayIST = getTodayIST()

  if (searchParams.due_today === 'true') {
    query = query.eq('due_date', todayIST).neq('status', 'Completed')
  }

  if (searchParams.attention === 'true') {
    query = query.or(`is_overdue.eq.true,and(due_date.eq.${todayIST},status.neq.Completed)`)
  }

  if (search) {
    query = query.ilike('firm_name', `%${search}%`)
  }

  const fromIndex = (currentPage - 1) * pageSize
  const toIndex = fromIndex + pageSize - 1

  const { data: casesData, count: totalFilteredCount, error } = await query
    .order('due_date', { ascending: true })
    .order('firm_name', { ascending: true })
    .range(fromIndex, toIndex)

  const cases = casesData as unknown as CaseListItem[]
  const totalPages = Math.ceil((totalFilteredCount || 0) / pageSize) || 1

  const hasFilters = Boolean(
    (monthFilter && monthFilter !== defaultMonth) ||
      cycleFilter !== 'all' ||
      statusFilter !== 'all' ||
      employeeFilter !== 'all' ||
      firmFilter !== 'all' ||
      overdueOnly ||
      searchParams.due_today === 'true' ||
      searchParams.attention === 'true' ||
      search
  )

  const monthOptions = getMonthOptions()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Cases
          </h1>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
            {totalFilteredCount || 0} Total
          </span>
        </div>

        {isAdmin && (
          <Link
            href="/admin/generate-cases"
            className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors min-h-[38px]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Generate Cases</span>
          </Link>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs space-y-3">
        <form method="GET" action="/cases" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          {/* Client Firm Filter */}
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
              <option value="all">All Client Firms</option>
              {firmsList?.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector (Default current in Asia/Kolkata) */}
          <div className="md:col-span-2">
            <label htmlFor="month" className="block text-xs font-medium text-slate-700 mb-1">
              Work Month
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

          {/* Cycle */}
          <div className="md:col-span-2">
            <label htmlFor="cycle" className="block text-xs font-medium text-slate-700 mb-1">
              Filing Cycle
            </label>
            <select
              id="cycle"
              name="cycle"
              defaultValue={cycleFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Cycles</option>
              <option value="A_11th">Cycle A (Due 11th)</option>
              <option value="B_20th">Cycle B (Due 20th)</option>
            </select>
          </div>

          {/* Status */}
          <div className="md:col-span-2">
            <label htmlFor="status" className="block text-xs font-medium text-slate-700 mb-1">
              Case Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Statuses</option>
              <option value="Awaiting Documents">Awaiting Documents</option>
              <option value="Pending Dispatch">Pending Dispatch</option>
              <option value="Completed">Completed</option>
              <option value="No Required Documents">No Required Documents</option>
            </select>
          </div>

          {/* Assigned Staff */}
          <div className="md:col-span-2">
            <label htmlFor="employee" className="block text-xs font-medium text-slate-700 mb-1">
              Assignee
            </label>
            <select
              id="employee"
              name="employee"
              defaultValue={employeeFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Personnel</option>
              <option value="unassigned">Unassigned Only</option>
              {staffList?.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Submit Button */}
          <div className="md:col-span-1 flex items-end">
            <button
              type="submit"
              className="w-full px-3 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-500 min-h-[40px]"
            >
              Filter
            </button>
          </div>

          {/* Secondary filter controls (Overdue only checkbox) */}
          <div className="md:col-span-12 flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="overdue"
                name="overdue"
                value="true"
                defaultChecked={overdueOnly}
                className="h-4 w-4 rounded-sm border-slate-300 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="overdue" className="text-slate-700 font-medium cursor-pointer">
                Show Overdue Cases Only (past due in Asia/Kolkata)
              </label>
              {searchParams.due_today === 'true' && (
                <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  Filtering: Due Today
                </span>
              )}
              {searchParams.attention === 'true' && (
                <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                  Filtering: Needing Attention
                </span>
              )}
            </div>

            {hasFilters && (
              <Link
                href="/cases"
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                Clear all filters
              </Link>
            )}
          </div>
        </form>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">
            Failed to load cases: {error.message}
          </div>
        ) : !cases || cases.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              {hasFilters ? 'No matching cases found' : 'No cases generated for this period'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              {hasFilters
                ? 'Try widening your date filters or clearing active selections to view more dockets.'
                : 'Use the Monthly Case Generator to create compliance cases for your active client firms.'}
            </p>
            <div className="mt-5">
              {hasFilters ? (
                <Link
                  href="/cases"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Reset to Current Month
                </Link>
              ) : (
                isAdmin && (
                  <Link
                    href="/admin/generate-cases"
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    Generate Cases Now
                  </Link>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Client Firm Name
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Period &amp; Cycle
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Due Date
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Assigned Staff
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Checklist Progress
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {cases.map((c) => {
                  const assignee = c.profiles?.full_name || 'Unassigned'
                  const monthFormatted = new Date(`${c.period_month}T00:00:00Z`).toLocaleString(
                    'en-US',
                    { month: 'short', year: 'numeric', timeZone: 'UTC' }
                  )
                  const cycleLabel = c.cycle === 'A_11th' ? 'Cycle A (11th)' : 'Cycle B (20th)'

                  return (
                    <tr key={c.case_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                        <Link
                          href={`/cases/${c.case_id}`}
                          className="hover:text-blue-600 font-semibold focus:outline-hidden focus:underline flex items-center gap-1.5"
                        >
                          {c.firm_name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">{monthFormatted}</div>
                        <div className="text-slate-500">{cycleLabel}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <div className="font-medium text-slate-900">{c.due_date}</div>
                        {c.is_overdue && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 mt-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                            OVERDUE
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {assignee}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-700">
                        <div>
                          <strong>{c.received_count}</strong> of <strong>{c.required_count}</strong> required received
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {c.dispatched_count} dispatched
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={c.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/cases/${c.case_id}`}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                        >
                          Open Checklist &rarr;
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
            <div>
              Showing <strong className="font-semibold text-slate-900">{fromIndex + 1}</strong> to{' '}
              <strong className="font-semibold text-slate-900">
                {Math.min(toIndex + 1, totalFilteredCount || 0)}
              </strong>{' '}
              of <strong className="font-semibold text-slate-900">{totalFilteredCount || 0}</strong>{' '}
              cases
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/cases?${new URLSearchParams({
                  ...(monthFilter && { month: monthFilter }),
                  ...(cycleFilter && { cycle: cycleFilter }),
                  ...(statusFilter && { status: statusFilter }),
                  ...(employeeFilter && { employee: employeeFilter }),
                  ...(firmFilter && { firm_id: firmFilter }),
                  ...(overdueOnly && { overdue: 'true' }),
                  ...(search && { search }),
                  page: String(currentPage - 1),
                }).toString()}`}
                aria-disabled={currentPage <= 1}
                className={`px-3 py-1.5 rounded-md border text-xs font-medium min-h-[36px] flex items-center ${
                  currentPage <= 1
                    ? 'pointer-events-none opacity-50 bg-slate-100 text-slate-400 border-slate-200'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                }`}
              >
                Previous
              </Link>

              <span className="px-2 font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>

              <Link
                href={`/cases?${new URLSearchParams({
                  ...(monthFilter && { month: monthFilter }),
                  ...(cycleFilter && { cycle: cycleFilter }),
                  ...(statusFilter && { status: statusFilter }),
                  ...(employeeFilter && { employee: employeeFilter }),
                  ...(firmFilter && { firm_id: firmFilter }),
                  ...(overdueOnly && { overdue: 'true' }),
                  ...(search && { search }),
                  page: String(currentPage + 1),
                }).toString()}`}
                aria-disabled={currentPage >= totalPages}
                className={`px-3 py-1.5 rounded-md border text-xs font-medium min-h-[36px] flex items-center ${
                  currentPage >= totalPages
                    ? 'pointer-events-none opacity-50 bg-slate-100 text-slate-400 border-slate-200'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
