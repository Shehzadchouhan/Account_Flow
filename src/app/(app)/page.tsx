import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserRole } from '@/utils/auth'
import {
  getCurrentMonthIST,
  getTodayIST,
  formatMonthYear,
  formatDateIST,
} from '@/lib/date-utils'

export const metadata: Metadata = {
  title: 'Dashboard | FinanceFlow',
  description: 'FinanceFlow accounts office overview, compliance metrics, and operational workload',
}

interface DashboardPageProps {
  searchParams: Promise<{
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

interface EmployeeWorkloadRow {
  id: string | null
  name: string
  role: string
  totalCases: number
  awaitingDocs: number
  pendingDispatch: number
  completed: number
  overdueCases: number
  pendingDocs: number
}

export default async function DashboardPage(props: DashboardPageProps) {
  const searchParams = await props.searchParams
  const defaultMonth = getCurrentMonthIST()
  const selectedMonth = searchParams.month || defaultMonth
  const todayIST = getTodayIST()

  const role = await getCurrentUserRole()
  const isAdmin = role === 'admin'
  const supabase = await createClient()

  // 1. Fetch Distinct Active Firms Count (Firm-level)
  const { count: activeFirmsCount } = await supabase
    .from('firms')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  // 2. Fetch Cases for Selected Month (Active Firms Only) from case_status view
  const { data: monthCasesRaw } = await supabase
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
      status,
      is_overdue
    `
    )
    .eq('period_month', selectedMonth)
    .eq('firm_is_active', true)

  const monthCases = monthCasesRaw || []

  // 3. Fetch Documents for Selected Month (Active Firms Only) from case_document_status view
  const { data: monthDocsRaw } = await supabase
    .from('case_document_status')
    .select(
      `
      case_document_id,
      case_id,
      firm_id,
      firm_is_active,
      period_month,
      assigned_to,
      status
    `
    )
    .eq('period_month', selectedMonth)
    .eq('firm_is_active', true)

  const monthDocs = monthDocsRaw || []

  // 4. Fetch Staff Members for Workload Table
  const { data: staffListRaw } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const staffList = staffListRaw || []

  // ---------------------------------------------------------------------------
  // Metric Calculations (All from views, no hardcoded values, zero double-counting)
  // ---------------------------------------------------------------------------

  // Firm-Level:
  // Distinct active firms with at least one case that is overdue or due today and not Completed
  const needingAttentionFirmIds = new Set<string>()
  for (const c of monthCases) {
    if (c.status !== 'Completed') {
      const isDueToday = c.due_date === todayIST
      if (c.is_overdue || isDueToday) {
        needingAttentionFirmIds.add(c.firm_id)
      }
    }
  }
  const firmsNeedingAttentionCount = needingAttentionFirmIds.size

  // Case-Level (from case_status, selected month, active firms only):
  const casesAwaitingDocsCount = monthCases.filter((c) => c.status === 'Awaiting Documents').length
  const casesPendingDispatchCount = monthCases.filter((c) => c.status === 'Pending Dispatch').length
  const casesCompletedCount = monthCases.filter((c) => c.status === 'Completed').length
  const casesNeedsSetupCount = monthCases.filter((c) => c.status === 'No Required Documents').length
  const casesOverdueCount = monthCases.filter((c) => c.is_overdue).length
  const casesDueTodayCount = monthCases.filter(
    (c) => c.due_date === todayIST && c.status !== 'Completed'
  ).length

  // Document-Level (from case_document_status, selected month, active firms only):
  const docsReceivedNotDispatchedCount = monthDocs.filter(
    (d) => d.status === 'Received - Not Dispatched'
  ).length
  const docsAwaitingReceiptCount = monthDocs.filter(
    (d) => d.status === 'Awaiting Receipt'
  ).length

  // Workload by Employee Aggregation
  const workloadMap = new Map<string | null, EmployeeWorkloadRow>()

  // Initialize with known staff
  for (const staff of staffList) {
    workloadMap.set(staff.id, {
      id: staff.id,
      name: staff.full_name || staff.email,
      role: staff.role,
      totalCases: 0,
      awaitingDocs: 0,
      pendingDispatch: 0,
      completed: 0,
      overdueCases: 0,
      pendingDocs: 0,
    })
  }

  // Populate from monthCases
  for (const c of monthCases) {
    const key = c.assigned_to || null
    let row = workloadMap.get(key)
    if (!row) {
      if (key === null) {
        row = {
          id: null,
          name: 'Unassigned',
          role: 'unassigned',
          totalCases: 0,
          awaitingDocs: 0,
          pendingDispatch: 0,
          completed: 0,
          overdueCases: 0,
          pendingDocs: 0,
        }
        workloadMap.set(null, row)
      } else {
        // Fallback for staff who might not be in the active staff query
        row = {
          id: key,
          name: 'Other Staff',
          role: 'staff',
          totalCases: 0,
          awaitingDocs: 0,
          pendingDispatch: 0,
          completed: 0,
          overdueCases: 0,
          pendingDocs: 0,
        }
        workloadMap.set(key, row)
      }
    }

    row.totalCases += 1
    if (c.status === 'Awaiting Documents') row.awaitingDocs += 1
    if (c.status === 'Pending Dispatch') row.pendingDispatch += 1
    if (c.status === 'Completed') row.completed += 1
    if (c.is_overdue) row.overdueCases += 1
  }

  // Populate pending docs from monthDocs
  for (const d of monthDocs) {
    if (d.status !== 'Dispatched') {
      const key = d.assigned_to || null
      const row = workloadMap.get(key)
      if (row) {
        row.pendingDocs += 1
      }
    }
  }

  const workloadRows = Array.from(workloadMap.values()).filter(
    (w) => w.totalCases > 0 || w.id !== null
  )

  const monthOptions = getMonthOptions()

  return (
    <div className="space-y-6">
      {/* Top Banner: Overview & Month Selector */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-1.5 flex items-center justify-center shrink-0">
            <Image
              src="/logo-icon.png"
              alt="FinanceFlow"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Operations Dashboard
            </h1>
            <p className="text-xs text-slate-500">
              Active Month: <span className="font-semibold text-slate-800">{formatMonthYear(selectedMonth)}</span>
            </p>
          </div>
        </div>

        {/* Month Selector Form */}
        <div className="flex items-center gap-2.5">
          <form method="GET" action="/" className="flex items-center gap-2">
            <select
              id="month-select"
              name="month"
              defaultValue={selectedMonth}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-900 bg-white hover:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[38px] shadow-2xs"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} {opt.value === defaultMonth ? '(Current)' : ''}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors min-h-[38px]"
            >
              Update
            </button>
          </form>

          {isAdmin && (
            <Link
              href="/admin/generate-cases"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors whitespace-nowrap min-h-[38px]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Generate Cases</span>
            </Link>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: Key Priority Alerts */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Priority Alerts
          </h2>
          <span className="text-2xs text-slate-400">Click any card to filter</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Active Firms */}
          <Link
            href="/firms"
            className="group bg-white p-4 rounded-xl border border-slate-200/80 hover:border-blue-400 shadow-2xs hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Client Firms</span>
              <span className="text-slate-300 group-hover:text-blue-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {activeFirmsCount ?? 0}
              </span>
              <span className="text-2xs font-medium text-slate-400">active</span>
            </div>
          </Link>

          {/* Card 2: Firms Needing Attention */}
          <Link
            href={`/cases?month=${selectedMonth}&attention=true`}
            className={`group bg-white p-4 rounded-xl border shadow-2xs hover:shadow-xs transition-all ${
              firmsNeedingAttentionCount > 0
                ? 'border-amber-300/80 hover:border-amber-400 bg-amber-50/20'
                : 'border-slate-200/80 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Needs Attention</span>
              <span className="text-slate-300 group-hover:text-amber-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-2xl font-extrabold ${
                  firmsNeedingAttentionCount > 0 ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {firmsNeedingAttentionCount}
              </span>
              {firmsNeedingAttentionCount > 0 ? (
                <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  Action needed
                </span>
              ) : (
                <span className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  All clear
                </span>
              )}
            </div>
          </Link>

          {/* Card 3: Overdue Cases */}
          <Link
            href={`/cases?month=${selectedMonth}&overdue=true`}
            className={`group bg-white p-4 rounded-xl border shadow-2xs hover:shadow-xs transition-all ${
              casesOverdueCount > 0
                ? 'border-red-300/80 hover:border-red-400 bg-red-50/20'
                : 'border-slate-200/80 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Overdue Work</span>
              <span className="text-slate-300 group-hover:text-red-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-2xl font-extrabold ${
                  casesOverdueCount > 0 ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {casesOverdueCount}
              </span>
              {casesOverdueCount > 0 ? (
                <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                  Past due
                </span>
              ) : (
                <span className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  Zero overdue
                </span>
              )}
            </div>
          </Link>

          {/* Card 4: Due Today */}
          <Link
            href={`/cases?month=${selectedMonth}&due_today=true`}
            className={`group bg-white p-4 rounded-xl border shadow-2xs hover:shadow-xs transition-all ${
              casesDueTodayCount > 0
                ? 'border-blue-300/80 hover:border-blue-400 bg-blue-50/20'
                : 'border-slate-200/80 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Due Today</span>
              <span className="text-slate-300 group-hover:text-blue-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-2xl font-extrabold ${
                  casesDueTodayCount > 0 ? 'text-blue-700' : 'text-slate-900'
                }`}
              >
                {casesDueTodayCount}
              </span>
              <span className="text-2xs font-medium text-slate-400">cases</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: Cases Progress */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Cases Progress
          </h2>
          <span className="text-2xs text-slate-400">
            {monthCases.length} total cases
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Awaiting Documents */}
          <Link
            href={`/cases?month=${selectedMonth}&status=Awaiting+Documents`}
            className="group bg-white p-4 rounded-xl border border-slate-200/80 hover:border-amber-400 shadow-2xs hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Awaiting Documents</span>
              <span className="text-slate-300 group-hover:text-amber-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-amber-700">
                {casesAwaitingDocsCount}
              </span>
              <span className="text-2xs text-slate-400">cases</span>
            </div>
          </Link>

          {/* Pending Dispatch */}
          <Link
            href={`/cases?month=${selectedMonth}&status=Pending+Dispatch`}
            className="group bg-white p-4 rounded-xl border border-slate-200/80 hover:border-blue-400 shadow-2xs hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Ready for Delivery</span>
              <span className="text-slate-300 group-hover:text-blue-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-blue-700">
                {casesPendingDispatchCount}
              </span>
              <span className="text-2xs text-slate-400">cases</span>
            </div>
          </Link>

          {/* Completed */}
          <Link
            href={`/cases?month=${selectedMonth}&status=Completed`}
            className="group bg-white p-4 rounded-xl border border-slate-200/80 hover:border-emerald-400 shadow-2xs hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Completed</span>
              <span className="text-slate-300 group-hover:text-emerald-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-700">
                {casesCompletedCount}
              </span>
              <span className="text-2xs text-slate-400">cases</span>
            </div>
          </Link>

          {/* Needs Setup */}
          <Link
            href={`/cases?month=${selectedMonth}&status=No+Required+Documents`}
            className="group bg-white p-4 rounded-xl border border-slate-200/80 hover:border-slate-400 shadow-2xs hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Needs Setup</span>
              <span className="text-slate-300 group-hover:text-slate-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-700">
                {casesNeedsSetupCount}
              </span>
              <span className="text-2xs text-slate-400">cases</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 3: Document Backlog */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Document Action Queue
          </h2>
          <Link
            href={`/pending?month=${selectedMonth}`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            View all pending &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Received - Not Dispatched */}
          <Link
            href={`/pending?month=${selectedMonth}&status=received_not_dispatched`}
            className="group bg-white p-4 rounded-xl border border-slate-200/80 hover:border-amber-400 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-medium text-slate-500">
                In-Office &mdash; Ready to Deliver
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-amber-700">
                  {docsReceivedNotDispatchedCount}
                </span>
                <span className="text-2xs text-slate-400">documents</span>
              </div>
            </div>
            <div className="h-9 w-9 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
          </Link>

          {/* Awaiting Receipt */}
          <Link
            href={`/pending?month=${selectedMonth}&status=awaiting_receipt`}
            className="group bg-white p-4 rounded-xl border border-slate-200/80 hover:border-blue-400 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-medium text-slate-500">
                Waiting from Clients
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-blue-700">
                  {docsAwaitingReceiptCount}
                </span>
                <span className="text-2xs text-slate-400">documents</span>
              </div>
            </div>
            <div className="h-9 w-9 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 4: Team Workload Table */}
      {/* ========================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Team Workload
          </h2>
          <div className="text-xs text-slate-500 font-medium">
            {workloadRows.length} active assignees
          </div>
        </div>

        {monthCases.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-sm font-medium text-slate-700">
              No compliance cases exist for {formatMonthYear(selectedMonth)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Select another month or use the generator to initialize cases for this cycle.
            </p>
            {isAdmin && (
              <div className="mt-4">
                <Link
                  href="/admin/generate-cases"
                  className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs"
                >
                  Generate Monthly Cases
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3">Employee Name</th>
                  <th scope="col" className="px-4 py-3 text-center">Assigned Cases</th>
                  <th scope="col" className="px-4 py-3 text-center">Awaiting Docs</th>
                  <th scope="col" className="px-4 py-3 text-center">Pending Dispatch</th>
                  <th scope="col" className="px-4 py-3 text-center">Completed</th>
                  <th scope="col" className="px-4 py-3 text-center">Overdue Cases</th>
                  <th scope="col" className="px-4 py-3 text-center">Pending Docs</th>
                  <th scope="col" className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workloadRows.map((row) => (
                  <tr key={row.id || 'unassigned'} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name & Role */}
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{row.name}</span>
                        {row.id === null ? (
                          <span className="px-1.5 py-0.5 text-2xs font-bold rounded bg-amber-100 text-amber-800 border border-amber-300">
                            UNASSIGNED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-2xs font-semibold uppercase rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {row.role}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Cases */}
                    <td className="px-4 py-3 text-center font-bold text-slate-900 whitespace-nowrap">
                      {row.totalCases}
                    </td>

                    {/* Awaiting Docs */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {row.awaitingDocs > 0 ? (
                        <span className="font-semibold text-amber-700">{row.awaitingDocs}</span>
                      ) : (
                        <span className="text-slate-400">&mdash;</span>
                      )}
                    </td>

                    {/* Pending Dispatch */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {row.pendingDispatch > 0 ? (
                        <span className="font-semibold text-blue-700">{row.pendingDispatch}</span>
                      ) : (
                        <span className="text-slate-400">&mdash;</span>
                      )}
                    </td>

                    {/* Completed */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {row.completed > 0 ? (
                        <span className="font-semibold text-emerald-700">{row.completed}</span>
                      ) : (
                        <span className="text-slate-400">&mdash;</span>
                      )}
                    </td>

                    {/* Overdue Cases */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {row.overdueCases > 0 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                          {row.overdueCases}
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-xs font-semibold">0</span>
                      )}
                    </td>

                    {/* Pending Docs */}
                    <td className="px-4 py-3 text-center whitespace-nowrap font-medium text-slate-800">
                      {row.pendingDocs}
                    </td>

                    {/* Action Links */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={
                          row.id === null
                            ? `/cases?month=${selectedMonth}&employee=unassigned`
                            : `/cases?month=${selectedMonth}&employee=${row.id}`
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <span>Inspect cases</span>
                        <span aria-hidden="true">&rarr;</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
