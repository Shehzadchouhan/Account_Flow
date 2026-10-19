import React from 'react'
import type { CaseStatusType, CaseDocumentStatusType } from '@/types/database.types'

export type BadgeStatus =
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'INACTIVE'
  | 'REQUIRED'
  | 'OPTIONAL'
  | 'ADMIN'
  | 'STAFF'
  | 'OVERDUE'
  | 'VOIDED'
  | CaseStatusType
  | CaseDocumentStatusType

export interface StatusBadgeProps {
  status: BadgeStatus
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'

  switch (status) {
    case 'ACTIVE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" aria-hidden="true" />
          <span>ACTIVE</span>
        </span>
      )
    case 'ARCHIVED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500 shrink-0" aria-hidden="true" />
          <span>ARCHIVED</span>
        </span>
      )
    case 'INACTIVE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-300 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600 shrink-0" aria-hidden="true" />
          <span>INACTIVE</span>
        </span>
      )
    case 'REQUIRED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
          <span>REQUIRED</span>
        </span>
      )
    case 'OPTIONAL':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
          <span>OPTIONAL</span>
        </span>
      )
    case 'ADMIN':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-purple-600 shrink-0" aria-hidden="true" />
          <span>ADMIN</span>
        </span>
      )
    case 'STAFF':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" aria-hidden="true" />
          <span>STAFF</span>
        </span>
      )
    case 'OVERDUE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-bold rounded-full bg-red-50 text-red-700 border border-red-300 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-600 shrink-0" aria-hidden="true" />
          <span>OVERDUE</span>
        </span>
      )
    case 'VOIDED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-300 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 shrink-0" aria-hidden="true" />
          <span>VOIDED</span>
        </span>
      )

    // Case Status Types
    case 'Awaiting Documents':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-300 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
          <span>AWAITING DOCUMENTS</span>
        </span>
      )
    case 'Pending Dispatch':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-300 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
          <span>PENDING DISPATCH</span>
        </span>
      )
    case 'Completed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" aria-hidden="true" />
          <span>COMPLETED</span>
        </span>
      )
    case 'No Required Documents':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-300 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
          <span>NO REQUIRED DOCUMENTS</span>
        </span>
      )

    // Case Document Status Types
    case 'Awaiting Receipt':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
          <span>AWAITING RECEIPT</span>
        </span>
      )
    case 'Received - Not Dispatched':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" aria-hidden="true" />
          <span>RECEIVED</span>
        </span>
      )
    case 'Dispatched':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200 ${sizeClasses} ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-purple-600 shrink-0" aria-hidden="true" />
          <span>DISPATCHED</span>
        </span>
      )

    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses} ${className}`}
        >
          <span>{String(status).toUpperCase()}</span>
        </span>
      )
  }
}
