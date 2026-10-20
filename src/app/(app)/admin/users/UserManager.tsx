'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  updateUserProfileAction,
  createTeamMemberAction,
  toggleUserStatusAction,
} from './actions'
import { StatusBadge } from '@/components/StatusBadge'
import type { UserRole } from '@/types/database.types'

export interface ProfileItem {
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
  hasServiceRoleKey?: boolean
}

export function UserManager({ profiles, currentUserId, hasServiceRoleKey = false }: UserManagerProps) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Feedback banner state
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null)

  // Add User Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('staff')
  const [newPassword, setNewPassword] = useState('Staff@2026!')
  const [newIsActive, setNewIsActive] = useState(true)
  const [newNotes, setNewNotes] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [addModalError, setAddModalError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Credentials Success Modal state
  const [createdCredentials, setCreatedCredentials] = useState<{
    full_name: string
    email: string
    role: UserRole
    password?: string
  } | null>(null)
  const [hasCopied, setHasCopied] = useState(false)

  // Edit User Modal state
  const [selectedUser, setSelectedUser] = useState<ProfileItem | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('staff')
  const [editIsActive, setEditIsActive] = useState(true)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [editModalError, setEditModalError] = useState<string | null>(null)

  // Keyboard escape listeners
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (createdCredentials) {
          setCreatedCredentials(null)
        } else if (isAddModalOpen) {
          setIsAddModalOpen(false)
        } else if (selectedUser) {
          setSelectedUser(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [createdCredentials, isAddModalOpen, selectedUser])

  // Filtered profiles list
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchSearch =
        p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchRole = roleFilter === 'all' || p.role === roleFilter
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && p.is_active) ||
        (statusFilter === 'inactive' && !p.is_active)

      return matchSearch && matchRole && matchStatus
    })
  }, [profiles, searchQuery, roleFilter, statusFilter])

  // Counts
  const totalCount = profiles.length
  const activeCount = profiles.filter((p) => p.is_active).length
  const staffCount = profiles.filter((p) => p.role === 'staff').length
  const adminCount = profiles.filter((p) => p.role === 'admin').length

  // Quick Password Generator
  const generateRandomPassword = (nameHint = '') => {
    const cleanName = nameHint.trim().split(' ')[0].replace(/[^a-zA-Z]/g, '') || 'Staff'
    const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase()
    const randomDigits = Math.floor(1000 + Math.random() * 9000)
    return `${capitalized}@${randomDigits}!`
  }

  // Pre-fill helper for test examples
  const handlePreFillExample = (exampleIndex: 1 | 2 | 3) => {
    if (exampleIndex === 1) {
      setNewName('Rahul Sharma')
      setNewEmail('rahul.sharma@financeflow.local')
      setNewRole('staff')
      setNewPassword('Rahul@2026!')
      setNewIsActive(true)
      setNewNotes('Junior Accountant handling retail firms')
    } else if (exampleIndex === 2) {
      setNewName('Priya Patel')
      setNewEmail('priya.patel@financeflow.local')
      setNewRole('staff')
      setNewPassword('Priya@2026!')
      setNewIsActive(true)
      setNewNotes('Senior Accountant handling manufacturing firms')
    } else if (exampleIndex === 3) {
      setNewName('CA Amit Mehta')
      setNewEmail('amit.mehta@financeflow.local')
      setNewRole('admin')
      setNewPassword('Amit@2026!')
      setNewIsActive(true)
      setNewNotes('Managing Partner with full privileges')
    }
  }

  // Handle Add Team Member submit
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddModalError(null)

    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setAddModalError('Please fill in all required fields.')
      return
    }

    try {
      setIsCreating(true)
      const formData = new FormData()
      formData.set('full_name', newName.trim())
      formData.set('email', newEmail.trim())
      formData.set('role', newRole)
      formData.set('password', newPassword)
      formData.set('is_active', String(newIsActive))

      const res = await createTeamMemberAction(null, formData)

      if (!res.success) {
        setAddModalError(res.error || 'Failed to create team member.')
      } else {
        // Success: open credentials modal
        setIsAddModalOpen(false)
        setCreatedCredentials({
          full_name: newName.trim(),
          email: newEmail.trim(),
          role: newRole,
          password: newPassword,
        })
        setActionFeedback({
          type: 'success',
          message: `Team member ${newName.trim()} onboarded successfully!`,
        })

        // Reset fields
        setNewName('')
        setNewEmail('')
        setNewRole('staff')
        setNewPassword('Staff@2026!')
        setNewNotes('')
      }
    } catch (err: unknown) {
      setAddModalError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsCreating(false)
    }
  }

  // 1-Click Status Toggle
  const handleQuickToggle = async (userId: string, targetActive: boolean) => {
    try {
      setTogglingUserId(userId)
      setActionFeedback(null)
      const res = await toggleUserStatusAction(userId, targetActive)
      if (!res.success) {
        setActionFeedback({ type: 'error', message: res.error || 'Failed to update account status.' })
      } else {
        setActionFeedback({
          type: 'success',
          message: targetActive ? 'Staff account activated successfully.' : 'Staff account deactivated.',
        })
      }
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unexpected status update error.',
      })
    } finally {
      setTogglingUserId(null)
    }
  }

  // Open Edit User
  const handleOpenEdit = (user: ProfileItem) => {
    setSelectedUser(user)
    setEditFullName(user.full_name)
    setEditRole(user.role)
    setEditIsActive(user.is_active)
    setEditModalError(null)
  }

  // Save Edit User
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      setIsSubmittingEdit(true)
      setEditModalError(null)

      const formData = new FormData()
      formData.set('full_name', editFullName.trim())
      formData.set('role', editRole)
      formData.set('is_active', String(editIsActive))

      const res = await updateUserProfileAction(selectedUser.id, null, formData)
      if (!res.success) {
        setEditModalError(res.error || 'Failed to update user profile.')
      } else {
        setSelectedUser(null)
        setActionFeedback({
          type: 'success',
          message: `Profile for ${editFullName} updated successfully.`,
        })
      }
    } catch (err: unknown) {
      setEditModalError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Copy Credentials to Clipboard
  const handleCopyCredentials = () => {
    if (!createdCredentials) return
    const text = [
      '--------------------------------------------------',
      'FinanceFlow - Accounts Office Portal Login',
      '--------------------------------------------------',
      `Login URL: http://localhost:3000/login`,
      `Full Name: ${createdCredentials.full_name}`,
      `Work Email: ${createdCredentials.email}`,
      `Temporary Password: ${createdCredentials.password || '••••••••'}`,
      `Assigned Role: ${createdCredentials.role === 'admin' ? 'Administrator' : 'Staff'}`,
      '--------------------------------------------------',
      'Please sign in and change your password upon first login.',
    ].join('\n')

    navigator.clipboard.writeText(text).then(() => {
      setHasCopied(true)
      setTimeout(() => setHasCopied(false), 2500)
    })
  }

  return (
    <div className="space-y-6">
      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          role="alert"
          aria-live="polite"
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in duration-200 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionFeedback.type === 'success' ? (
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-semibold px-2 py-1 rounded-md"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step 2 Walkthrough & Guidance Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 border border-blue-200/80 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider bg-blue-100/70 px-2 py-0.5 rounded-md">
                  Step 2: Onboard the Staff Team
                </span>
                <span className="text-xs text-slate-500 font-medium">Time needed: ~3 mins</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Accounts Office Staff &amp; Administrator Management
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                Add the team members who will handle daily document collection and filing. Click <strong>Add Team Member</strong> to create their account and generate login credentials, or click <strong>Activate</strong> to approve registered staff accounts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setAddModalError(null)
                setIsAddModalOpen(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-sm transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[42px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Team Member</span>
            </button>
          </div>
        </div>

        {/* Step 2 Test Examples Quick Guide */}
        <div className="mt-4 pt-3.5 border-t border-blue-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-white/80 border border-blue-100">
            <span className="font-bold text-slate-900">Example 1: Rahul Sharma</span>
            <div className="text-slate-600 text-[11px] mt-0.5">Role: <span className="font-semibold text-blue-700">Staff</span> (Junior Accountant – retail firms)</div>
          </div>
          <div className="p-2.5 rounded-lg bg-white/80 border border-blue-100">
            <span className="font-bold text-slate-900">Example 2: Priya Patel</span>
            <div className="text-slate-600 text-[11px] mt-0.5">Role: <span className="font-semibold text-blue-700">Staff</span> (Senior Accountant – manufacturing)</div>
          </div>
          <div className="p-2.5 rounded-lg bg-white/80 border border-blue-100">
            <span className="font-bold text-slate-900">Example 3: CA Amit Mehta</span>
            <div className="text-slate-600 text-[11px] mt-0.5">Role: <span className="font-semibold text-purple-700">Admin</span> (Managing Partner – full privileges)</div>
          </div>
        </div>
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Total Team</span>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{totalCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Active Accounts</span>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">{activeCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Staff Accountants</span>
          <p className="text-xl font-bold text-blue-600 mt-0.5">{staffCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Administrators</span>
          <p className="text-xl font-bold text-purple-600 mt-0.5">{adminCount}</p>
        </div>
      </div>

      {/* Main Team Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Toolbar: Search & Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team by name or email..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'staff')}
              className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by role"
            >
              <option value="all">All Roles</option>
              <option value="staff">Staff Only</option>
              <option value="admin">Admins Only</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by account status"
            >
              <option value="all">All Status</option>
              <option value="active">Active Accounts</option>
              <option value="inactive">Inactive / Pending</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setAddModalError(null)
                setIsAddModalOpen(true)
              }}
              className="sm:hidden inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
        </div>

        {/* Table Content */}
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
                  Quick Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <svg
                        className="w-8 h-8 text-slate-400 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <p className="font-semibold text-slate-700">No team members match the filter</p>
                      <p className="text-xs text-slate-500">
                        Try clearing search terms or click &quot;Add Team Member&quot; to onboard staff.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('')
                          setRoleFilter('all')
                          setStatusFilter('all')
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline mt-2"
                      >
                        Reset filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => {
                  const isCurrentUser = profile.id === currentUserId
                  const isToggling = togglingUserId === profile.id

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
                        {profile.email ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-700">{profile.email}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(profile.email || '')
                                setActionFeedback({ type: 'success', message: `Copied ${profile.email}` })
                              }}
                              title="Copy email"
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded-sm"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No email registered</span>
                        )}
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
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        {/* 1-Click Quick Activate / Deactivate */}
                        {!profile.is_active ? (
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleQuickToggle(profile.id, true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[34px] disabled:opacity-50"
                          >
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{isToggling ? 'Activating...' : 'Activate'}</span>
                          </button>
                        ) : (
                          !isCurrentUser && (
                            <button
                              type="button"
                              disabled={isToggling}
                              onClick={() => handleQuickToggle(profile.id, false)}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 min-h-[34px] disabled:opacity-50"
                              title="Deactivate account"
                            >
                              <span>{isToggling ? 'Updating...' : 'Deactivate'}</span>
                            </button>
                          )
                        )}

                        {/* Edit Role / Status Modal trigger */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(profile)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[34px]"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Showing {filteredProfiles.length} of {profiles.length} team members
          </span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Last-Admin Guard Active
          </span>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* ADD TEAM MEMBER MODAL                                                  */}
      {/* ======================================================================= */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 id="add-user-title" className="text-lg font-bold text-slate-900">
                  Add New Team Member
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Onboard an employee, assign their role, and generate login credentials
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick Test Example Pre-fill Pills */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Quick Pre-fill from Step 2 Guide:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePreFillExample(1)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-slate-300 hover:border-blue-500 text-slate-700 hover:text-blue-700 shadow-2xs transition-colors"
                >
                  Example 1: Rahul Sharma (Staff)
                </button>
                <button
                  type="button"
                  onClick={() => handlePreFillExample(2)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-slate-300 hover:border-blue-500 text-slate-700 hover:text-blue-700 shadow-2xs transition-colors"
                >
                  Example 2: Priya Patel (Staff)
                </button>
                <button
                  type="button"
                  onClick={() => handlePreFillExample(3)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-slate-300 hover:border-blue-500 text-slate-700 hover:text-purple-700 shadow-2xs transition-colors"
                >
                  Example 3: CA Amit Mehta (Admin)
                </button>
              </div>
            </div>

            {addModalError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs leading-relaxed">
                <strong className="font-semibold block mb-0.5">Unable to create user:</strong>
                {addModalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label htmlFor="new_full_name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="new_full_name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                />
              </div>

              <div>
                <label htmlFor="new_email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="new_email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. rahul.sharma@firm.com"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new_role" className="block text-xs font-semibold text-slate-700 mb-1">
                    Access Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="new_role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                  >
                    <option value="staff">Staff (Accountant)</option>
                    <option value="admin">Administrator (Partner)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="new_is_active" className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="new_is_active"
                    value={String(newIsActive)}
                    onChange={(e) => setNewIsActive(e.target.value === 'true')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                  >
                    <option value="true">Active (Can sign in)</option>
                    <option value="false">Inactive (Blocked)</option>
                  </select>
                </div>
              </div>

              {/* Temporary Password with Generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="new_password" className="text-xs font-semibold text-slate-700">
                    Temporary Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateRandomPassword(newName))}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline"
                  >
                    🎲 Regenerate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="new_password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 pr-10 text-sm font-mono rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Staff member will use this password to sign in at <code className="text-slate-700 font-mono">/login</code>.
                </p>
              </div>

              {/* Optional Designation Note */}
              <div>
                <label htmlFor="new_notes" className="block text-xs font-semibold text-slate-700 mb-1">
                  Operational Responsibilities (Optional)
                </label>
                <input
                  type="text"
                  id="new_notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Junior Accountant handling retail firms"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                />
              </div>

              {!hasServiceRoleKey && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <svg className="w-4 h-4 text-amber-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>To avoid Supabase email rate limits, choose either:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-900">
                    <li>
                      <strong>Option 1 (Recommended):</strong> Add <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">SUPABASE_SERVICE_ROLE_KEY</code> to <code className="font-mono">.env.local</code>. In Supabase Dashboard &rarr; <strong>Project Settings &rarr; API</strong> &rarr; under Project API Keys, find <strong>service_role</strong> (click <strong>Reveal</strong>).
                    </li>
                    <li>
                      <strong>Option 2 (30-second fix):</strong> In Supabase Dashboard &rarr; <strong>Authentication &rarr; Providers &rarr; Email</strong>, toggle OFF <strong>Confirm email</strong> and click Save.
                    </li>
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg min-h-[38px] shadow-xs"
                >
                  {isCreating ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Team Member</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* CREDENTIALS SUCCESS MODAL (Handover Card)                               */}
      {/* ======================================================================= */}
      {createdCredentials && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credentials-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 id="credentials-title" className="text-lg font-bold text-slate-900">
                  Team Member Onboarded!
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Share these login credentials with {createdCredentials.full_name}:
                </p>
              </div>
            </div>

            {/* Credentials Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-sans font-medium">Portal URL</span>
                <span className="font-semibold text-blue-700">http://localhost:3000/login</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-sans font-medium">Full Name</span>
                <span className="font-semibold text-slate-900 font-sans">{createdCredentials.full_name}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-sans font-medium">Work Email</span>
                <span className="font-semibold text-slate-900">{createdCredentials.email}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-sans font-medium">Temporary Password</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {createdCredentials.password || '••••••••'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-sans font-medium">Access Role</span>
                <span className="font-bold uppercase tracking-wider text-slate-800 font-sans">
                  {createdCredentials.role}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors min-h-[42px]"
              >
                {hasCopied ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>✓ Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>Copy Login Credentials</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="w-full px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 min-h-[38px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* EDIT USER MODAL                                                        */}
      {/* ======================================================================= */}
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
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {editModalError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                <strong>Error:</strong> {editModalError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500">Email Address</label>
                <div className="mt-1 px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  {selectedUser.email || 'No email registered'}
                </div>
              </div>

              <div>
                <label htmlFor="edit_full_name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="edit_full_name"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                />
              </div>

              <div>
                <label htmlFor="edit_role" className="block text-xs font-semibold text-slate-700 mb-1">
                  Access Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit_role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                >
                  <option value="staff">Staff (Standard operational workflows)</option>
                  <option value="admin">Administrator (Full office control &amp; master data)</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit_is_active" className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit_is_active"
                  value={String(editIsActive)}
                  onChange={(e) => setEditIsActive(e.target.value === 'true')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                >
                  <option value="true">Active (Access allowed)</option>
                  <option value="false">Inactive (Sign-in blocked)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg min-h-[38px]"
                >
                  {isSubmittingEdit ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
