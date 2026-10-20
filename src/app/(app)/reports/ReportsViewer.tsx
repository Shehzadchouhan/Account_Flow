'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ReportType, ReportDataset, ReportFilterParams } from '@/lib/reports-data'
import { StatusBadge, type BadgeStatus } from '@/components/StatusBadge'

interface ReportTab {
  id: ReportType
  label: string
  description: string
  icon: (props: { className?: string }) => React.ReactElement
}

const REPORT_TABS: ReportTab[] = [
  {
    id: 'pending_documents',
    label: 'Pending Documents',
    description: 'Missing papers from clients or documents waiting to be delivered',
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'completed_cases',
    label: 'Completed Cases',
    description: 'Finished client folders where all work is complete and delivered',
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'dispatch_history',
    label: 'Dispatch History',
    description: 'Audit log of completed files, tax proofs, and client handovers',
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  {
    id: 'work_by_employee',
    label: 'Work by Employee',
    description: 'Cases assigned, pending tasks, and completion counts per staff member',
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'received_not_dispatched',
    label: 'Received In-Office',
    description: 'Documents received from clients, waiting to be processed and dispatched',
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
      </svg>
    ),
  },
  {
    id: 'overdue_cases',
    label: 'Overdue Work',
    description: 'Client cases where the filing deadline has passed without completion',
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
]

interface ReportsViewerProps {
  activeReport: ReportType
  filters: ReportFilterParams
  dataset: ReportDataset
  firms: { id: string; name: string }[]
  staff: { id: string; full_name: string }[]
  documentTypes: { id: string; name: string }[]
  monthOptions: { label: string; value: string }[]
}

export function ReportsViewer({
  activeReport,
  filters,
  dataset,
  firms,
  staff,
  documentTypes,
  monthOptions,
}: ReportsViewerProps) {
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingCsv, setIsExportingCsv] = useState(false)

  // Construct query string for export endpoints
  const buildExportUrl = (format: 'xlsx' | 'csv') => {
    const params = new URLSearchParams()
    params.set('report', activeReport)
    params.set('format', format)

    if (filters.firm_id && filters.firm_id !== 'all') params.set('firm_id', filters.firm_id)
    if (filters.employee && filters.employee !== 'all') params.set('employee', filters.employee)
    if (filters.document_type_id && filters.document_type_id !== 'all') params.set('document_type_id', filters.document_type_id)
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.cycle && filters.cycle !== 'all') params.set('cycle', filters.cycle)
    if (filters.month && filters.month !== 'all') params.set('month', filters.month)
    if (filters.due_date_from) params.set('due_date_from', filters.due_date_from)
    if (filters.due_date_to) params.set('due_date_to', filters.due_date_to)

    return `/api/reports/export?${params.toString()}`
  }

  const activeTabMeta = REPORT_TABS.find((t) => t.id === activeReport) || REPORT_TABS[0]

  // Filter support flags
  const showFirmFilter = activeReport !== 'work_by_employee'
  const showMonthFilter = true
  const showCycleFilter = activeReport !== 'work_by_employee'
  const showEmployeeFilter = activeReport !== 'dispatch_history' && activeReport !== 'work_by_employee'
  const showDocTypeFilter = activeReport === 'pending_documents' || activeReport === 'received_not_dispatched'
  const showStatusFilter = activeReport === 'pending_documents' || activeReport === 'dispatch_history'
  const showDueDateFilter = activeReport === 'pending_documents'

  const hasActiveFilters = Boolean(
    (filters.firm_id && filters.firm_id !== 'all') ||
      (filters.employee && filters.employee !== 'all') ||
      (filters.document_type_id && filters.document_type_id !== 'all') ||
      (filters.status && filters.status !== 'all') ||
      (filters.cycle && filters.cycle !== 'all') ||
      (filters.month && filters.month !== 'all') ||
      filters.due_date_from ||
      filters.due_date_to
  )

  const previewRows = dataset.data.slice(0, 50)

  return (
    <div className="space-y-6">
      {/* Page Title & Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Reports &amp; Exports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate and export summaries of pending documents, completed cases, and team workload.
          </p>
        </div>

        {/* Global Security / Audit Tag */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Audit Logged</span>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-2xs">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5">
          {REPORT_TABS.map((tab) => {
            const isSelected = tab.id === activeReport
            const Icon = tab.icon

            return (
              <Link
                key={tab.id}
                href={`/reports?report=${tab.id}`}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all ${
                  isSelected
                    ? 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold shadow-2xs'
                    : 'hover:bg-slate-50 border border-transparent text-slate-700 font-medium'
                }`}
              >
                <span className={`p-1.5 rounded-md shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-xs truncate">
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Filter Toolbar for Active Report */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>{activeTabMeta.label}</span>
              <span className="text-xs font-normal text-slate-500">
                &mdash; {activeTabMeta.description}
              </span>
            </h2>
          </div>
          {hasActiveFilters && (
            <Link
              href={`/reports?report=${activeReport}`}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
            >
              Reset filters
            </Link>
          )}
        </div>

        <form method="GET" action="/reports" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          <input type="hidden" name="report" value={activeReport} />

          {/* Firm Filter */}
          {showFirmFilter && (
            <div className="md:col-span-3">
              <label htmlFor="firm_id" className="block text-xs font-medium text-slate-700 mb-1">
                Client Firm
              </label>
              <select
                id="firm_id"
                name="firm_id"
                defaultValue={filters.firm_id || 'all'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
              >
                <option value="all">All Active Firms</option>
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month Filter */}
          {showMonthFilter && (
            <div className="md:col-span-2">
              <label htmlFor="month" className="block text-xs font-medium text-slate-700 mb-1">
                Compliance Month
              </label>
              <select
                id="month"
                name="month"
                defaultValue={filters.month || 'all'}
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
          )}

          {/* Cycle Filter */}
          {showCycleFilter && (
            <div className="md:col-span-2">
              <label htmlFor="cycle" className="block text-xs font-medium text-slate-700 mb-1">
                Cycle
              </label>
              <select
                id="cycle"
                name="cycle"
                defaultValue={filters.cycle || 'all'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
              >
                <option value="all">All Cycles</option>
                <option value="A_11th">Cycle A (11th)</option>
                <option value="B_20th">Cycle B (20th)</option>
              </select>
            </div>
          )}

          {/* Employee Filter */}
          {showEmployeeFilter && (
            <div className="md:col-span-3">
              <label htmlFor="employee" className="block text-xs font-medium text-slate-700 mb-1">
                Assigned Employee
              </label>
              <select
                id="employee"
                name="employee"
                defaultValue={filters.employee || 'all'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
              >
                <option value="all">All Staff Members</option>
                <option value="unassigned">Unassigned Only</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Document Type Filter */}
          {showDocTypeFilter && (
            <div className="md:col-span-2">
              <label htmlFor="document_type_id" className="block text-xs font-medium text-slate-700 mb-1">
                Document Type
              </label>
              <select
                id="document_type_id"
                name="document_type_id"
                defaultValue={filters.document_type_id || 'all'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
              >
                <option value="all">All Document Types</option>
                {documentTypes.map((dt) => (
                  <option key={dt.id} value={dt.id}>
                    {dt.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          {showStatusFilter && (
            <div className="md:col-span-2">
              <label htmlFor="status" className="block text-xs font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={filters.status || 'all'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
              >
                {activeReport === 'pending_documents' ? (
                  <>
                    <option value="all">All Pending</option>
                    <option value="awaiting_receipt">Awaiting Receipt</option>
                    <option value="received_not_dispatched">Received - Not Dispatched</option>
                  </>
                ) : (
                  <>
                    <option value="all">All Dispatches</option>
                    <option value="active">Active Only</option>
                    <option value="voided">Voided Only</option>
                  </>
                )}
              </select>
            </div>
          )}

          {/* Due Date Range (Only for Pending Documents) */}
          {showDueDateFilter && (
            <>
              <div className="md:col-span-3">
                <label htmlFor="due_date_from" className="block text-xs font-medium text-slate-700 mb-1">
                  Due Date From
                </label>
                <input
                  type="date"
                  id="due_date_from"
                  name="due_date_from"
                  defaultValue={filters.due_date_from || ''}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                />
              </div>
              <div className="md:col-span-3">
                <label htmlFor="due_date_to" className="block text-xs font-medium text-slate-700 mb-1">
                  Due Date To
                </label>
                <input
                  type="date"
                  id="due_date_to"
                  name="due_date_to"
                  defaultValue={filters.due_date_to || ''}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                />
              </div>
            </>
          )}

          {/* Apply Filter Button */}
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-500 min-h-[40px]"
            >
              Update Preview
            </button>
          </div>
        </form>
      </div>

      {/* Export Action Card & Preview Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-base">
              {dataset.sheetTitle}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              {dataset.data.length} total {dataset.data.length === 1 ? 'record' : 'records'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Export uses the exact same database views as the Dashboard and operational lists.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-3">
          {/* Excel Export */}
          <a
            href={buildExportUrl('xlsx')}
            onClick={() => {
              setIsExportingExcel(true)
              setTimeout(() => setIsExportingExcel(false), 2500)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{isExportingExcel ? 'Downloading...' : 'Export Excel (.xlsx)'}</span>
          </a>

          {/* CSV Export */}
          <a
            href={buildExportUrl('csv')}
            onClick={() => {
              setIsExportingCsv(true)
              setTimeout(() => setIsExportingCsv(false), 2500)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors shadow-2xs"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{isExportingCsv ? 'Downloading...' : 'Export CSV (.csv)'}</span>
          </a>
        </div>
      </div>

      {/* On-Screen Preview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="font-semibold text-slate-700">
            Live Data Preview (First {Math.min(previewRows.length, 50)} of {dataset.data.length} records)
          </div>
          {dataset.data.length > 50 && (
            <div className="text-slate-500 italic">
              * Full {dataset.data.length} records will be included in the exported file
            </div>
          )}
        </div>

        {dataset.data.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              No records found for current criteria
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              There are no rows matching your selected filters in the live database view.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-2xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  {dataset.columns.map((col) => (
                    <th key={col.key} scope="col" className="px-3.5 py-3 whitespace-nowrap">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    {dataset.columns.map((col) => {
                      const val = row[col.key]
                      const stringVal = val === null || val === undefined ? '—' : String(val)

                      // Custom rendering for common compliance fields
                      if (col.key === 'status') {
                        return (
                          <td key={col.key} className="px-3.5 py-2.5 whitespace-nowrap">
                            <StatusBadge status={stringVal as BadgeStatus} />
                          </td>
                        )
                      }

                      if (col.key === 'is_overdue') {
                        const isOverdue = stringVal.includes('YES') || stringVal === 'true'
                        return (
                          <td key={col.key} className="px-3.5 py-2.5 whitespace-nowrap">
                            {isOverdue ? (
                              <span className="px-2 py-0.5 text-2xs font-bold rounded bg-red-100 text-red-800 border border-red-300">
                                YES (OVERDUE)
                              </span>
                            ) : (
                              <span className="text-slate-500">No</span>
                            )}
                          </td>
                        )
                      }

                      if (col.key === 'is_required') {
                        return (
                          <td key={col.key} className="px-3.5 py-2.5 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-2xs font-bold ${
                                stringVal === 'Required'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : 'bg-slate-50 text-slate-500'
                              }`}
                            >
                              {stringVal}
                            </span>
                          </td>
                        )
                      }

                      if (col.key === 'plain_reason') {
                        return (
                          <td key={col.key} className="px-3.5 py-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-medium ${
                                stringVal.includes('Received')
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {stringVal}
                            </span>
                          </td>
                        )
                      }

                      return (
                        <td key={col.key} className="px-3.5 py-2.5 whitespace-nowrap font-medium text-slate-800">
                          {stringVal}
                        </td>
                      )
                    })}
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
