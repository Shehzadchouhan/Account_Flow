import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/utils/auth'
import { createClient } from '@/utils/supabase/server'
import { formatDateTimeIST } from '@/lib/date-utils'
import { formatActivityLog } from '@/lib/activity-utils'

export const metadata: Metadata = {
  title: 'Activity & Audit Log | FinanceFlow',
  description: 'Tamper-evident append-only system activity log and forensic audit trail',
}

interface ActivityPageProps {
  searchParams: Promise<{
    user_id?: string
    action?: string
    entity_type?: string
    date_from?: string
    date_to?: string
    page?: string
  }>
}

interface ProfileSummary {
  id: string
  full_name: string
  email: string | null
  role: string
}

interface ActivityLogRow {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
  profiles: ProfileSummary | null
}

const COMMON_ENTITY_TYPES = [
  { value: 'firms', label: 'Client Firms' },
  { value: 'cases', label: 'Compliance Cases' },
  { value: 'case_documents', label: 'Checklist Documents' },
  { value: 'dispatches', label: 'Outward Dispatches' },
  { value: 'report', label: 'Export Reports' },
  { value: 'profiles', label: 'User Profiles' },
  { value: 'document_types', label: 'Master Document Types' },
]

export default async function AdminActivityPage(props: ActivityPageProps) {
  await requireAdmin()
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const userFilter = searchParams.user_id || 'all'
  const actionFilter = searchParams.action || 'all'
  const entityTypeFilter = searchParams.entity_type || 'all'
  const dateFrom = searchParams.date_from || ''
  const dateTo = searchParams.date_to || ''
  const currentPage = Math.max(1, parseInt(searchParams.page || '1', 10))
  const pageSize = 25

  // 1. Fetch metadata for filter dropdowns
  const [profilesRes, actionsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role').order('full_name', { ascending: true }),
    supabase.from('activity_logs').select('action').limit(500),
  ])

  const profilesList = (profilesRes.data || []) as ProfileSummary[]
  const distinctActions = Array.from(
    new Set((actionsRes.data || []).map((r) => r.action).filter(Boolean))
  ).sort()

  // 2. Query activity_logs with pagination and filters
  let query = supabase
    .from('activity_logs')
    .select(
      `
      id,
      user_id,
      action,
      entity_type,
      entity_id,
      details,
      created_at,
      profiles:user_id (id, full_name, email, role)
    `,
      { count: 'exact' }
    )

  if (userFilter !== 'all') {
    query = query.eq('user_id', userFilter)
  }
  if (actionFilter !== 'all') {
    query = query.eq('action', actionFilter)
  }
  if (entityTypeFilter !== 'all') {
    query = query.eq('entity_type', entityTypeFilter)
  }
  if (dateFrom) {
    query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`)
  }
  if (dateTo) {
    query = query.lte('created_at', `${dateTo}T23:59:59.999Z`)
  }

  const fromIndex = (currentPage - 1) * pageSize
  const toIndex = fromIndex + pageSize - 1

  const { data: rawRows, count: totalCount, error } = await query
    .order('created_at', { ascending: false })
    .range(fromIndex, toIndex)

  const rows = (rawRows || []) as unknown as ActivityLogRow[]
  const totalPages = Math.ceil((totalCount || 0) / pageSize) || 1

  const hasActiveFilters = Boolean(
    userFilter !== 'all' ||
      actionFilter !== 'all' ||
      entityTypeFilter !== 'all' ||
      dateFrom ||
      dateTo
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              System Activity &amp; Audit Log
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              {totalCount || 0} Events
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Append-only forensic audit trail of all compliance actions, document status mutations, and exports
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Append-Only &bull; Trigger Protected</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <form method="GET" action="/admin/activity" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          {/* User Filter */}
          <div className="md:col-span-3">
            <label htmlFor="user_id" className="block text-xs font-medium text-slate-700 mb-1">
              Actor / User
            </label>
            <select
              id="user_id"
              name="user_id"
              defaultValue={userFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Users</option>
              {profilesList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div className="md:col-span-3">
            <label htmlFor="action" className="block text-xs font-medium text-slate-700 mb-1">
              Action Type
            </label>
            <select
              id="action"
              name="action"
              defaultValue={actionFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Actions</option>
              {distinctActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Type Filter */}
          <div className="md:col-span-2">
            <label htmlFor="entity_type" className="block text-xs font-medium text-slate-700 mb-1">
              Entity Category
            </label>
            <select
              id="entity_type"
              name="entity_type"
              defaultValue={entityTypeFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              <option value="all">All Entities</option>
              {COMMON_ENTITY_TYPES.map((et) => (
                <option key={et.value} value={et.value}>
                  {et.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="md:col-span-2">
            <label htmlFor="date_from" className="block text-xs font-medium text-slate-700 mb-1">
              Date From
            </label>
            <input
              type="date"
              id="date_from"
              name="date_from"
              defaultValue={dateFrom}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
          </div>

          {/* Date To */}
          <div className="md:col-span-2">
            <label htmlFor="date_to" className="block text-xs font-medium text-slate-700 mb-1">
              Date To
            </label>
            <input
              type="date"
              id="date_to"
              name="date_to"
              defaultValue={dateTo}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
          </div>

          {/* Apply Filter Button & Reset */}
          <div className="md:col-span-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-500 min-h-[40px]"
              >
                Apply Filters
              </button>
              {hasActiveFilters && (
                <Link
                  href="/admin/activity"
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline min-h-[40px] flex items-center"
                >
                  Reset all filters
                </Link>
              )}
            </div>

            <span className="text-xs text-slate-500">
              Showing page {currentPage} of {totalPages}
            </span>
          </div>
        </form>
      </div>

      {/* Activity Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">
            Failed to load activity logs: {error.message}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {hasActiveFilters ? 'No activity events match your filters' : 'No activity logged yet'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Try broadening your filter parameters to view earlier audit events.'
                : 'System actions and user events will be automatically recorded here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-2xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Timestamp (IST)</th>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Actor</th>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Event / Action</th>
                    <th scope="col" className="px-4 py-3">Description &amp; Context</th>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Entity Category</th>
                    <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">Target Entity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const formatted = formatActivityLog(
                      row.action,
                      row.entity_type,
                      row.entity_id,
                      row.details
                    )
                    const actor = row.profiles

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Timestamp */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-700 font-mono text-2xs">
                          {formatDateTimeIST(row.created_at)}
                        </td>

                        {/* Actor */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {actor ? (
                            <div>
                              <div className="font-semibold text-slate-900">{actor.full_name}</div>
                              <div className="text-2xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className="uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-slate-100 border border-slate-200">
                                  {actor.role}
                                </span>
                                <span>{actor.email}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">System Trigger</span>
                          )}
                        </td>

                        {/* Event / Action */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold border ${formatted.badgeColor.bg} ${formatted.badgeColor.text} ${formatted.badgeColor.border}`}
                          >
                            {row.action}
                          </span>
                        </td>

                        {/* Description & Context */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{formatted.title}</div>
                          <div className="text-xs text-slate-600 mt-0.5">{formatted.description}</div>

                          {/* Collapsible details for raw inspection */}
                          {row.details && Object.keys(row.details).length > 0 && (
                            <details className="mt-1.5 group">
                              <summary className="text-2xs text-blue-600 hover:text-blue-800 cursor-pointer select-none">
                                View raw payload ({Object.keys(row.details).length} fields)
                              </summary>
                              <pre className="mt-1.5 p-2 bg-slate-900 text-slate-100 rounded text-2xs overflow-x-auto max-w-lg font-mono">
                                {JSON.stringify(row.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </td>

                        {/* Entity Category */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-2xs font-medium">
                            {row.entity_type}
                          </span>
                        </td>

                        {/* Target Entity Link */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          {formatted.entityLink ? (
                            <Link
                              href={formatted.entityLink.href}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 rounded border border-blue-200 transition-colors"
                            >
                              <span>{formatted.entityLink.label}</span>
                              <span aria-hidden="true">&rarr;</span>
                            </Link>
                          ) : row.entity_id ? (
                            <span className="text-2xs text-slate-400 font-mono" title={row.entity_id}>
                              {row.entity_id.slice(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {rows.map((row) => {
                const formatted = formatActivityLog(
                  row.action,
                  row.entity_type,
                  row.entity_id,
                  row.details
                )
                const actor = row.profiles

                return (
                  <div key={row.id} className="p-4 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold border ${formatted.badgeColor.bg} ${formatted.badgeColor.text} ${formatted.badgeColor.border}`}
                      >
                        {row.action}
                      </span>
                      <span className="text-slate-500 font-mono text-2xs">
                        {formatDateTimeIST(row.created_at)}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-900">{formatted.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{formatted.description}</div>
                    </div>

                    <div className="flex items-center gap-2 text-2xs text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <span className="font-semibold text-slate-700">By:</span>
                      {actor ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900">{actor.full_name}</span>
                          <span className="uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
                            {actor.role}
                          </span>
                        </div>
                      ) : (
                        <span className="italic text-slate-400">System Trigger</span>
                      )}
                    </div>

                    {/* Raw payload toggle */}
                    {row.details && Object.keys(row.details).length > 0 && (
                      <details className="mt-1 group">
                        <summary className="text-2xs text-blue-600 hover:text-blue-800 cursor-pointer select-none py-1">
                          View raw payload ({Object.keys(row.details).length} fields)
                        </summary>
                        <pre className="mt-1 p-2 bg-slate-900 text-slate-100 rounded text-2xs overflow-x-auto max-w-full font-mono">
                          {JSON.stringify(row.details, null, 2)}
                        </pre>
                      </details>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-2xs font-medium">
                        {row.entity_type}
                      </span>
                      {formatted.entityLink ? (
                        <Link
                          href={formatted.entityLink.href}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 rounded border border-blue-200 transition-colors"
                        >
                          <span>{formatted.entityLink.label}</span>
                          <span aria-hidden="true">&rarr;</span>
                        </Link>
                      ) : row.entity_id ? (
                        <span className="text-2xs text-slate-400 font-mono" title={row.entity_id}>
                          {row.entity_id.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-slate-400 text-2xs">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Pagination Bar */}
        {totalCount !== null && totalCount > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold text-slate-900">{fromIndex + 1}</span> to{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(toIndex + 1, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-slate-900">{totalCount}</span> events
            </div>

            <div className="flex items-center gap-1.5">
              {currentPage > 1 ? (
                <Link
                  href={`/admin/activity?page=${currentPage - 1}${userFilter !== 'all' ? `&user_id=${userFilter}` : ''}${actionFilter !== 'all' ? `&action=${actionFilter}` : ''}${entityTypeFilter !== 'all' ? `&entity_type=${entityTypeFilter}` : ''}${dateFrom ? `&date_from=${dateFrom}` : ''}${dateTo ? `&date_to=${dateTo}` : ''}`}
                  className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 font-medium text-slate-700 transition-colors min-h-[36px] flex items-center"
                >
                  Previous
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded border border-slate-200 bg-slate-100 font-medium text-slate-400 cursor-not-allowed min-h-[36px] flex items-center">
                  Previous
                </span>
              )}

              <span className="px-2 font-medium text-slate-700">
                Page {currentPage} of {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Link
                  href={`/admin/activity?page=${currentPage + 1}${userFilter !== 'all' ? `&user_id=${userFilter}` : ''}${actionFilter !== 'all' ? `&action=${actionFilter}` : ''}${entityTypeFilter !== 'all' ? `&entity_type=${entityTypeFilter}` : ''}${dateFrom ? `&date_from=${dateFrom}` : ''}${dateTo ? `&date_to=${dateTo}` : ''}`}
                  className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 font-medium text-slate-700 transition-colors min-h-[36px] flex items-center"
                >
                  Next
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded border border-slate-200 bg-slate-100 font-medium text-slate-400 cursor-not-allowed min-h-[36px] flex items-center">
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
