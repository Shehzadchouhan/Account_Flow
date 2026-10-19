'use client'

import { useState, useActionState } from 'react'
import { updateFirmAction, toggleFirmActiveAction, type ActionState } from '../actions'
import { StatusBadge } from '@/components/StatusBadge'

interface StaffOption {
  id: string
  full_name: string
}

interface FirmData {
  id: string
  name: string
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  default_employee: string | null
  is_active: boolean
  profiles?:
    | {
        id: string
        full_name: string
      }
    | {
        id: string
        full_name: string
      }[]
    | null
}

interface FirmDetailsEditorProps {
  firm: FirmData
  staffMembers: StaffOption[]
  isAdmin: boolean
}

export function FirmDetailsEditor({ firm, staffMembers, isAdmin }: FirmDetailsEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [archivePending, setArchivePending] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const boundUpdateAction = async (prevState: ActionState | null, formData: FormData) => {
    const res = await updateFirmAction(firm.id, prevState, formData)
    if (res.success) {
      setIsEditing(false)
    }
    return res
  }

  const [state, formAction, isPending] = useActionState(boundUpdateAction, null)

  const handleToggleArchive = async () => {
    try {
      setArchivePending(true)
      setArchiveError(null)
      const res = await toggleFirmActiveAction(firm.id, !firm.is_active)
      if (!res.success) {
        setArchiveError(res.error || 'Failed to update firm status.')
      } else {
        setShowArchiveConfirm(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setArchiveError(msg)
    } finally {
      setArchivePending(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
      {/* Header with Title, Status, and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">Firm Profile &amp; Contact Information</h2>
            <StatusBadge status={firm.is_active ? 'ACTIVE' : 'ARCHIVED'} size="sm" />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Primary office records, billing emails, and assigned staff member
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[38px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                Edit Firm Details
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 min-h-[38px]"
              >
                Cancel Editing
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowArchiveConfirm(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border min-h-[38px] ${
                firm.is_active
                  ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {firm.is_active ? 'Archive Firm' : 'Restore Firm'}
            </button>
          </div>
        )}
      </div>

      {/* Archive / Restore Confirmation Modal Dialog */}
      {showArchiveConfirm && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Confirm {firm.is_active ? 'Archive' : 'Restore'} Action</span>
          </div>
          <p className="text-xs text-amber-800">
            {firm.is_active
              ? `Archiving "${firm.name}" will hide it from standard active filters. Existing historical cases and records remain preserved and uncorrupted.`
              : `Restoring "${firm.name}" will return it to active status across all monthly workflow queues.`}
          </p>
          {archiveError && (
            <p className="text-xs text-red-600 font-semibold">{archiveError}</p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              disabled={archivePending}
              onClick={handleToggleArchive}
              className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg min-h-[36px] ${
                firm.is_active
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              } disabled:opacity-50`}
            >
              {archivePending ? 'Updating...' : firm.is_active ? 'Yes, Archive Firm' : 'Yes, Restore Firm'}
            </button>
            <button
              type="button"
              onClick={() => setShowArchiveConfirm(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[36px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Editing Form or Read-only Display */}
      {isEditing && isAdmin ? (
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <strong>Error:</strong> {state.error}
            </div>
          )}

          <input type="hidden" name="is_active" value={String(firm.is_active)} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="name" className="block text-xs font-medium text-slate-700 mb-1">
                Firm Legal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={firm.name}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              {state?.fieldErrors?.name && (
                <p className="text-xs text-red-600 mt-1">{state.fieldErrors.name[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="contact_person" className="block text-xs font-medium text-slate-700 mb-1">
                Primary Contact Person
              </label>
              <input
                type="text"
                id="contact_person"
                name="contact_person"
                defaultValue={firm.contact_person || ''}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="contact_phone" className="block text-xs font-medium text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                id="contact_phone"
                name="contact_phone"
                defaultValue={firm.contact_phone || ''}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="contact_email" className="block text-xs font-medium text-slate-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                id="contact_email"
                name="contact_email"
                defaultValue={firm.contact_email || ''}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="default_employee" className="block text-xs font-medium text-slate-700 mb-1">
                Default Assigned Staff
              </label>
              <select
                id="default_employee"
                name="default_employee"
                defaultValue={firm.default_employee || ''}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None (Unassigned)</option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[36px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg min-h-[36px]"
            >
              {isPending ? 'Saving...' : 'Save Firm Details'}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <span className="block text-xs font-medium text-slate-500">Legal Firm Name</span>
            <span className="font-semibold text-slate-900 mt-1 block">{firm.name}</span>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500">Primary Contact Person</span>
            <span className="text-slate-800 mt-1 block">
              {firm.contact_person || <span className="text-slate-400 italic">None specified</span>}
            </span>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500">Contact Information</span>
            <div className="mt-1 text-slate-800 space-y-0.5">
              {firm.contact_phone && <div>{firm.contact_phone}</div>}
              {firm.contact_email && <div>{firm.contact_email}</div>}
              {!firm.contact_phone && !firm.contact_email && (
                <span className="text-slate-400 italic">None specified</span>
              )}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500">Default Assigned Staff</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 mt-1">
              {(Array.isArray(firm.profiles) ? firm.profiles[0]?.full_name : firm.profiles?.full_name) || 'Unassigned'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
