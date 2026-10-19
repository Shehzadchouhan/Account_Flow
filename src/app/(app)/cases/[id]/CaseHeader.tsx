import React from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/StatusBadge'
import type { CaseStatusType, CaseCycle } from '@/types/database.types'

export interface CaseHeaderData {
  case_id: string
  firm_id: string
  firm_name: string
  period_month: string
  cycle: CaseCycle
  due_date: string
  assigned_to: string | null
  version: number
  required_count: number
  received_count: number
  dispatched_count: number
  missing_count: number
  undispatched_count: number
  status: CaseStatusType
  is_overdue: boolean
  profiles?: {
    full_name: string
  } | null
}

interface CaseHeaderProps {
  caseData: CaseHeaderData
}

export function CaseHeader({ caseData }: CaseHeaderProps) {
  const monthFormatted = new Date(`${caseData.period_month}T00:00:00Z`).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const cycleLabel = caseData.cycle === 'A_11th' ? 'Cycle A (11th)' : 'Cycle B (20th)'
  const assigneeName = caseData.profiles?.full_name || 'Unassigned'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <nav className="flex items-center text-xs font-medium text-slate-500 mb-2">
            <Link href="/cases" className="hover:text-slate-700">
              Cases
            </Link>
            <span className="mx-1.5 text-slate-400">/</span>
            <Link href={`/firms/${caseData.firm_id}`} className="hover:text-blue-600 font-semibold">
              {caseData.firm_name}
            </Link>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {caseData.firm_name}
            </h1>
            <StatusBadge status={caseData.status} size="md" />
            {caseData.is_overdue && <StatusBadge status="OVERDUE" size="md" />}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {monthFormatted} • {cycleLabel} • Assigned to: <strong>{assigneeName}</strong>
          </p>
        </div>

        <div className="text-right sm:border-l sm:border-slate-200 sm:pl-6 shrink-0">
          <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Target Due Date
          </span>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{caseData.due_date}</div>
          <span className="text-[11px] text-slate-400">Version #{caseData.version}</span>
        </div>
      </div>

      {/* Overdue Warning Callout */}
      {caseData.is_overdue && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs space-y-0.5">
            <strong className="font-bold uppercase tracking-wider text-red-800">
              Compliance Deadline Exceeded
            </strong>
            <p className="text-red-700">
              The due date ({caseData.due_date}) for this monthly cycle has passed based on the Indian Standard Time (Asia/Kolkata).
            </p>
          </div>
        </div>
      )}

      {/* Calculated Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Required Documents
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {caseData.required_count}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Mandatory checklist items</p>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Received
          </span>
          <div className="text-2xl font-bold text-emerald-950 mt-1">
            {caseData.received_count}
          </div>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            {caseData.missing_count > 0 ? `${caseData.missing_count} required remaining` : 'All required received'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200">
          <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
            Dispatched to CA
          </span>
          <div className="text-2xl font-bold text-purple-950 mt-1">
            {caseData.dispatched_count}
          </div>
          <p className="text-[11px] text-purple-700 mt-0.5">
            {caseData.undispatched_count > 0 ? `${caseData.undispatched_count} awaiting dispatch` : 'All received sent'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
          <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
            Pending Dispatch
          </span>
          <div className="text-2xl font-bold text-blue-950 mt-1">
            {caseData.undispatched_count}
          </div>
          <p className="text-[11px] text-blue-700 mt-0.5">Ready for outward courier/mail</p>
        </div>
      </div>
    </div>
  )
}
