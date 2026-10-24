'use client'

import { useState } from 'react'
import Link from 'next/link'
import { generateCasesAction } from '@/app/(app)/cases/actions'

interface FirmItem {
  firm_id: string
  firm_name: string
  assigned_to?: string | null
  template_items_count?: number
}

interface GeneratorResult {
  dry_run: boolean
  period_month: string
  cycle: string
  due_date: string
  created_count: number
  skipped_existing_count: number
  skipped_no_template_count: number
  created_firms: FirmItem[]
  skipped_existing_firms: FirmItem[]
  skipped_no_template_firms: FirmItem[]
}

export function CaseGeneratorForm() {
  // Current month in Asia/Kolkata
  const now = new Date()
  const year = now.getFullYear()
  const monthNum = String(now.getMonth() + 1).padStart(2, '0')
  const defaultMonth = `${year}-${monthNum}`

  const [month, setMonth] = useState(defaultMonth)
  const [cycle, setCycle] = useState<'A_11th' | 'B_20th'>('A_11th')
  const [dueDate, setDueDate] = useState(`${defaultMonth}-11`)
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [previewResult, setPreviewResult] = useState<GeneratorResult | null>(null)
  const [executionResult, setExecutionResult] = useState<GeneratorResult | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Auto-adjust default due date when month or cycle changes
  const handleCycleChange = (newCycle: 'A_11th' | 'B_20th') => {
    setCycle(newCycle)
    const day = newCycle === 'A_11th' ? '11' : '20'
    setDueDate(`${month}-${day}`)
    setPreviewResult(null)
    setExecutionResult(null)
  }

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth)
    const day = cycle === 'A_11th' ? '11' : '20'
    setDueDate(`${newMonth}-${day}`)
    setPreviewResult(null)
    setExecutionResult(null)
  }

  // Step 1: Dry-Run Preview
  const handleDryRunPreview = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsPending(true)
      setErrorMessage(null)
      setExecutionResult(null)

      const formData = new FormData()
      formData.set('month', `${month}-01`)
      formData.set('cycle', cycle)
      formData.set('due_date', dueDate)
      formData.set('dry_run', 'true')

      const res = await generateCasesAction(null, formData)
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to preview case generation.')
      } else {
        setPreviewResult(res.data as unknown as GeneratorResult)
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsPending(false)
    }
  }

  // Step 2: Confirmed Execution
  const handleConfirmGeneration = async () => {
    try {
      setIsPending(true)
      setErrorMessage(null)
      setShowConfirmModal(false)

      const formData = new FormData()
      formData.set('month', `${month}-01`)
      formData.set('cycle', cycle)
      formData.set('due_date', dueDate)
      formData.set('dry_run', 'false')

      const res = await generateCasesAction(null, formData)
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to generate cases.')
      } else {
        setExecutionResult(res.data as unknown as GeneratorResult)
        setPreviewResult(null)
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Parameter Configuration Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-2xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">1. Generation Parameters</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the compliance period month, deadline cycle, and target due date for active client firms
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        <form onSubmit={handleDryRunPreview} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Month Selector */}
          <div>
            <label htmlFor="month" className="block text-xs font-semibold text-slate-700 mb-1">
              Period Month <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              id="month"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
            <p className="mt-1 text-[11px] text-slate-500">First day of the compliance month</p>
          </div>

          {/* Cycle Selector */}
          <div>
            <label htmlFor="cycle" className="block text-xs font-semibold text-slate-700 mb-1">
              Compliance Cycle <span className="text-red-500">*</span>
            </label>
            <select
              id="cycle"
              value={cycle}
              onChange={(e) => handleCycleChange(e.target.value as 'A_11th' | 'B_20th')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              <option value="A_11th">Cycle A (Standard Due Date: 11th)</option>
              <option value="B_20th">Cycle B (Standard Due Date: 20th)</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-500">e.g. Cycle A for GSTR-1, Cycle B for GSTR-3B</p>
          </div>

          {/* Due Date Picker */}
          <div>
            <label htmlFor="due_date" className="block text-xs font-semibold text-slate-700 mb-1">
              Case Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="due_date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value)
                setPreviewResult(null)
              }}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
            <p className="mt-1 text-[11px] text-slate-500">Fully editable before generation</p>
          </div>

          {/* Action Row */}
          <div className="md:col-span-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Step 1 of 2: Safe preview &mdash; see exactly which client folders will be created before saving
            </span>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg min-h-[44px] transition-colors shadow-xs w-full sm:w-auto"
            >
              {isPending && !previewResult ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Checking Client List...
                </>
              ) : (
                'Preview Without Saving'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Step 2: Dry Run Preview Breakdown */}
      {previewResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-2xs space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
                <h3 className="text-lg font-bold text-slate-900">2. Preview Results (Nothing saved yet)</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Target Period: <strong>{previewResult.period_month}</strong> • Cycle: <strong>{previewResult.cycle}</strong> • Due: <strong>{previewResult.due_date}</strong>
              </p>
            </div>

            {previewResult.created_count > 0 ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg min-h-[44px] shadow-xs transition-colors shrink-0 w-full sm:w-auto"
              >
                Confirm &amp; Generate {previewResult.created_count} Cases
              </button>
            ) : (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                0 Cases to Generate
              </span>
            )}
          </div>

          {/* Metric Overview Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Ready to Create
              </span>
              <div className="text-2xl font-bold text-emerald-950 mt-1">
                {previewResult.created_count}
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">
                Active firms with checklist templates ready for new monthly cases
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-100 border border-slate-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Already Created (Skipped)
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {previewResult.skipped_existing_count}
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Safe: Cases already exist for these clients — will not be duplicated
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Skipped (No Checklist Setup)
              </span>
              <div className="text-2xl font-bold text-amber-950 mt-1">
                {previewResult.skipped_no_template_count}
              </div>
              <p className="text-[11px] text-amber-700 mt-1">
                Firms with zero documents configured in their template
              </p>
            </div>
          </div>

          {/* Detailed Lists */}
          <div className="space-y-4">
            {/* Created Firms List */}
            {previewResult.created_count > 0 && (
              <div className="border border-emerald-200 rounded-xl overflow-hidden">
                <div className="bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900">
                  Firms to be Created ({previewResult.created_count})
                </div>
                <ul className="divide-y divide-emerald-100 bg-white text-xs text-slate-800">
                  {previewResult.created_firms.map((firm) => (
                    <li key={firm.firm_id} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="font-semibold text-slate-900">{firm.firm_name}</span>
                      <span className="text-slate-500">
                        {firm.template_items_count} checklist documents configured
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skipped Existing Firms */}
            {previewResult.skipped_existing_count > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700">
                  Already Existing Cases ({previewResult.skipped_existing_count})
                </div>
                <ul className="divide-y divide-slate-100 bg-white text-xs text-slate-600 max-h-40 overflow-y-auto">
                  {previewResult.skipped_existing_firms.map((firm) => (
                    <li key={firm.firm_id} className="px-4 py-2">
                      {firm.firm_name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skipped No Template Firms */}
            {previewResult.skipped_no_template_count > 0 && (
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span>Firms Without Template Items ({previewResult.skipped_no_template_count})</span>
                  <span className="text-[11px] font-normal text-amber-700">
                    Add template items in firm profile to include in future runs
                  </span>
                </div>
                <ul className="divide-y divide-amber-100 bg-white text-xs text-slate-700">
                  {previewResult.skipped_no_template_firms.map((firm) => (
                    <li key={firm.firm_id} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span>{firm.firm_name}</span>
                      <Link
                        href={`/firms/${firm.firm_id}`}
                        target="_blank"
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        Configure Checklist &rarr;
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && previewResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-case-gen-title"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-4 sm:p-6 space-y-5 animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col my-auto overflow-hidden">
            <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1">
              <div>
                <h4 id="confirm-case-gen-title" className="text-lg font-bold text-slate-900">
                  Confirm Case Generation
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  You are about to generate <strong>{previewResult.created_count} new cases</strong> for{' '}
                  <strong>{previewResult.period_month}</strong> ({previewResult.cycle}).
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
                <div>• Due date will be set to: <strong>{previewResult.due_date}</strong></div>
                <div>• Each case will inherit its firm&apos;s default staff assignee</div>
                <div>• Checklist documents will be copied from firm templates</div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[38px] text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmGeneration}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg min-h-[38px] text-center"
              >
                {isPending ? 'Generating...' : 'Yes, Generate Cases Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final Execution Success Card */}
      {executionResult && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 sm:p-8 text-center space-y-4 animate-in fade-in duration-200">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h3 className="text-xl font-bold text-emerald-950">
              Case Generation Complete!
            </h3>
            <p className="text-sm text-emerald-800 mt-1">
              Successfully generated <strong>{executionResult.created_count}</strong> cases for{' '}
              <strong>{executionResult.period_month}</strong> ({executionResult.cycle}).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
            <Link
              href={`/cases?month=${executionResult.period_month}&cycle=${executionResult.cycle}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs min-h-[44px] w-full sm:w-auto"
            >
              View Generated Cases in Directory &rarr;
            </Link>
            <button
              type="button"
              onClick={() => {
                setExecutionResult(null)
                setPreviewResult(null)
              }}
              className="px-4 py-2 text-xs font-medium text-emerald-900 hover:underline min-h-[44px] flex items-center justify-center"
            >
              Generate More Cases
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
