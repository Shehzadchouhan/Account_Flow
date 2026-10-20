import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserRole } from '@/utils/auth'
import { DispatchesTable, type GlobalDispatchItem } from './DispatchesTable'

export const metadata: Metadata = {
  title: 'Dispatches (Outward Delivery Register) | FinanceFlow',
  description: 'Global audit register of all completed files, tax proofs, and documents delivered to clients or CAs',
}

interface DispatchesPageProps {
  searchParams: Promise<{
    status?: string
    firm_id?: string
    recipient?: string
    recorded_by?: string
    from_date?: string
    to_date?: string
    search?: string
    page?: string
  }>
}

export default async function DispatchesPage(props: DispatchesPageProps) {
  const searchParams = await props.searchParams
  const statusFilter = searchParams.status || 'all'
  const firmFilter = searchParams.firm_id || 'all'
  const recipientFilter = searchParams.recipient || ''
  const recordedByFilter = searchParams.recorded_by || 'all'
  const fromDate = searchParams.from_date || ''
  const toDate = searchParams.to_date || ''
  const search = searchParams.search?.trim() || ''
  const currentPage = Math.max(1, parseInt(searchParams.page || '1', 10))
  const pageSize = 25

  const role = await getCurrentUserRole()
  const isAdmin = role === 'admin'

  const supabase = await createClient()

  // 1. Fetch metadata for filter dropdowns
  const [firmsRes, staffRes, recipientsRes] = await Promise.all([
    supabase.from('firms').select('id, name').order('name', { ascending: true }),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name', { ascending: true }),
    supabase.rpc('get_distinct_recipients'),
  ])

  const firmsList = firmsRes.data || []
  const staffList = staffRes.data || []
  const distinctRecipients = (recipientsRes.data as string[]) || []

  // 2. Build Dispatches query
  let query = supabase
    .from('dispatches')
    .select(
      `
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
      case:cases!dispatches_case_id_fkey(
        id,
        period_month,
        cycle,
        firm_id,
        firm:firms!cases_firm_id_fkey(name)
      ),
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
    `,
      { count: 'exact' }
    )

  // Status Filter
  if (statusFilter === 'active') {
    query = query.is('voided_at', null)
  } else if (statusFilter === 'voided') {
    query = query.not('voided_at', 'is', null)
  }

  // Firm Filter
  if (firmFilter && firmFilter !== 'all') {
    const { data: firmCases } = await supabase.from('cases').select('id').eq('firm_id', firmFilter)
    const caseIds = firmCases?.map((c) => c.id) || []
    query = query.in('case_id', caseIds.length > 0 ? caseIds : ['00000000-0000-0000-0000-000000000000'])
  }

  // Recipient Filter
  if (recipientFilter.trim()) {
    query = query.ilike('recipient', `%${recipientFilter.trim()}%`)
  }

  // Recorded By Filter
  if (recordedByFilter && recordedByFilter !== 'all') {
    query = query.eq('recorded_by', recordedByFilter)
  }

  // Date Range Filters
  if (fromDate) {
    query = query.gte('sent_at', `${fromDate}T00:00:00.000Z`)
  }
  if (toDate) {
    query = query.lte('sent_at', `${toDate}T23:59:59.999Z`)
  }

  // Search keyword (recipient or email reference)
  if (search) {
    query = query.or(`recipient.ilike.%${search}%,email_reference.ilike.%${search}%`)
  }

  const fromIndex = (currentPage - 1) * pageSize
  const toIndex = fromIndex + pageSize - 1

  const { data: dispatchesData, count: totalFilteredCount, error } = await query
    .order('sent_at', { ascending: false })
    .range(fromIndex, toIndex)

  const dispatches = (dispatchesData as unknown as GlobalDispatchItem[]) || []
  const totalCount = totalFilteredCount || 0
  const totalPages = Math.ceil(totalCount / pageSize) || 1

  const hasFilters = Boolean(
    statusFilter !== 'all' ||
      firmFilter !== 'all' ||
      recipientFilter.trim() !== '' ||
      recordedByFilter !== 'all' ||
      fromDate !== '' ||
      toDate !== '' ||
      search !== ''
  )

  const buildUrl = (override: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams()
    const merged = {
      status: statusFilter !== 'all' ? statusFilter : undefined,
      firm_id: firmFilter !== 'all' ? firmFilter : undefined,
      recipient: recipientFilter.trim() || undefined,
      recorded_by: recordedByFilter !== 'all' ? recordedByFilter : undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      search: search || undefined,
      page: currentPage > 1 ? currentPage : undefined,
      ...override,
    }

    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== 'all') {
        params.set(k, String(v))
      }
    })

    const str = params.toString()
    return `/dispatches${str ? `?${str}` : ''}`
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Dispatches
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {totalCount} Total
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Proof of delivery for completed files, tax proofs, and documents handed over to clients or auditors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/cases"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-600 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors min-h-[40px] shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Record New Dispatch &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <form method="get" action="/dispatches" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="lg:col-span-2">
              <label htmlFor="search" className="block text-2xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Search Reference / Recipient
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="search"
                  name="search"
                  defaultValue={search}
                  placeholder="e.g. Auditor Sharma, GST..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-2.5 top-2 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="status" className="block text-2xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={statusFilter}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Dispatches</option>
                <option value="active">Active Only</option>
                <option value="voided">Voided Only</option>
              </select>
            </div>

            {/* Firm Filter */}
            <div>
              <label htmlFor="firm_id" className="block text-2xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Firm
              </label>
              <select
                id="firm_id"
                name="firm_id"
                defaultValue={firmFilter}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Firms</option>
                {firmsList.map((firm) => (
                  <option key={firm.id} value={firm.id}>
                    {firm.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Recorded By Filter */}
            <div>
              <label htmlFor="recorded_by" className="block text-2xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Recorded By
              </label>
              <select
                id="recorded_by"
                name="recorded_by"
                defaultValue={recordedByFilter}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Staff Members</option>
                {staffList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Dropdown / Input */}
            <div>
              <label htmlFor="recipient" className="block text-2xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Recipient
              </label>
              <input
                type="text"
                id="recipient"
                name="recipient"
                list="global-recipients-datalist"
                defaultValue={recipientFilter}
                placeholder="Any recipient"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="global-recipients-datalist">
                {distinctRecipients.map((rec) => (
                  <option key={rec} value={rec} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 2: Date Range & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-semibold text-slate-600 uppercase">From:</span>
                <input
                  type="date"
                  name="from_date"
                  defaultValue={fromDate}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-semibold text-slate-600 uppercase">To:</span>
                <input
                  type="date"
                  name="to_date"
                  defaultValue={toDate}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors min-h-[32px]"
              >
                Apply Filters
              </button>
              {hasFilters && (
                <Link
                  href="/dispatches"
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                >
                  Reset
                </Link>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Dispatches List Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-500">
            Showing <strong className="text-slate-900">{dispatches.length}</strong> of{' '}
            <strong className="text-slate-900">{totalCount}</strong> dispatches
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">
            Failed to load outward dispatches: {error.message}
          </div>
        ) : dispatches.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-base font-medium text-slate-700">No dispatches match the current filters</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your date range, recipient, or firm filters.</p>
            {hasFilters && (
              <Link
                href="/dispatches"
                className="inline-block mt-4 text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
              >
                Clear all filters
              </Link>
            )}
          </div>
        ) : (
          <DispatchesTable dispatches={dispatches} isAdmin={isAdmin} />
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50">
            <div>
              Page <strong className="text-slate-900">{currentPage}</strong> of{' '}
              <strong className="text-slate-900">{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link
                  href={buildUrl({ page: currentPage - 1 })}
                  className="px-3 py-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-50 font-medium"
                >
                  &larr; Previous
                </Link>
              ) : (
                <span className="px-3 py-1.5 border border-slate-200 rounded-md bg-slate-100 text-slate-400 cursor-not-allowed">
                  &larr; Previous
                </span>
              )}

              {currentPage < totalPages ? (
                <Link
                  href={buildUrl({ page: currentPage + 1 })}
                  className="px-3 py-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-50 font-medium"
                >
                  Next &rarr;
                </Link>
              ) : (
                <span className="px-3 py-1.5 border border-slate-200 rounded-md bg-slate-100 text-slate-400 cursor-not-allowed">
                  Next &rarr;
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
