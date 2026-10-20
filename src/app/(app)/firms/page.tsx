import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserRole } from '@/utils/auth'
import { StatusBadge } from '@/components/StatusBadge'

export const metadata: Metadata = {
  title: 'Client Directory (Firms) | FinanceFlow',
  description: 'Manage client businesses, contact details, assigned staff, and monthly checklist templates',
}

interface FirmListItem {
  id: string
  name: string
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  default_employee: string | null
  is_active: boolean
  created_at: string
  profiles?: {
    id: string
    full_name: string
  } | null
}

interface FirmsPageProps {
  searchParams: Promise<{
    search?: string
    status?: string
    assigned_to?: string
    page?: string
  }>
}

export default async function FirmsPage(props: FirmsPageProps) {
  const searchParams = await props.searchParams
  const search = searchParams.search?.trim() || ''
  const statusFilter = searchParams.status || 'active'
  const assignedTo = searchParams.assigned_to || ''
  const currentPage = Math.max(1, parseInt(searchParams.page || '1', 10))
  const pageSize = 25

  const role = await getCurrentUserRole()
  const isAdmin = role === 'admin'

  const supabase = await createClient()

  // 1. Fetch active profiles for staff filter dropdown
  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  // 2. Fetch overall active and archived counts
  const { count: activeCount } = await supabase
    .from('firms')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const { count: archivedCount } = await supabase
    .from('firms')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', false)

  // 3. Build filtered firms query
  let query = supabase
    .from('firms')
    .select(
      `
      id,
      name,
      contact_person,
      contact_email,
      contact_phone,
      default_employee,
      is_active,
      created_at,
      profiles:profiles!firms_default_employee_fkey(id, full_name)
    `,
      { count: 'exact' }
    )

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  if (statusFilter === 'active') {
    query = query.eq('is_active', true)
  } else if (statusFilter === 'archived') {
    query = query.eq('is_active', false)
  }
  // if 'all', do not filter on is_active

  if (assignedTo) {
    query = query.eq('default_employee', assignedTo)
  }

  const fromIndex = (currentPage - 1) * pageSize
  const toIndex = fromIndex + pageSize - 1

  const { data: firms, count: totalFilteredCount, error } = await query
    .order('name', { ascending: true })
    .range(fromIndex, toIndex)

  const totalPages = Math.ceil((totalFilteredCount || 0) / pageSize) || 1
  const hasFilters = Boolean(search || statusFilter !== 'active' || assignedTo)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Client Directory
            </h1>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                {activeCount || 0} ACTIVE
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                {archivedCount || 0} ARCHIVED
              </span>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Manage clients, contacts, assigned staff, and monthly document checklists.
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/firms/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shrink-0 min-h-[44px]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client Firm
          </Link>
        )}
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <form method="GET" action="/firms" className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5">
            <label htmlFor="search" className="block text-xs font-medium text-slate-700 mb-1">
              Search by Firm Name
            </label>
            <div className="relative">
              <input
                type="text"
                id="search"
                name="search"
                defaultValue={search}
                placeholder="e.g. Apex Logistics, Sharma Enterprises..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <label htmlFor="status" className="block text-xs font-medium text-slate-700 mb-1">
              Lifecycle Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="active">Active Only</option>
              <option value="archived">Archived Only</option>
              <option value="all">All Firms</option>
            </select>
          </div>

          {/* Assigned Staff Filter */}
          <div className="md:col-span-3">
            <label htmlFor="assigned_to" className="block text-xs font-medium text-slate-700 mb-1">
              Assigned Staff
            </label>
            <select
              id="assigned_to"
              name="assigned_to"
              defaultValue={assignedTo}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Personnel</option>
              {staffList?.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Action Buttons */}
          <div className="md:col-span-1 flex items-end gap-2">
            <button
              type="submit"
              className="w-full px-3 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-500 min-h-[40px]"
            >
              Filter
            </button>
          </div>
        </form>

        {hasFilters && (
          <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
            <span>
              Filtered results:{' '}
              <strong className="text-slate-900 font-semibold">{totalFilteredCount || 0}</strong>{' '}
              {totalFilteredCount === 1 ? 'firm' : 'firms'} found
            </span>
            <Link
              href="/firms"
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              Clear all filters
            </Link>
          </div>
        )}
      </div>

      {/* Firms Table / Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-red-600">Failed to load client firms.</p>
            <p className="text-xs text-slate-500 mt-1">{error.message}</p>
          </div>
        ) : !firms || firms.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              {hasFilters ? 'No matching firms found' : 'No client firms registered'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              {hasFilters
                ? 'Try adjusting your search criteria or clearing active filters to see more results.'
                : 'Get started by creating your first client firm with contact information and checklist templates.'}
            </p>
            <div className="mt-5">
              {hasFilters ? (
                <Link
                  href="/firms"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Reset Filters
                </Link>
              ) : (
                isAdmin && (
                  <Link
                    href="/firms/new"
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    Add First Firm
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
                    Primary Contact
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Contact Info
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Assigned Staff
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(firms as unknown as FirmListItem[])?.map((firm) => {
                  const assignedPerson = firm.profiles?.full_name || 'Unassigned'
                  return (
                    <tr key={firm.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                        <Link
                          href={`/firms/${firm.id}`}
                          className="hover:text-blue-600 font-semibold flex items-center gap-1.5 focus:outline-hidden focus:underline"
                        >
                          {firm.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {firm.contact_person || (
                          <span className="text-slate-400 italic">Not specified</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 space-y-0.5">
                        {firm.contact_email && <div>{firm.contact_email}</div>}
                        {firm.contact_phone && <div>{firm.contact_phone}</div>}
                        {!firm.contact_email && !firm.contact_phone && (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {assignedPerson}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={firm.is_active ? 'ACTIVE' : 'ARCHIVED'} size="sm" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/firms/${firm.id}`}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                        >
                          {isAdmin ? 'Manage' : 'View Details'}
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
              firms
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/firms?${new URLSearchParams({
                  ...(search && { search }),
                  ...(statusFilter && { status: statusFilter }),
                  ...(assignedTo && { assigned_to: assignedTo }),
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
                href={`/firms?${new URLSearchParams({
                  ...(search && { search }),
                  ...(statusFilter && { status: statusFilter }),
                  ...(assignedTo && { assigned_to: assignedTo }),
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
