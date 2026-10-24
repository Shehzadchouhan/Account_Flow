'use client'

import { useState } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import {
  receiveDocumentAction,
  unreceiveDocumentAction,
  bulkReceiveDocumentsAction,
  updateCaseNotesAction,
  removeCaseDocumentAction,
  setDocumentRequiredAction,
  addCaseDocumentAction,
} from '../actions'
import { RecordDispatchModal } from './RecordDispatchModal'
import { DocumentAttachmentModal } from '@/components/DocumentAttachmentModal'
import type { CaseDocumentStatusType } from '@/types/database.types'

export interface CaseDocumentItem {
  case_document_id: string
  case_id: string
  document_type_id: string
  document_type_name: string
  is_required: boolean
  received_at: string | null
  received_by: string | null
  notes: string | null
  status: CaseDocumentStatusType
  created_at: string
  file_url?: string | null
  file_name?: string | null
  file_size?: number | null
  file_type?: string | null
}

interface DocumentTypeOption {
  id: string
  name: string
  description: string | null
}

interface CaseChecklistTableProps {
  caseId: string
  firmName: string
  periodMonth: string
  cycle: string
  documents: CaseDocumentItem[]
  availableDocumentTypes: DocumentTypeOption[]
  distinctRecipients?: string[]
  isAdmin: boolean
}

export function CaseChecklistTable({
  caseId,
  firmName,
  periodMonth,
  cycle,
  documents,
  availableDocumentTypes,
  distinctRecipients = [],
  isAdmin,
}: CaseChecklistTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [singleConfirmDoc, setSingleConfirmDoc] = useState<{
    doc: CaseDocumentItem
    action: 'receive' | 'unreceive' | 'remove'
  } | null>(null)
  const [editingNotesDocId, setEditingNotesDocId] = useState<string | null>(null)
  const [currentNotes, setCurrentNotes] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newDocTypeId, setNewDocTypeId] = useState('')
  const [newDocRequired, setNewDocRequired] = useState(true)

  // Dispatch Modal State
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false)
  const [dispatchInitialDocIds, setDispatchInitialDocIds] = useState<string[]>([])

  // Attachment Modal State
  const [attachmentModalDoc, setAttachmentModalDoc] = useState<CaseDocumentItem | null>(null)

  const [isPending, setIsPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Unconfigured document types for this case
  const existingTypeIds = new Set(documents.map((d) => d.document_type_id))
  const unconfiguredTypes = availableDocumentTypes.filter((dt) => !existingTypeIds.has(dt.id))

  // Awaiting documents eligible for bulk receive
  const awaitingDocuments = documents.filter((d) => d.status === 'Awaiting Receipt')

  // Received documents eligible for dispatch
  const undispatchedReceivedDocs = documents.filter((d) => d.status === 'Received - Not Dispatched')

  const handleOpenDispatch = (docIds?: string[]) => {
    setDispatchInitialDocIds(docIds || [])
    setIsDispatchModalOpen(true)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(awaitingDocuments.map((d) => d.case_document_id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleSelect = (docId: string) => {
    if (selectedIds.includes(docId)) {
      setSelectedIds(selectedIds.filter((id) => id !== docId))
    } else {
      setSelectedIds([...selectedIds, docId])
    }
  }

  // Single Document Receive / Unreceive / Remove
  const handleExecuteSingleAction = async () => {
    if (!singleConfirmDoc) return

    try {
      setIsPending(true)
      setActionError(null)

      let res
      if (singleConfirmDoc.action === 'receive') {
        res = await receiveDocumentAction(singleConfirmDoc.doc.case_document_id, caseId)
      } else if (singleConfirmDoc.action === 'unreceive') {
        res = await unreceiveDocumentAction(singleConfirmDoc.doc.case_document_id, caseId)
      } else if (singleConfirmDoc.action === 'remove') {
        res = await removeCaseDocumentAction(singleConfirmDoc.doc.case_document_id, caseId)
      }

      if (res && !res.success) {
        setActionError(res.error || 'Action failed.')
      } else {
        setSingleConfirmDoc(null)
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsPending(false)
    }
  }

  // Bulk Receive Execution
  const handleExecuteBulkReceive = async () => {
    if (selectedIds.length === 0) return

    try {
      setIsPending(true)
      setActionError(null)
      const res = await bulkReceiveDocumentsAction(caseId, selectedIds)
      if (!res.success) {
        setActionError(res.error || 'Failed to bulk-receive documents.')
      } else {
        setSelectedIds([])
        setShowBulkModal(false)
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsPending(false)
    }
  }

  // Notes update
  const handleSaveNotes = async (docId: string) => {
    try {
      setIsPending(true)
      setActionError(null)
      const res = await updateCaseNotesAction(docId, caseId, currentNotes)
      if (!res.success) {
        setActionError(res.error || 'Failed to update notes.')
      } else {
        setEditingNotesDocId(null)
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsPending(false)
    }
  }

  // Admin Toggle Requirement
  const handleToggleRequired = async (docId: string, currentRequired: boolean) => {
    try {
      setIsPending(true)
      setActionError(null)
      const res = await setDocumentRequiredAction(docId, caseId, !currentRequired)
      if (!res.success) {
        setActionError(res.error || 'Failed to update requirement.')
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsPending(false)
    }
  }

  // Admin Add Document to Case
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDocTypeId) return

    try {
      setIsPending(true)
      setActionError(null)
      const res = await addCaseDocumentAction(caseId, newDocTypeId, newDocRequired)
      if (!res.success) {
        setActionError(res.error || 'Failed to add document.')
      } else {
        setNewDocTypeId('')
        setShowAddModal(false)
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsPending(false)
    }
  }

  const selectedDocumentObjects = documents.filter((d) => selectedIds.includes(d.case_document_id))

  return (
    <div className="space-y-6">
      {/* Error Callout */}
      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <strong>Error:</strong> {actionError}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-30 p-4 rounded-xl bg-blue-900 text-white shadow-lg flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-xs font-bold">
              {selectedIds.length}
            </span>
            <span className="text-sm font-semibold">
              {selectedIds.length === 1 ? '1 document selected' : `${selectedIds.length} documents selected`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs font-medium text-blue-200 hover:text-white"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 text-xs font-bold text-blue-950 bg-white hover:bg-blue-50 rounded-lg shadow-xs min-h-[36px]"
            >
              Mark Selected as Received &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Checklist Header & Admin Add Document Control */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Document Checklist</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Check off documents as they arrive, attach PDF scans, and record dispatches when ready
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {undispatchedReceivedDocs.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenDispatch(undispatchedReceivedDocs.map((d) => d.case_document_id))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg min-h-[40px] shadow-2xs transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Dispatch All Received ({undispatchedReceivedDocs.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenDispatch()}
              disabled={undispatchedReceivedDocs.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg min-h-[40px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Record Dispatch</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg min-h-[40px] shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Document to Case</span>
              </button>
            )}
          </div>
        </div>

        {/* Documents Table */}
        {documents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No documents configured for this case.
          </div>
        ) : (
          <>
            {/* Desktop Table View (hidden on mobile, visible on md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3.5 w-12 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all awaiting documents"
                      checked={
                        awaitingDocuments.length > 0 &&
                        selectedIds.length === awaitingDocuments.length
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={awaitingDocuments.length === 0}
                      className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Document Type
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Requirement
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Receipt Details
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Scan / PDF
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Notes
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {documents.map((doc) => {
                  const isAwaiting = doc.status === 'Awaiting Receipt'
                  const isDispatched = doc.status === 'Dispatched'
                  const isSelected = selectedIds.includes(doc.case_document_id)
                  const isEditingNotes = editingNotesDocId === doc.case_document_id

                  return (
                    <tr
                      key={doc.case_document_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${doc.document_type_name}`}
                          checked={isSelected}
                          onChange={() => handleToggleSelect(doc.case_document_id)}
                          disabled={!isAwaiting}
                          className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                        />
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
                        {doc.document_type_name}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={doc.is_required ? 'REQUIRED' : 'OPTIONAL'} size="sm" />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={doc.status} size="sm" />
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-600 whitespace-nowrap">
                        {doc.received_at ? (
                          <div>
                            <div className="font-medium text-slate-900">
                              {new Date(doc.received_at).toLocaleDateString()}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {new Date(doc.received_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not received</span>
                        )}
                      </td>

                      {/* Attachment / Scan */}
                      <td className="px-4 py-4 whitespace-nowrap text-xs">
                        {doc.file_url ? (
                          <button
                            type="button"
                            onClick={() => setAttachmentModalDoc(doc)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs"
                            title={doc.file_name || 'View attached scan'}
                          >
                            <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="max-w-[110px] truncate">{doc.file_name || 'View Scan'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAttachmentModalDoc(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/50 border border-dashed border-slate-300 hover:border-indigo-300 transition-colors"
                            title="Upload PDF or scan via mobile camera"
                          >
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span>+ Attach Scan</span>
                          </button>
                        )}
                      </td>

                      {/* Inline Notes */}
                      <td className="px-4 py-4 text-xs max-w-xs">
                        {isEditingNotes ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={currentNotes}
                              onChange={(e) => setCurrentNotes(e.target.value)}
                              placeholder="Add notes..."
                              className="w-full px-2 py-1 text-xs rounded-md border border-slate-300"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveNotes(doc.case_document_id)}
                              className="px-2 py-1 text-xs font-bold text-white bg-blue-600 rounded-md"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNotesDocId(null)}
                              className="px-2 py-1 text-xs text-slate-500"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingNotesDocId(doc.case_document_id)
                              setCurrentNotes(doc.notes || '')
                            }}
                            className="cursor-pointer hover:bg-slate-100 p-1 rounded-md text-slate-700 flex items-center justify-between group"
                            title="Click to edit notes"
                          >
                            <span className="truncate">{doc.notes || <span className="text-slate-400 italic">Add note...</span>}</span>
                            <span className="opacity-0 group-hover:opacity-100 text-slate-400 text-[10px]">✏️</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right whitespace-nowrap text-xs space-x-1.5">
                        {isAwaiting && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              setSingleConfirmDoc({ doc, action: 'receive' })
                            }
                            className="inline-flex items-center px-2.5 py-1.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md min-h-[32px]"
                          >
                            Mark Received
                          </button>
                        )}

                        {!isAwaiting && !isDispatched && (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleOpenDispatch([doc.case_document_id])}
                              className="inline-flex items-center px-2.5 py-1.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md min-h-[32px] transition-colors"
                            >
                              Dispatch &rarr;
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                setSingleConfirmDoc({ doc, action: 'unreceive' })
                              }
                              className="inline-flex items-center px-2.5 py-1.5 font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md min-h-[32px]"
                            >
                              Undo Receipt
                            </button>
                          </>
                        )}

                        {isDispatched && (
                          <span
                            className="text-slate-400 italic text-[11px]"
                            title="Dispatched documents cannot be un-received unless the dispatch is voided"
                          >
                            Locked in Dispatch
                          </span>
                        )}

                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleToggleRequired(doc.case_document_id, doc.is_required)}
                              className="text-slate-600 hover:text-slate-900 px-2 py-1 hover:bg-slate-100 rounded-md"
                              title="Toggle Required/Optional"
                            >
                              {doc.is_required ? 'Make Opt' : 'Make Req'}
                            </button>

                            <button
                              type="button"
                              disabled={isPending || isDispatched}
                              onClick={() =>
                                setSingleConfirmDoc({ doc, action: 'remove' })
                              }
                              className="text-red-600 hover:text-red-800 disabled:opacity-30 px-2 py-1 hover:bg-red-50 rounded-md"
                              title="Remove from Case"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

            {/* Mobile Stacked Checklist Cards (visible on mobile, hidden on md+) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {documents.map((doc) => {
                const isAwaiting = doc.status === 'Awaiting Receipt'
                const isDispatched = doc.status === 'Dispatched'
                const isSelected = selectedIds.includes(doc.case_document_id)

                return (
                  <div
                    key={`mobile-${doc.case_document_id}`}
                    className={`p-4 space-y-3 transition-colors ${
                      isSelected ? 'bg-blue-50/60' : ''
                    }`}
                  >
                    {/* Header: Select Checkbox + Name + Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          aria-label={`Select ${doc.document_type_name}`}
                          checked={isSelected}
                          onChange={() => handleToggleSelect(doc.case_document_id)}
                          disabled={!isAwaiting}
                          className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-sm block leading-tight">
                            {doc.document_type_name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <StatusBadge status={doc.is_required ? 'REQUIRED' : 'OPTIONAL'} size="sm" />
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={doc.status} size="sm" />
                      </div>
                    </div>

                    {/* Receipt Details & Attachment */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Receipt Status:</span>
                        {doc.received_at ? (
                          <span className="font-semibold text-emerald-800">
                            {new Date(doc.received_at).toLocaleDateString()} at{' '}
                            {new Date(doc.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not received</span>
                        )}
                      </div>

                      {/* Attachment Button */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                        <span className="text-slate-600">Attachment:</span>
                        {doc.file_url ? (
                          <button
                            type="button"
                            onClick={() => setAttachmentModalDoc(doc)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                          >
                            <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="max-w-[120px] truncate">{doc.file_name || 'View Scan'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAttachmentModalDoc(doc)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/50 border border-dashed border-slate-300"
                          >
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span>+ Attach Scan</span>
                          </button>
                        )}
                      </div>

                      {/* Notes row */}
                      {doc.notes && (
                        <div className="pt-1 border-t border-slate-200/60 text-slate-600">
                          <span className="font-medium text-slate-700">Notes: </span>
                          <span>{doc.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      {isAwaiting && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setSingleConfirmDoc({ doc, action: 'receive' })}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg min-h-[38px] transition-colors"
                        >
                          <span>Mark Received</span>
                        </button>
                      )}

                      {!isAwaiting && !isDispatched && (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleOpenDispatch([doc.case_document_id])}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg min-h-[38px] transition-colors"
                          >
                            <span>Dispatch</span>
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => setSingleConfirmDoc({ doc, action: 'unreceive' })}
                            className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg min-h-[38px] transition-colors"
                          >
                            <span>Undo Receipt</span>
                          </button>
                        </>
                      )}

                      {isDispatched && (
                        <span className="text-slate-400 italic text-xs py-1">
                          Locked in Dispatch
                        </span>
                      )}

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleToggleRequired(doc.case_document_id, doc.is_required)}
                            className="text-slate-600 hover:text-slate-900 px-2 py-1.5 text-xs hover:bg-slate-100 rounded-md border border-slate-200"
                          >
                            {doc.is_required ? 'Make Opt' : 'Make Req'}
                          </button>
                          <button
                            type="button"
                            disabled={isPending || isDispatched}
                            onClick={() => setSingleConfirmDoc({ doc, action: 'remove' })}
                            className="text-red-600 hover:text-red-800 disabled:opacity-30 px-2 py-1.5 text-xs hover:bg-red-50 rounded-md border border-red-200"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Single Action Confirmation Modal */}
      {singleConfirmDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="single-action-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <h4 id="single-action-modal-title" className="text-lg font-bold text-slate-900">
              Confirm {singleConfirmDoc.action === 'receive' ? 'Document Receipt' : singleConfirmDoc.action === 'unreceive' ? 'Undo Receipt' : 'Remove Document'}
            </h4>

            <p className="text-xs text-slate-600 leading-relaxed">
              {singleConfirmDoc.action === 'receive' && (
                <>
                  Are you sure you want to mark <strong>{singleConfirmDoc.doc.document_type_name}</strong> as received for this case?
                </>
              )}
              {singleConfirmDoc.action === 'unreceive' && (
                <>
                  Are you sure you want to revert receipt for <strong>{singleConfirmDoc.doc.document_type_name}</strong>? It will return to awaiting status.
                </>
              )}
              {singleConfirmDoc.action === 'remove' && (
                <>
                  Are you sure you want to remove <strong>{singleConfirmDoc.doc.document_type_name}</strong> from this case? It will be soft-deleted from this docket.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSingleConfirmDoc(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleExecuteSingleAction}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg min-h-[38px] ${
                  singleConfirmDoc.action === 'remove'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isPending ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Receive Confirmation Modal */}
      {showBulkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-receive-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div>
              <h4 id="bulk-receive-modal-title" className="text-lg font-bold text-slate-900">
                Bulk Receive Documents ({selectedIds.length})
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                You are marking the following documents as received for this case:
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
              {selectedDocumentObjects.map((d) => (
                <div key={d.case_document_id} className="p-3 text-xs flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{d.document_type_name}</span>
                  <StatusBadge status={d.is_required ? 'REQUIRED' : 'OPTIONAL'} size="sm" />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleExecuteBulkReceive}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg min-h-[38px]"
              >
                {isPending ? 'Receiving...' : `Confirm Receipt of ${selectedIds.length} Documents`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Add Document Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-doc-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div>
              <h4 id="add-doc-modal-title" className="text-lg font-bold text-slate-900">
                Add Document to Case
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Select an unconfigured active document type from the master catalog to attach to this docket.
              </p>
            </div>

            <form onSubmit={handleAddDocument} className="space-y-4">
              <div>
                <label htmlFor="new_doc_type" className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="new_doc_type"
                  value={newDocTypeId}
                  onChange={(e) => setNewDocTypeId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                >
                  <option value="">-- Choose document type --</option>
                  {unconfiguredTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.name} {dt.description ? `(${dt.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="new_doc_req"
                  checked={newDocRequired}
                  onChange={(e) => setNewDocRequired(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="new_doc_req" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Required Document (Affects Case Completion Status)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newDocTypeId}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg min-h-[38px]"
                >
                  {isPending ? 'Adding...' : 'Add to Checklist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Dispatch Modal */}
      {isDispatchModalOpen && (
        <RecordDispatchModal
          isOpen={isDispatchModalOpen}
          onClose={() => setIsDispatchModalOpen(false)}
          caseId={caseId}
          firmName={firmName}
          periodMonth={periodMonth}
          cycle={cycle}
          availableDocuments={undispatchedReceivedDocs}
          initialSelectedDocIds={dispatchInitialDocIds}
          distinctRecipients={distinctRecipients}
        />
      )}

      {/* Document Attachment & Scan Modal */}
      {attachmentModalDoc && (
        <DocumentAttachmentModal
          isOpen={Boolean(attachmentModalDoc)}
          onClose={() => setAttachmentModalDoc(null)}
          caseId={caseId}
          caseDocument={attachmentModalDoc}
        />
      )}
    </div>
  )
}
