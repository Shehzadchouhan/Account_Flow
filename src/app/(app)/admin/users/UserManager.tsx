'use client'

import { useState, useEffect } from 'react'
import { updateUserProfileAction } from './actions'
import { StatusBadge } from '@/components/StatusBadge'
import type { UserRole } from '@/types/database.types'

interface ProfileItem {
  id: string
  full_name: string
  email: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

interface UserManagerProps {
  profiles: ProfileItem[]
  currentUserId: string
}

export function UserManager({ profiles, currentUserId }: UserManagerProps) {
  const [selectedUser, setSelectedUser] = useState<ProfileItem | null>(null)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('staff')
  const [isActive, setIsActive] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const handleOpenEdit = (user: ProfileItem) => {
    setSelectedUser(user)
    setFullName(user.full_name)
    setRole(user.role)
    setIsActive(user.is_active)
    setModalError(null)
  }

  const handleCloseModal = () => {
    setSelectedUser(null)
    setModalError(null)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedUser) {
        handleCloseModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedUser])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      setIsSubmitting(true)
      setModalError(null)

      const formData = new FormData()
      formData.set('full_name', fullName)
      formData.set('role', role)
      formData.set('is_active', String(isActive))

      const res = await updateUserProfileAction(selectedUser.id, null, formData)
      if (!res.success) {
        setModalError(res.error || 'Failed to update user profile.')
      } else {
        handleCloseModal()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setModalError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Informational Guidance Banner */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
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
            <span className="font-bold text-slate-900 uppercase tracking-wider">
              Staff Provisioning Workflow
            </span>
            <p className="text-slate-600 leading-relaxed">
              New team members sign up or are sent email invites through the{' '}
              <strong>Supabase Authentication Dashboard</strong>. By default, newly registered
              accounts are created as <em>Inactive Staff</em>. Use this screen to activate their account
              and assign appropriate office roles (<strong>Admin</strong> or <strong>Staff</strong>).
            </p>
          </div>
        </div>
      </div>

      {/* Team Profiles Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Registered Office Team</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {profiles.length} total team {profiles.length === 1 ? 'member' : 'members'} registered
            </p>
          </div>
          <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md font-semibold">
            Last-Admin Guard Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-3.5">
                  Full Name
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Email Address
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Role
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Account Status
                </th>
                <th scope="col" className="px-6 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {profiles.map((profile) => {
                const isCurrentUser = profile.id === currentUserId
                return (
                  <tr key={profile.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{profile.full_name}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-xs">
                      {profile.email || <span className="text-slate-400 italic">No email</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge
                        status={profile.role === 'admin' ? 'ADMIN' : 'STAFF'}
                        size="sm"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge
                        status={profile.is_active ? 'ACTIVE' : 'INACTIVE'}
                        size="sm"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(profile)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                      >
                        Edit Role / Status
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal Dialog */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 id="edit-user-title" className="text-lg font-bold text-slate-900">
                  Edit Team Member
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update role permissions and account activation status
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                <strong>Error:</strong> {modalError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500">Email Address</label>
                <div className="mt-1 px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  {selectedUser.email || 'No email registered'}
                </div>
              </div>

              <div>
                <label htmlFor="full_name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-xs font-semibold text-slate-700 mb-1">
                  Access Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                >
                  <option value="staff">Staff (Standard operational workflows)</option>
                  <option value="admin">Administrator (Full office control &amp; master data)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Admins can manage firms, templates, document types, and staff roles.
                </p>
              </div>

              <div>
                <label htmlFor="is_active" className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="is_active"
                  value={String(isActive)}
                  onChange={(e) => setIsActive(e.target.value === 'true')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                >
                  <option value="true">Active (Access allowed)</option>
                  <option value="false">Inactive (Sign-in blocked)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Inactive users cannot sign in or access client accounts.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg min-h-[38px]"
                >
                  {isSubmitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
