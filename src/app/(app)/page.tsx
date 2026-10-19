import type { Metadata } from 'next'
import Link from 'next/link'
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
    <div className="space-y-8">
      {/* Top Banner: Overview & Month Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Live Compliance Overview &bull; Asia/Kolkata
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Accounts Office Operations Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time compliance tracking, client document handoffs, and CA dispatch pipelines for{' '}
            <span className="font-semibold text-slate-900">{formatMonthYear(selectedMonth)}</span>.
          </p>
        </div>

        {/* Month Selector Form */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <form method="GET" action="/" className="flex items-center gap-2">
            <label htmlFor="month-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Select Month:
            </label>
            <select
              id="month-select"
              name="month"
              defaultValue={selectedMonth}
              className="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-900 bg-white hover:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px] shadow-2xs"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} {opt.value === defaultMonth ? '(Current)' : ''}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-500 min-h-[40px]"
            >
              Update
            </button>
          </form>

          {isAdmin && (
            <Link
              href="/admin/generate-cases"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors whitespace-nowrap min-h-[40px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Generate Cases</span>
            </Link>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: Firm-Level & Urgency Metric Cards */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            1. Firm Overview &amp; Urgency Monitors
          </h2>
          <span className="text-xs text-slate-500">Click any card to inspect pre-filtered list</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Firms */}
          <Link
            href="/firms"
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Active Firms</span>
              <span className="text-slate-400 group-hover:text-blue-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {activeFirmsCount ?? 0}
              </span>
              <span className="text-xs font-medium text-slate-500">distinct clients</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              All registered client entities excluding archived firms
            </p>
          </Link>

          {/* Card 2: Firms Needing Attention */}
          <Link
            href={`/cases?month=${selectedMonth}&attention=true`}
            className={`group bg-white p-5 rounded-xl border shadow-2xs hover:shadow-xs transition-all relative overflow-hidden ${
              firmsNeedingAttentionCount > 0
                ? 'border-amber-300 hover:border-amber-400 bg-amber-50/20'
                : 'border-slate-200 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Firms Needing Attention</span>
              <span className="text-slate-400 group-hover:text-amber-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`text-3xl font-extrabold ${
                  firmsNeedingAttentionCount > 0 ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {firmsNeedingAttentionCount}
              </span>
              {firmsNeedingAttentionCount > 0 ? (
                <span className="text-2xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                  ACTION REQUIRED
                </span>
              ) : (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  HEALTHY
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Active firms with &ge;1 overdue or due-today non-completed case
            </p>
          </Link>

          {/* Card 3: Overdue Cases */}
          <Link
            href={`/cases?month=${selectedMonth}&overdue=true`}
            className={`group bg-white p-5 rounded-xl border shadow-2xs hover:shadow-xs transition-all relative overflow-hidden ${
              casesOverdueCount > 0
                ? 'border-red-300 hover:border-red-400 bg-red-50/20'
                : 'border-slate-200 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Overdue Cases</span>
              <span className="text-slate-400 group-hover:text-red-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`text-3xl font-extrabold ${
                  casesOverdueCount > 0 ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {casesOverdueCount}
              </span>
              {casesOverdueCount > 0 ? (
                <span className="text-2xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 animate-pulse">
                  PAST DUE
                </span>
              ) : (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ZERO OVERDUE
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Statutory cycle deadline elapsed in Asia/Kolkata
            </p>
          </Link>

          {/* Card 4: Due Today */}
          <Link
            href={`/cases?month=${selectedMonth}&due_today=true`}
            className={`group bg-white p-5 rounded-xl border shadow-2xs hover:shadow-xs transition-all relative overflow-hidden ${
              casesDueTodayCount > 0
                ? 'border-blue-300 hover:border-blue-400 bg-blue-50/20'
                : 'border-slate-200 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Due Today</span>
              <span className="text-slate-400 group-hover:text-blue-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`text-3xl font-extrabold ${
                  casesDueTodayCount > 0 ? 'text-blue-700' : 'text-slate-900'
                }`}
              >
                {casesDueTodayCount}
              </span>
              <span className="text-xs text-slate-500">cases</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Due on {formatDateIST(todayIST)} and not yet completed
            </p>
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: Case Compliance Pipeline (Month View) */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            2. Case Compliance Status ({formatMonthYear(selectedMonth)} &bull; Active Firms)
          </h2>
          <span className="text-xs font-medium text-slate-500">
            Total active cases: {monthCases.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Awaiting Documents */}
          <Link
            href={`/cases?month=${selectedMonth}&status=Awaiting+Documents`}
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-amber-400 shadow-2xs hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Awaiting Documents</span>
              <span className="text-slate-400 group-hover:text-amber-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-700">
                {casesAwaitingDocsCount}
              </span>
              <span className="text-xs text-slate-500">cases</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Missing one or more required client checklist items
            </p>
          </Link>

          {/* Pending Dispatch */}
          <Link
            href={`/cases?month=${selectedMonth}&status=Pending+Dispatch`}
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Pending Dispatch</span>
              <span className="text-slate-400 group-hover:text-blue-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-blue-700">
                {casesPendingDispatchCount}
              </span>
              <span className="text-xs text-slate-500">cases</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              All required docs in-office; ready for CA outward docket
            </p>
          </Link>

          {/* Completed */}
          <Link
            href={`/cases?month=${selectedMonth}&status=Completed`}
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-emerald-400 shadow-2xs hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Completed</span>
              <span className="text-slate-400 group-hover:text-emerald-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-700">
                {casesCompletedCount}
              </span>
              <span className="text-xs text-slate-500">cases</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              All required checklist documents received and dispatched
            </p>
          </Link>

          {/* Needs Setup ("No Required Documents") */}
          <Link
            href={`/cases?month=${selectedMonth}&status=No+Required+Documents`}
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Needs Setup</span>
              <span className="text-slate-400 group-hover:text-slate-600 transition-colors">&rarr;</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-700">
                {casesNeedsSetupCount}
              </span>
              <span className="text-xs text-slate-500">cases</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              0 required documents configured; setup checklist
            </p>
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 3: Document Operational Queue (Undispatched) */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            3. Document Operational Queue ({formatMonthYear(selectedMonth)})
          </h2>
          <Link
            href={`/pending?month=${selectedMonth}`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            View Full Pending Backlog &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Received - Not Dispatched */}
          <Link
            href={`/pending?month=${selectedMonth}&status=received_not_dispatched`}
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-amber-400 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Received &mdash; Not Dispatched
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-700">
                  {docsReceivedNotDispatchedCount}
                </span>
                <span className="text-xs text-slate-500">documents</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Received in office; awaiting bundle creation in outward dispatch
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
          </Link>

          {/* Awaiting Receipt */}
          <Link
            href={`/pending?month=${selectedMonth}&status=awaiting_receipt`}
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Awaiting Receipt From Clients
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-blue-700">
                  {docsAwaitingReceiptCount}
                </span>
                <span className="text-xs text-slate-500">documents</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Checklist items pending collection or submission from client firms
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 4: Workload by Employee Table */}
      {/* ========================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Workload by Employee &bull; {formatMonthYear(selectedMonth)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assigned case distributions, active bottlenecks, and overdue dockets across accounts staff
            </p>
          </div>
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
