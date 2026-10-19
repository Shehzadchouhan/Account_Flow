'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createFirmAction } from '../actions'

interface StaffOption {
  id: string
  full_name: string
}

export function FirmCreateForm({ staffMembers }: { staffMembers: StaffOption[] }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createFirmAction, null)

  useEffect(() => {
    if (state?.success && state.data?.firmId) {
      router.push(`/firms/${state.data.firmId}`)
    }
  }, [state, router])

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Error</span>
          </div>
          <p className="mt-1 ml-7">{state.error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Firm Name */}
        <div className="md:col-span-2">
          <label htmlFor="name" className="block text-sm font-semibold text-slate-900">
            Client Firm Name <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mt-0.5">
            Full legal or trade business name (must be unique across the office)
          </p>
          <input
            type="text"
            id="name"
            name="name"
            required
            placeholder="e.g. Acme Industries Pvt Ltd"
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
          />
          {state?.fieldErrors?.name && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>
          )}
        </div>

        {/* Contact Person */}
        <div>
          <label htmlFor="contact_person" className="block text-sm font-semibold text-slate-900">
            Primary Contact Person
          </label>
          <p className="text-xs text-slate-500 mt-0.5">Director, partner, or principal liaison</p>
          <input
            type="text"
            id="contact_person"
            name="contact_person"
            placeholder="e.g. Ramesh Kumar"
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
          />
          {state?.fieldErrors?.contact_person && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.contact_person[0]}</p>
          )}
        </div>

        {/* Contact Phone */}
        <div>
          <label htmlFor="contact_phone" className="block text-sm font-semibold text-slate-900">
            Contact Phone Number
          </label>
          <p className="text-xs text-slate-500 mt-0.5">Mobile or office telephone number</p>
          <input
            type="text"
            id="contact_phone"
            name="contact_phone"
            placeholder="e.g. +91 98765 43210"
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
          />
          {state?.fieldErrors?.contact_phone && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.contact_phone[0]}</p>
          )}
        </div>

        {/* Contact Email */}
        <div>
          <label htmlFor="contact_email" className="block text-sm font-semibold text-slate-900">
            Contact Email Address
          </label>
          <p className="text-xs text-slate-500 mt-0.5">Official billing or correspondence email</p>
          <input
            type="email"
            id="contact_email"
            name="contact_email"
            placeholder="e.g. accounts@acmeindustries.com"
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
          />
          {state?.fieldErrors?.contact_email && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.contact_email[0]}</p>
          )}
        </div>

        {/* Default Assigned Staff Member */}
        <div>
          <label htmlFor="default_employee" className="block text-sm font-semibold text-slate-900">
            Default Assigned Staff
          </label>
          <p className="text-xs text-slate-500 mt-0.5">
            Default staff member responsible for this firm&apos;s monthly cases
          </p>
          <select
            id="default_employee"
            name="default_employee"
            defaultValue=""
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] bg-white"
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

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <Link
          href="/firms"
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-500 min-h-[44px] flex items-center"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px]"
        >
          {isPending ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Creating Firm...
            </>
          ) : (
            'Create Firm & Configure Template'
          )}
        </button>
      </div>
    </form>
  )
}
