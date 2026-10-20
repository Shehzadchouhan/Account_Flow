'use client'

import React, { useState } from 'react'
import { createDispatchAction } from '../dispatch-actions'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDateTimeIST, toInputDateTimeLocalIST } from '@/lib/date-utils'
import type { CaseDocumentItem } from './CaseChecklistTable'

interface RecordDispatchModalProps {
  isOpen: boolean
  onClose: () => void
  caseId: string
  firmName: string
  periodMonth: string
  cycle: string
  availableDocuments: CaseDocumentItem[] // Filtered to 'Received - Not Dispatched'
  initialSelectedDocIds?: string[]
  distinctRecipients: string[]
}

export function RecordDispatchModal({
  isOpen,
  onClose,
  caseId,
  firmName,
  periodMonth,
  cycle,
  availableDocuments,
  initialSelectedDocIds = [],
  distinctRecipients,
}: RecordDispatchModalProps) {
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(() =>
    initialSelectedDocIds.length > 0
      ? initialSelectedDocIds
      : availableDocuments.map((d) => d.case_document_id)
  )
  const [recipient, setRecipient] = useState('')
  const [sentAt, setSentAt] = useState(() => toInputDateTimeLocalIST(new Date()))
  const [emailReference, setEmailReference] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>(undefined)

  if (!isOpen) return null

  const cycleLabel = cycle === 'A_11th' ? 'Cycle A (11th)' : 'Cycle B (20th)'

  const handleToggleDoc = (docId: string) => {
    if (selectedDocIds.includes(docId)) {
      setSelectedDocIds(selectedDocIds.filter((id) => id !== docId))
    } else {
      setSelectedDocIds([...selectedDocIds, docId])
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocIds(availableDocuments.map((d) => d.case_document_id))
    } else {
      setSelectedDocIds([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors(undefined)

    if (selectedDocIds.length === 0) {
      setErrorMsg('Please select at least one document to dispatch.')
      return
    }

    if (!recipient.trim()) {
      setErrorMsg('Please provide a recipient name.')
      return
    }

    try {
      setIsSubmitting(true)
      const formData = new FormData()
      formData.set('case_id', caseId)
      formData.set('recipient', recipient.trim())
      formData.set('sent_at', sentAt ? new Date(sentAt).toISOString() : new Date().toISOString())
      if (emailReference.trim()) {
        formData.set('email_reference', emailReference.trim())
      }
      if (receiptFile) {
        formData.set('receipt_file', receiptFile)
      }
      formData.set('idempotency_key', idempotencyKey)
      selectedDocIds.forEach((id) => formData.append('case_document_ids', id))

      const result = await createDispatchAction(null, formData)
      if (result.success) {
        onClose()
      } else {
        setErrorMsg(result.error || 'Failed to record outward dispatch.')
        setFieldErrors(result.fieldErrors)
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedDocs = availableDocuments.filter((d) => selectedDocIds.includes(d.case_document_id))

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-dispatch-title"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div>
                <h2 id="record-dispatch-title" className="text-xl font-bold">
                  Record Outward Dispatch
                </h2>
                <p className="text-sm text-blue-100">
                  {firmName} • {periodMonth} • {cycleLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close dialog"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-sm text-red-800 font-medium">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Section 1: Documents Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-900">
                1. Select Documents to Dispatch{' '}
                <span className="text-blue-600 font-normal">
                  ({selectedDocIds.length} of {availableDocuments.length} selected)
                </span>
              </label>
              {availableDocuments.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectAll(selectedDocIds.length !== availableDocuments.length)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  {selectedDocIds.length === availableDocuments.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {availableDocuments.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-sm text-amber-900">
                <p className="font-semibold">No received documents awaiting dispatch.</p>
                <p className="text-xs text-amber-700 mt-1">
                  Only documents that are currently in <strong>Received</strong> status and not already dispatched can be sent out.
                </p>
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                {availableDocuments.map((doc) => {
                  const isChecked = selectedDocIds.includes(doc.case_document_id)
                  return (
                    <label
                      key={doc.case_document_id}
                      className={`flex items-center justify-between p-3 cursor-pointer hover:bg-blue-50/60 transition-colors ${
                        isChecked ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDoc(doc.case_document_id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                            <span>{doc.document_type_name}</span>
                            <StatusBadge status={doc.is_required ? 'REQUIRED' : 'OPTIONAL'} size="sm" />
                          </div>
                          {doc.received_at && (
                            <div className="text-xs text-slate-500">
                              Received: {formatDateTimeIST(doc.received_at)}
                            </div>
                          )}
                        </div>
                      </div>
                      <StatusBadge status="Received - Not Dispatched" size="sm" />
                    </label>
                  )
                })}
              </div>
            )}
            {fieldErrors?.case_document_ids && (
              <p className="text-xs text-red-600">{fieldErrors.case_document_ids.join(', ')}</p>
            )}
          </div>

          {/* Section 2: Outward Details */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">2. Outward Dispatch Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Recipient */}
              <div>
                <label htmlFor="dispatch-recipient" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Recipient <span className="text-red-500">*</span>
                </label>
                <input
                  id="dispatch-recipient"
                  type="text"
                  list="dispatch-recipients-list"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="e.g. Auditor M. K. Sharma / Tax Dept"
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <datalist id="dispatch-recipients-list">
                  {distinctRecipients.map((rec) => (
                    <option key={rec} value={rec} />
                  ))}
                </datalist>
                <p className="text-2xs text-slate-500 mt-1">Select from suggestions or type a new name</p>
                {fieldErrors?.recipient && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.recipient.join(', ')}</p>
                )}
              </div>

              {/* Sent At (IST) */}
              <div>
                <label htmlFor="dispatch-sent-at" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Sent Date & Time (IST) <span className="text-red-500">*</span>
                </label>
                <input
                  id="dispatch-sent-at"
                  type="datetime-local"
                  value={sentAt}
                  onChange={(e) => setSentAt(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-2xs text-slate-500 mt-1">Cannot be in the future</p>
                {fieldErrors?.sent_at && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.sent_at.join(', ')}</p>
                )}
              </div>
            </div>

            {/* Email Subject / Reference */}
            <div>
              <label htmlFor="dispatch-email-ref" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Subject / Reference (Optional)
              </label>
              <input
                id="dispatch-email-ref"
                type="text"
                value={emailReference}
                onChange={(e) => setEmailReference(e.target.value)}
                placeholder="e.g. Final TDS & Bank Statements sent via email for audit review"
                maxLength={300}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-2xs text-slate-500 mt-1">Tracks reference numbers, email subjects, or tracking IDs</p>
            </div>

            {/* Postal / Courier Receipt Upload */}
            <div>
              <label htmlFor="dispatch-receipt-file" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Postal Receipt / Courier Challan Scan (Optional)
              </label>
              <input
                id="dispatch-receipt-file"
                type="file"
                accept="application/pdf,image/*"
                disabled={isSubmitting}
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 file:mr-2.5 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              <p className="text-2xs text-slate-500 mt-1">Upload photo or PDF scan of Speed Post receipt or courier challan</p>
            </div>
          </div>

          {/* Section 3: Summary & Warning */}
          {selectedDocs.length > 0 && recipient.trim().length > 0 && (
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2 text-xs text-slate-700">
              <div className="font-semibold text-blue-900 text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Dispatch Summary Review</span>
              </div>
              <p>
                Transmitting <strong>{selectedDocs.length} documents</strong> to <strong>{recipient.trim()}</strong>.
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                {selectedDocs.map((doc) => (
                  <li key={doc.case_document_id}>
                    {doc.document_type_name} {doc.is_required ? '(Required)' : '(Optional)'}
                  </li>
                ))}
              </ul>
              <p className="text-2xs text-slate-500 pt-1">
                Once recorded, these documents cannot be un-received or dispatched again unless this dispatch is voided by an administrator.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedDocIds.length === 0 || availableDocuments.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Recording Dispatch...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Confirm Outward Dispatch</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
