'use client'

import { useState, useActionState } from 'react'
import { updateCaseDetailsAction, type CaseActionState } from '../actions'

interface StaffOption {
  id: string
  full_name: string
}

interface CaseSettingsEditorProps {
  caseId: string
  dueDate: string
  assignedTo: string | null
  version: number
  staffMembers: StaffOption[]
}

export function CaseSettingsEditor({
  caseId,
  dueDate,
  assignedTo,
  version,
  staffMembers,
}: CaseSettingsEditorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const [state, formAction, isPending] = useActionState(
    async (prevState: CaseActionState | null, formData: FormData) => {
      const res = await updateCaseDetailsAction(prevState, formData)
      if (res.success) {
        setIsOpen(false)
      }
      return res
    },
    null
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 sm:px-6 py-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left transition-colors min-h-[44px]"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Case Settings (Due Date &amp; Assignee)
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
          <span>{isOpen ? 'Close' : 'Edit Settings'}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="p-4 sm:p-6 border-t border-slate-200 space-y-4">
          {state?.error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <strong>Error:</strong> {state.error}
            </div>
          )}

          <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <input type="hidden" name="case_id" value={caseId} />
            <input type="hidden" name="version" value={version} />

            <div>
              <label htmlFor="case_due_date" className="block text-xs font-semibold text-slate-700 mb-1">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="case_due_date"
                name="due_date"
                required
                defaultValue={dueDate}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
              />
            </div>

            <div>
              <label htmlFor="case_assigned_to" className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Staff Member
              </label>
              <select
                id="case_assigned_to"
                name="assigned_to"
                defaultValue={assignedTo || ''}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
              >
                <option value="">None (Unassigned)</option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                Optimistic Locking Active (Version #{version}). If another user updates this case concurrently, changes will be rejected.
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[36px] text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg min-h-[36px] text-center"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
