'use client'

import React, { useState, useRef } from 'react'
import {
  uploadDocumentAttachmentAction,
  removeDocumentAttachmentAction,
} from '@/app/(app)/cases/actions'
import type { CaseDocumentItem } from '@/app/(app)/cases/[id]/CaseChecklistTable'

interface DocumentAttachmentModalProps {
  isOpen: boolean
  onClose: () => void
  caseId: string
  caseDocument: CaseDocumentItem
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let num = bytes
  while (num >= 1024 && i < units.length - 1) {
    num /= 1024
    i++
  }
  return `${num.toFixed(1)} ${units[i]}`
}

export function DocumentAttachmentModal({
  isOpen,
  onClose,
  caseId,
  caseDocument,
}: DocumentAttachmentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [markAsReceived, setMarkAsReceived] = useState(!caseDocument.received_at)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isReplacing, setIsReplacing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const hasAttachment = Boolean(caseDocument.file_url) && !isReplacing
  const isPdf =
    caseDocument.file_type === 'application/pdf' ||
    caseDocument.file_name?.toLowerCase().endsWith('.pdf')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null)
    const file = e.target.files?.[0]
    if (!file) return

    // 15MB limit check
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Selected file exceeds the maximum 15MB size limit.')
      return
    }

    const validMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!validMimes.includes(file.type)) {
      setErrorMessage('Only PDF documents and images (PNG, JPG, WebP) are supported.')
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.')
      return
    }

    try {
      setIsUploading(true)
      setErrorMessage(null)

      const formData = new FormData()
      formData.set('case_id', caseId)
      formData.set('case_document_id', caseDocument.case_document_id)
      formData.set('mark_as_received', markAsReceived ? 'true' : 'false')
      formData.set('file', selectedFile)

      const res = await uploadDocumentAttachmentAction(formData)
      if (res.success) {
        setIsReplacing(false)
        setSelectedFile(null)
        onClose()
      } else {
        setErrorMessage(res.error || 'Failed to upload document attachment.')
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this attached scan/PDF?')) {
      return
    }

    try {
      setIsDeleting(true)
      setErrorMessage(null)

      const res = await removeDocumentAttachmentAction(
        caseDocument.case_document_id,
        caseId
      )

      if (res.success) {
        onClose()
      } else {
        setErrorMessage(res.error || 'Failed to remove attachment.')
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-attachment-title"
    >
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-4.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="document-attachment-title" className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {hasAttachment ? 'Attached Digital Document' : 'Attach Document / Notice Scan'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                Checklist Item: <strong className="text-slate-800">{caseDocument.document_type_name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
              {errorMessage}
            </div>
          )}

          {hasAttachment && caseDocument.file_url ? (
            /* Existing Attachment View */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                    {isPdf ? (
                      <span className="font-bold text-xs uppercase">PDF</span>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-sm text-slate-900 block truncate">
                      {caseDocument.file_name || 'Attached Document'}
                    </span>
                    <span className="text-xs text-slate-500">
                      Size: {formatBytes(caseDocument.file_size)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={caseDocument.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                  >
                    <span>Open in New Tab</span>
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </div>

              {/* Preview Box */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-900/5">
                {isPdf ? (
                  <iframe
                    src={caseDocument.file_url}
                    title={caseDocument.file_name || 'PDF Preview'}
                    className="w-full h-80 bg-white"
                  />
                ) : (
                  <div className="p-4 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={caseDocument.file_url}
                      alt={caseDocument.file_name || 'Scanned Document Preview'}
                      className="max-h-80 object-contain rounded-lg shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Upload / Camera Form */
            <form onSubmit={handleUpload} className="space-y-4">
              {/* Drop / Select Area */}
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center transition-colors bg-slate-50/60">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  id="file-upload-input"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  id="camera-upload-input"
                />

                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>

                <div className="text-sm font-semibold text-slate-800">
                  {selectedFile ? (
                    <span className="text-blue-600 font-bold">{selectedFile.name}</span>
                  ) : (
                    <span>Choose a PDF document or scan file</span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mt-1">
                  {selectedFile
                    ? `Size: ${formatBytes(selectedFile.size)} • Type: ${selectedFile.type || 'Document'}`
                    : 'PDF, JPG, PNG or WebP up to 15MB'}
                </p>

                {/* Pick / Snap Buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors shadow-2xs"
                  >
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span>Browse Files</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors shadow-2xs"
                    title="Take a photo of physical document with camera"
                  >
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Scan via Camera</span>
                  </button>
                </div>
              </div>

              {/* Convenience Option: Auto-mark as received */}
              {!caseDocument.received_at && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={markAsReceived}
                    onChange={(e) => setMarkAsReceived(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">
                      Mark this document as Received
                    </span>
                    <span className="text-slate-500">
                      Automatically records inward receipt timestamp along with this attachment.
                    </span>
                  </div>
                </label>
              )}

              {/* Upload Action */}
              <div className="flex justify-end gap-2 pt-2">
                {isReplacing && (
                  <button
                    type="button"
                    onClick={() => setIsReplacing(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel Replacement
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs disabled:bg-slate-300 disabled:cursor-not-allowed min-h-[38px]"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Uploading Scan...</span>
                    </>
                  ) : (
                    <span>Upload & Attach File</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer (for Existing Attachment) */}
        {hasAttachment && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
            >
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{isDeleting ? 'Deleting...' : 'Remove Attachment'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsReplacing(true)}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
              >
                Replace Scan / PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
