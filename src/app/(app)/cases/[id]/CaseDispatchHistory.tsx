'use client'

import React, { useState } from 'react'
import { voidDispatchAction } from '../dispatch-actions'
import { StatusBadge } from '@/components/StatusBadge'
import { DispatchEmailButton } from '@/components/DispatchEmailButton'
import { formatDateTimeIST } from '@/lib/date-utils'

export interface CaseDispatchItem {
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

interface FirmContactInfo {
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
}

interface CaseDispatchHistoryProps {
  caseId: string
  dispatches: CaseDispatchItem[]
  isAdmin: boolean
  firmName?: string
  firmContact?: FirmContactInfo | null
}

export function CaseDispatchHistory({
  caseId,
  dispatches,
  isAdmin,
  firmName,
  firmContact,
}: CaseDispatchHistoryProps) {
  const [selectedVoidDispatch, setSelectedVoidDispatch] = useState<CaseDispatchItem | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [isVoiding, setIsVoiding] = useState(false)
  const [voidError, setVoidError] = useState<string | null>(null)

  const handleOpenVoidModal = (disp: CaseDispatchItem) => {
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
      formData.set('case_id', caseId)
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
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span>Outward Dispatch History</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {dispatches.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit log of outward transmissions sent to CAs, auditors, or departments.
          </p>
        </div>
      </div>

      {dispatches.length === 0 ? (
        <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm font-medium text-slate-700">No outward dispatches recorded yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Once received documents are dispatched, they will appear here with full audit history and sender details.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dispatches.map((disp) => {
            const isVoided = Boolean(disp.voided_at)
            const activeItems = disp.dispatch_items?.filter((item) => item.is_active) || []
            const allItems = disp.dispatch_items || []

            return (
              <div
                key={disp.id}
                className={`rounded-xl border transition-all p-5 ${
                  isVoided
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                {/* Top Row: Recipient, Status Badge, and Date */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 text-base">{disp.recipient}</span>
                    {isVoided ? (
                      <StatusBadge status="VOIDED" size="sm" />
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        <span>ACTIVE DISPATCH</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>Sent: <strong className="text-slate-700">{formatDateTimeIST(disp.sent_at)}</strong></span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 py-3 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Recorded By</span>
                    <span className="text-slate-800 font-medium">
                      {disp.recorder?.full_name || 'Staff Member'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Email / Subject Reference</span>
                    <span className="text-slate-800 font-medium truncate block">
                      {disp.email_reference || 'None specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Documents Count</span>
                    <span className="text-slate-800 font-medium">
                      {isVoided ? `${allItems.length} (voided)` : `${activeItems.length} active documents`}
                    </span>
                  </div>
                </div>

                {/* Documents Tag List */}
                <div className="pt-2">
                  <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Included Documents
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {allItems.map((item) => (
                      <span
                        key={item.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border ${
                          isVoided
                            ? 'bg-rose-50 text-rose-800 border-rose-200 line-through opacity-75'
                            : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>{item.case_document?.document_type?.name || 'Document'}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Voided Details Banner */}
                {isVoided && (
                  <div className="mt-3 p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-900 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-rose-800">
                        <svg className="w-4 h-4 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>Dispatch Voided Audit Notice</span>
                      </span>
                      <span className="text-2xs text-rose-600">
                        {formatDateTimeIST(disp.voided_at)}
                      </span>
                    </div>
                    <p className="text-slate-800">
                      <strong>Reason:</strong> {disp.void_reason}
                    </p>
                    <p className="text-2xs text-slate-500">
                      Voided by: {disp.voider?.full_name || 'Administrator'} • Documents reverted to &apos;Received - Not Dispatched&apos;.
                    </p>
                  </div>
                )}

                {/* Actions: Email Advice & Admin Void Button */}
                {!isVoided && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      {firmName && (
                        <DispatchEmailButton
                          firmName={firmName}
                          contactPerson={firmContact?.contact_person}
                          contactEmail={firmContact?.contact_email}
                          recipient={disp.recipient}
                          trackingNumber={disp.email_reference}
                          sentAt={disp.sent_at}
                          dispatchedDocuments={activeItems.map((i) => i.case_document?.document_type?.name || 'Document')}
                          senderName={disp.recorder?.full_name}
                        />
                      )}
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenVoidModal(disp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors min-h-[36px]"
                      >
                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Void Dispatch</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Admin Void Confirmation Modal */}
      {selectedVoidDispatch && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-dispatch-title"
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
                    <h3 id="void-dispatch-title" className="text-lg font-bold">
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
                <label htmlFor="void-reason" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Voiding <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="void-reason"
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Sent incorrect TDS schedule; CA requested revision with updated invoice list."
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
    </div>
  )
}
