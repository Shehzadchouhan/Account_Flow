'use client'

import { useState } from 'react'
import {
  addTemplateItemAction,
  updateTemplateItemAction,
  removeTemplateItemAction,
} from '../actions'
import { StatusBadge } from '@/components/StatusBadge'

export interface DocumentType {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

export interface TemplateItem {
  id: string
  firm_id: string
  document_type_id: string
  is_required: boolean
  document_types: DocumentType | null
}

interface FirmTemplateEditorProps {
  firmId: string
  firmName: string
  templateItems: TemplateItem[]
  availableDocumentTypes: DocumentType[]
  isAdmin: boolean
}

export function FirmTemplateEditor({
  firmId,
  templateItems,
  availableDocumentTypes,
  isAdmin,
}: FirmTemplateEditorProps) {
  const [selectedDocId, setSelectedDocId] = useState('')
  const [isRequired, setIsRequired] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)

  // Filter out document types already attached to this firm template
  const configuredDocIds = new Set(templateItems.map((item) => item.document_type_id))
  const unconfiguredDocTypes = availableDocumentTypes.filter(
    (dt) => !configuredDocIds.has(dt.id)
  )

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDocId) return

    try {
      setIsAdding(true)
      setActionError(null)
      const res = await addTemplateItemAction(firmId, selectedDocId, isRequired)
      if (!res.success) {
        setActionError(res.error || 'Failed to add document type to template.')
      } else {
        setSelectedDocId('')
        setIsRequired(true)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setActionError(msg)
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggleRequired = async (item: TemplateItem) => {
    try {
      setPendingItemId(item.id)
      setActionError(null)
      const res = await updateTemplateItemAction(item.id, firmId, !item.is_required)
      if (!res.success) {
        setActionError(res.error || 'Failed to update requirement.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setActionError(msg)
    } finally {
      setPendingItemId(null)
    }
  }

  const handleRemove = async (itemId: string) => {
    try {
      setPendingItemId(itemId)
      setActionError(null)
      const res = await removeTemplateItemAction(itemId, firmId)
      if (!res.success) {
        setActionError(res.error || 'Failed to remove document type.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setActionError(msg)
    } finally {
      setPendingItemId(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Document Checklist Template</h2>
        <p className="mt-1 text-xs text-slate-500">
          Specifies the default list of required and optional documents generated for each monthly compliance case
        </p>
      </div>

      {/* Prominent Future-Only Notice */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-600 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-xs space-y-1">
            <span className="font-bold uppercase tracking-wider text-blue-800">
              Template Modification Notice
            </span>
            <p className="text-blue-800 leading-relaxed">
              Modifications made to this checklist template configure the default documents for{' '}
              <strong>FUTURE generated cases</strong> only. Existing open and archived monthly cases
              remain completely intact and unaltered.
            </p>
          </div>
        </div>
      </div>

      {/* Action Error Alert */}
      {actionError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          <strong>Error:</strong> {actionError}
        </div>
      )}

      {/* Add Document Type Form (Admin Only) */}
      {isAdmin && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Add Document Type to Template
          </h3>

          {unconfiguredDocTypes.length === 0 ? (
            <p className="text-xs text-slate-500">
              All active document types in the master catalog are already added to this firm&apos;s template.
            </p>
          ) : (
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <label htmlFor="doc_type" className="sr-only">
                  Select Document Type
                </label>
                <select
                  id="doc_type"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                >
                  <option value="">-- Choose document type --</option>
                  {unconfiguredDocTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.name} {dt.description ? `(${dt.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_required_chk"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_required_chk" className="text-xs font-medium text-slate-700 select-none">
                  Required Document
                </label>
              </div>

              <button
                type="submit"
                disabled={isAdding || !selectedDocId}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg min-h-[40px] shrink-0"
              >
                {isAdding ? 'Adding...' : 'Add to Template'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Configured Template Items Table */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Configured Checklist Items ({templateItems.length})
        </h3>

        {templateItems.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <p className="text-sm font-medium text-slate-700">No template items configured</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {isAdmin
                ? 'Use the dropdown above to add document types (e.g. Sales Register, Bank Statement) to this firm template.'
                : 'No documents configured in this checklist template yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Document Type
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Description
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Requirement Rule
                  </th>
                  {isAdmin && (
                    <th scope="col" className="px-5 py-3 text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {templateItems.map((item) => {
                  const docName = item.document_types?.name || 'Unknown Document Type'
                  const docDesc = item.document_types?.description || '—'
                  const isPending = pendingItemId === item.id

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-900">
                        {docName}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 max-w-xs truncate">
                        {docDesc}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <StatusBadge status={item.is_required ? 'REQUIRED' : 'OPTIONAL'} size="sm" />
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5 whitespace-nowrap text-right space-x-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleToggleRequired(item)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 px-2 py-1 rounded-md hover:bg-blue-50"
                          >
                            Mark {item.is_required ? 'Optional' : 'Required'}
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRemove(item.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 px-2 py-1 rounded-md hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
