'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDateTimeIST, formatMonthYear } from '@/lib/date-utils'
import { voidDispatchAction } from '../cases/dispatch-actions'

export interface GlobalDispatchItem {
  id: string
  case_id: string
  recipient: string
  sent_at: string
  recorded_by: string
  email_reference: string | null
  idempotency_key: string | null
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  created_at: string
  case?: {
    id: string
    period_month: string
    cycle: string
    firm_id: string
    firm?: {
      name: string
    } | null
  } | null
  recorder?: { full_name: string } | null
  voider?: { full_name: string } | null
  dispatch_items?: Array<{
    id: string
    is_active: boolean
    case_document_id: string
    case_document?: {
      id: string
      document_type?: {
        name: string
      } | null
    } | null
  }> | null
}

interface DispatchesTableProps {
  dispatches: GlobalDispatchItem[]
  isAdmin: boolean
}

export function DispatchesTable({ dispatches, isAdmin }: DispatchesTableProps) {
  const [selectedVoidDispatch, setSelectedVoidDispatch] = useState<GlobalDispatchItem | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [isVoiding, setIsVoiding] = useState(false)
  const [voidError, setVoidError] = useState<string | null>(null)

  const handleOpenVoidModal = (disp: GlobalDispatchItem) => {
    setSelectedVoidDispatch(disp)
    setVoidReason('')
    setVoidError(null)
  }

  const handleCloseVoidModal = () => {
    if (isVoiding) return
    setSelectedVoidDispatch(null)
    setVoidReason('')
    setVoidError(null)
  }

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVoidDispatch) return

    if (!voidReason.trim() || voidReason.trim().length < 5) {
      setVoidError('Please provide a reason of at least 5 characters.')
      return
    }

    try {
      setIsVoiding(true)
      setVoidError(null)

      const formData = new FormData()
      formData.set('dispatch_id', selectedVoidDispatch.id)
      formData.set('case_id', selectedVoidDispatch.case_id)
      formData.set('reason', voidReason.trim())

      const result = await voidDispatchAction(null, formData)
      if (result.success) {
        handleCloseVoidModal()
      } else {
        setVoidError(result.error || 'Failed to void dispatch.')
      }
    } catch (err: unknown) {
      setVoidError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsVoiding(false)
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Sent At (IST)
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Firm & Case
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Recipient
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Documents
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Recorded By
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200 text-sm">
            {dispatches.map((disp) => {
              const isVoided = Boolean(disp.voided_at)
              const firmName = disp.case?.firm?.name || 'Firm'
              const month = formatMonthYear(disp.case?.period_month)
              const cycle = disp.case?.cycle === 'A_11th' ? 'Cycle A' : 'Cycle B'
              const allDocs = disp.dispatch_items || []
              const activeDocs = allDocs.filter((d) => d.is_active)

              return (
                <tr
                  key={disp.id}
                  className={`hover:bg-slate-50 transition-colors ${isVoided ? 'bg-rose-50/20' : ''}`}
                >
                  {/* Sent Date & Time */}
                  <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">{formatDateTimeIST(disp.sent_at)}</div>
                    {disp.email_reference && (
                      <div className="text-2xs text-slate-500 truncate max-w-[200px]" title={disp.email_reference}>
                        Ref: {disp.email_reference}
                      </div>
                    )}
                  </td>

                  {/* Firm & Case */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <Link
                      href={`/cases/${disp.case_id}`}
                      className="font-semibold text-blue-600 hover:text-blue-800 hover:underline block"
                    >
                      {firmName}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {month} • {cycle}
                    </span>
                  </td>

                  {/* Recipient */}
                  <td className="px-4 py-4 whitespace-nowrap font-medium text-slate-900 text-xs">
                    {disp.recipient}
                  </td>

                  {/* Documents */}
                  <td className="px-4 py-4 text-xs text-slate-600">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {allDocs.map((item) => (
                        <span
                          key={item.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium border ${
                            isVoided
                              ? 'bg-rose-50 text-rose-800 border-rose-200 line-through'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          {item.case_document?.document_type?.name || 'Doc'}
                        </span>
                      ))}
                    </div>
                    <span className="text-2xs text-slate-400 mt-0.5 block">
                      {isVoided ? `${allDocs.length} voided items` : `${activeDocs.length} active documents`}
                    </span>
                  </td>

                  {/* Recorded By */}
                  <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-700">
                    {disp.recorder?.full_name || 'Staff Member'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {isVoided ? (
                      <div className="space-y-1">
                        <StatusBadge status="VOIDED" size="sm" />
                        <div
                          className="text-2xs text-rose-700 font-medium truncate max-w-[160px]"
                          title={`Reason: ${disp.void_reason} (by ${disp.voider?.full_name || 'Admin'})`}
                        >
                          {disp.void_reason}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        <span>ACTIVE DISPATCH</span>
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4 text-right whitespace-nowrap text-xs space-x-2">
                    <Link
                      href={`/cases/${disp.case_id}`}
                      className="inline-flex items-center px-2.5 py-1.5 font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md min-h-[32px] transition-colors"
                    >
                      View Case &rarr;
                    </Link>

                    {!isVoided && isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenVoidModal(disp)}
                        className="inline-flex items-center px-2.5 py-1.5 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md min-h-[32px] transition-colors"
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Admin Void Confirmation Modal */}
      {selectedVoidDispatch && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-void-title"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-rose-700 to-red-800 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 id="global-void-title" className="text-lg font-bold">
                      Void Outward Dispatch
                    </h3>
                    <p className="text-xs text-rose-100">
                      Recipient: {selectedVoidDispatch.recipient}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseVoidModal}
                  disabled={isVoiding}
                  className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleConfirmVoid} className="p-6 space-y-4">
              {voidError && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-xs text-red-800 font-medium">
                  {voidError}
                </div>
              )}

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold">Permanent Audit Trail Policy</p>
                <p>
                  Dispatches are never hard-deleted. Voiding will deactivate all dispatch items, revert their status to <strong>&apos;Received - Not Dispatched&apos;</strong>, and record your reason in the activity logs.
                </p>
              </div>

              <div>
                <label htmlFor="global-void-reason" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Voiding <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="global-void-reason"
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Sent wrong documents; Auditor requested revised statements with updated schedule."
                  required
                  disabled={isVoiding}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
                <p className="text-2xs text-slate-500 mt-1">Minimum 5 characters explaining the correction</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseVoidModal}
                  disabled={isVoiding}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVoiding || voidReason.trim().length < 5}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 min-h-[44px]"
                >
                  {isVoiding ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Voiding...</span>
                    </>
                  ) : (
                    <span>Confirm Void Dispatch</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
