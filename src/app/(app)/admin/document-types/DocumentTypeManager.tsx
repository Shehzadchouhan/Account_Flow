'use client'

import { useState, useActionState } from 'react'
import {
  createDocumentTypeAction,
  updateDocumentTypeAction,
  toggleDocumentTypeActiveAction,
  type DocumentTypeActionState,
} from './actions'
import { StatusBadge } from '@/components/StatusBadge'

interface DocumentType {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

interface DocumentTypeManagerProps {
  documentTypes: DocumentType[]
}

export function DocumentTypeManager({ documentTypes }: DocumentTypeManagerProps) {
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Creation action
  const [createState, createFormAction, isCreating] = useActionState(
    async (prevState: DocumentTypeActionState | null, formData: FormData) => {
      const res = await createDocumentTypeAction(prevState, formData)
      return res
    },
    null
  )

  const handleStartEdit = (doc: DocumentType) => {
    setEditingDocId(doc.id)
    setEditName(doc.name)
    setEditDescription(doc.description || '')
    setActionError(null)
  }

  const handleCancelEdit = () => {
    setEditingDocId(null)
    setEditName('')
    setEditDescription('')
  }

  const handleSaveEdit = async (docId: string, isActive: boolean) => {
    try {
      setPendingActionId(docId)
      setActionError(null)
      const formData = new FormData()
      formData.set('name', editName)
      formData.set('description', editDescription)
      formData.set('is_active', String(isActive))

      const res = await updateDocumentTypeAction(docId, null, formData)
      if (!res.success) {
        setActionError(res.error || 'Failed to update document type.')
      } else {
        setEditingDocId(null)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setActionError(msg)
    } finally {
      setPendingActionId(null)
    }
  }

  const handleToggleActive = async (docId: string, currentStatus: boolean) => {
    try {
      setPendingActionId(docId)
      setActionError(null)
      const res = await toggleDocumentTypeActiveAction(docId, !currentStatus)
      if (!res.success) {
        setActionError(res.error || 'Failed to toggle status.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setActionError(msg)
    } finally {
      setPendingActionId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Action Error Banner */}
      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <strong>Error:</strong> {actionError}
        </div>
      )}

      {/* Creation Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Add New Document Type</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Define a document checklist item available across all firm templates and compliance cases
          </p>
        </div>

        {createState?.error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            <strong>Error:</strong> {createState.error}
          </div>
        )}

        <form action={createFormAction} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label htmlFor="name" className="block text-xs font-medium text-slate-700 mb-1">
              Document Type Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              placeholder="e.g. Sales Register, GSTR-3B Acknowledgement"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
            {createState?.fieldErrors?.name && (
              <p className="mt-1 text-xs text-red-600">{createState.fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="md:col-span-5">
            <label htmlFor="description" className="block text-xs font-medium text-slate-700 mb-1">
              Description / Instructions (Optional)
            </label>
            <input
              type="text"
              id="description"
              name="description"
              placeholder="e.g. Monthly sales invoice summary in Excel or PDF"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
            {createState?.fieldErrors?.description && (
              <p className="mt-1 text-xs text-red-600">{createState.fieldErrors.description[0]}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isCreating}
              className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            >
              {isCreating ? 'Adding...' : 'Create Type'}
            </button>
          </div>
        </form>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Document Catalog</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Master catalog of {documentTypes.length} registered document categories
            </p>
          </div>
          <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md font-medium">
            Permanent Records (No Hard Delete)
          </span>
        </div>

        {documentTypes.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No document types registered yet. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Document Type
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Description
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
                {documentTypes.map((doc) => {
                  const isEditing = editingDocId === doc.id
                  const isPending = pendingActionId === doc.id

                  if (isEditing) {
                    return (
                      <tr key={doc.id} className="bg-blue-50/50">
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={doc.is_active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleSaveEdit(doc.id, doc.is_active)}
                            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg min-h-[32px]"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="text-xs font-medium text-slate-600 bg-white border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 min-h-[32px]"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-900">
                        {doc.name}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 max-w-md">
                        {doc.description || <span className="text-slate-400 italic">—</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={doc.is_active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(doc)}
                          className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg min-h-[36px]"
                        >
                          Rename / Edit
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleToggleActive(doc.id, doc.is_active)}
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border min-h-[36px] ${
                            doc.is_active
                              ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {doc.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
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
