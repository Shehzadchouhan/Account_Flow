'use client'

import { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import { parseImportAction, confirmImportAction } from './actions'
import type { ImportPreviewResult } from '@/lib/import-parser'
import { generateCsvString } from '@/lib/export-utils'

export function FirmImporter() {
  const [file, setFile] = useState<File | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isParsing, startParseTransition] = useTransition()
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null)

  // Confirmation state
  const [createUnknownDocs, setCreateUnknownDocs] = useState(false)
  const [isConfirming, startConfirmTransition] = useTransition()
  const [confirmResult, setConfirmResult] = useState<{
    importedCount: number
    skippedCount: number
    createdDocTypes: number
  } | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'issues'>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    setFile(selected)
    setParseError(null)
    setPreviewResult(null)
    setConfirmResult(null)
    setConfirmError(null)
  }

  const handleParse = () => {
    if (!file) return

    setParseError(null)
    setConfirmResult(null)
    setConfirmError(null)

    const formData = new FormData()
    formData.append('file', file)

    startParseTransition(async () => {
      const res = await parseImportAction(formData)
      if (!res.success) {
        setParseError(res.error || 'Failed to parse file.')
      } else if (res.data) {
        setPreviewResult(res.data)
      }
    })
  }

  const handleReset = () => {
    setFile(null)
    setPreviewResult(null)
    setConfirmResult(null)
    setConfirmError(null)
    setParseError(null)
    setCreateUnknownDocs(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleConfirmImport = () => {
    if (!previewResult) return

    setConfirmError(null)
    startConfirmTransition(async () => {
      const res = await confirmImportAction(previewResult.rows, createUnknownDocs)
      if (!res.success) {
        setConfirmError(res.error || 'Failed to complete import.')
      } else {
        setConfirmResult({
          importedCount: res.importedCount ?? 0,
          skippedCount: res.skippedCount ?? 0,
          createdDocTypes: res.createdDocTypes ?? 0,
        })
      }
    })
  }

  // Generate downloadable Error Report CSV for skipped / invalid rows
  const downloadErrorReport = () => {
    if (!previewResult) return

    const issueRows = previewResult.rows.filter((r) => {
      if (
        createUnknownDocs &&
        r.status === 'Unknown document type' &&
        r.reasons.every((msg) => msg.startsWith('Unknown document types:'))
      ) {
        return false // Will be imported
      }
      return r.status !== 'Valid'
    })

    const columns = [
      { header: 'Row Number', key: 'rowNumber' },
      { header: 'Firm Name', key: 'firm_name' },
      { header: 'Status', key: 'status' },
      { header: 'Reasons / Validation Errors', key: 'reasons' },
    ]

    const data = issueRows.map((r) => ({
      rowNumber: r.rowNumber,
      firm_name: r.firm_name || '(Blank)',
      status: r.status,
      reasons: r.reasons.join('; '),
    }))

    const csvString = generateCsvString(columns, data)
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `FinanceFlow_Import_Error_Report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calculate effective valid count based on whether admin agreed to create unknown doc types
  const effectiveValidRows = previewResult?.rows.filter((r) => {
    if (r.status === 'Valid') return true
    if (
      createUnknownDocs &&
      r.status === 'Unknown document type' &&
      r.reasons.every((msg) => msg.startsWith('Unknown document types:'))
    ) {
      return true
    }
    return false
  }) || []

  const displayedRows = previewResult?.rows.filter((r) => {
    if (statusFilter === 'valid') return r.status === 'Valid'
    if (statusFilter === 'issues') return r.status !== 'Valid'
    return true
  }) || []

  return (
    <div className="space-y-6">
      {/* 1. Downloadable Template Callout */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Download Import Template
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Download our standard formatted spreadsheet with predefined columns: Firm Name, Contact Person, Email, Phone, Default Employee Email, Required Documents, and Optional Documents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="/api/admin/template?format=xlsx"
            download
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs min-h-[38px] flex-1 sm:flex-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel Template (.xlsx)
          </a>
          <a
            href="/api/admin/template?format=csv"
            download
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 transition-colors shadow-2xs min-h-[38px] flex-1 sm:flex-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV Template (.csv)
          </a>
        </div>
      </div>

      {/* 2. File Upload Area */}
      {!previewResult && !confirmResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-8 shadow-2xs text-center space-y-4">
          <div className="max-w-md mx-auto space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Upload Client Firms Spreadsheet
            </h3>
            <p className="text-xs text-slate-500">
              Supported formats: <span className="font-semibold text-slate-700">.xlsx</span> or <span className="font-semibold text-slate-700">.csv</span>.
              Maximum size: 5 MB. Maximum row limit: 2,000 rows.
            </p>

            <div className="pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-lg p-2"
              />
            </div>

            {parseError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg text-left">
                <span className="font-bold">Upload Error:</span> {parseError}
              </div>
            )}

            <button
              type="button"
              onClick={handleParse}
              disabled={!file || isParsing}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-2xs min-h-[44px]"
            >
              {isParsing ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Parsing Spreadsheet...</span>
                </>
              ) : (
                <span>Upload &amp; Generate Preview</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. Successful Import Result Banner */}
      {confirmResult && (
        <div className="bg-white rounded-xl border border-emerald-200 p-5 sm:p-8 shadow-xs text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mb-1">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            Batch Import Successful!
          </h3>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Successfully created <span className="font-bold text-emerald-700">{confirmResult.importedCount}</span> client firm(s) with required document templates.
            {confirmResult.createdDocTypes > 0 && (
              <span> Registered {confirmResult.createdDocTypes} new document type(s).</span>
            )}
            {confirmResult.skippedCount > 0 && (
              <span> {confirmResult.skippedCount} row(s) were safely skipped due to validation rules or existing entries.</span>
            )}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4">
            <Link
              href="/firms"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-2xs min-h-[44px]"
            >
              <span>View Registered Firms</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>

            {confirmResult.skippedCount > 0 && (
              <button
                type="button"
                onClick={downloadErrorReport}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                <span>Download Error Report (CSV)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 min-h-[44px] flex items-center justify-center"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* 4. Validation Preview & Confirmation Stage */}
      {previewResult && !confirmResult && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Summary Metric Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Rows In File
              </span>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">
                {previewResult.totalRows}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                Valid Ready Rows
              </span>
              <div className="mt-2 text-2xl font-extrabold text-emerald-700">
                {effectiveValidRows.length}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Rows with Issues
              </span>
              <div className="mt-2 text-2xl font-extrabold text-amber-700">
                {previewResult.totalRows - effectiveValidRows.length}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
                Unknown Doc Types
              </span>
              <div className="mt-2 text-2xl font-extrabold text-purple-700">
                {previewResult.unknownDocTypes.length}
              </div>
            </div>
          </div>

          {/* Unknown Document Types Warning / Option */}
          {previewResult.unknownDocTypes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="space-y-2 flex-1">
                  <h4 className="text-sm font-bold text-amber-900">
                    Unknown Document Types Detected ({previewResult.unknownDocTypes.length})
                  </h4>
                  <p className="text-xs text-amber-800">
                    The following document types are not present in your catalog:{' '}
                    <span className="font-semibold font-mono">
                      {previewResult.unknownDocTypes.join(', ')}
                    </span>
                    .
                  </p>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createUnknownDocs}
                      onChange={(e) => setCreateUnknownDocs(e.target.checked)}
                      className="h-4 w-4 rounded-sm border-amber-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-amber-950">
                      Create unknown document types automatically in master catalog during import
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Alert / Errors */}
          {confirmError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              <span className="font-bold">Error executing import:</span> {confirmError}
            </div>
          )}

          {/* Table Header Filter Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Filter Preview:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors min-h-[32px] ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Rows ({previewResult.totalRows})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('valid')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors min-h-[32px] ${
                  statusFilter === 'valid'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                Valid ({previewResult.validCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('issues')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors min-h-[32px] ${
                  statusFilter === 'issues'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Issues ({previewResult.issueCount})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {previewResult.issueCount > 0 && (
                <button
                  type="button"
                  onClick={downloadErrorReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 transition-colors min-h-[36px]"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download Error Report (CSV)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 min-h-[36px] flex items-center"
              >
                Discard &amp; Re-upload
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-3 py-3 w-14">Row</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3">Firm Name</th>
                    <th scope="col" className="px-3 py-3">Contact Person</th>
                    <th scope="col" className="px-3 py-3">Email</th>
                    <th scope="col" className="px-3 py-3">Phone</th>
                    <th scope="col" className="px-3 py-3">Default Employee</th>
                    <th scope="col" className="px-3 py-3">Required Documents</th>
                    <th scope="col" className="px-3 py-3">Reasons / Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRows.map((r) => {
                    const isValidRow =
                      r.status === 'Valid' ||
                      (createUnknownDocs &&
                        r.status === 'Unknown document type' &&
                        r.reasons.every((msg) => msg.startsWith('Unknown document types:')))

                    return (
                      <tr
                        key={r.rowNumber}
                        className={`hover:bg-slate-50 transition-colors ${
                          !isValidRow ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono text-slate-500">
                          #{r.rowNumber}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {isValidRow ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              VALID
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-red-100 text-red-800 border border-red-300">
                              {r.status.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                          {r.firm_name || <span className="text-red-500 italic">(Blank)</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {r.contact_person || '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {r.contact_email || '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {r.contact_phone || '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {r.employee_email || '—'}
                        </td>
                        <td className="px-3 py-2.5 max-w-xs truncate" title={r.required_documents.join(', ')}>
                          {r.required_documents.length > 0 ? r.required_documents.join(', ') : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-red-600 max-w-xs">
                          {r.reasons.length > 0 ? r.reasons.join('; ') : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-xs text-slate-600">
                <span className="font-semibold text-slate-900">{effectiveValidRows.length}</span> firm(s) ready to import in 1 transaction.{' '}
                {previewResult.totalRows - effectiveValidRows.length > 0 && (
                  <span className="text-amber-800">
                    ({previewResult.totalRows - effectiveValidRows.length} row(s) with errors will be skipped)
                  </span>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors min-h-[40px] text-center"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={effectiveValidRows.length === 0 || isConfirming}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-2xs min-h-[40px] text-center"
                >
                  {isConfirming ? (
                    <>
                      <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Importing in One Transaction...</span>
                    </>
                  ) : (
                    <span>Confirm &amp; Import ({effectiveValidRows.length} Firms)</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
