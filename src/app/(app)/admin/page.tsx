import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/utils/auth'
import { createClient } from '@/utils/supabase/server'
import { PageHelpBanner } from '@/components/PageHelpBanner'

export const metadata: Metadata = {
  title: 'Administration & Settings | FinanceFlow',
  description: 'Manage staff accounts, document types catalog, client imports, and monthly case generation',
}

export default async function AdminPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  // Fetch quick metrics
  const { count: usersCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { count: docTypesCount } = await supabase
    .from('document_types')
    .select('*', { count: 'exact', head: true })

  const { count: firmsCount } = await supabase
    .from('firms')
    .select('*', { count: 'exact', head: true })

  const { count: casesCount } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true })

  const { count: activityLogsCount } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Administration &amp; Master Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Team accounts, master document types, Excel client import, and monthly case generation
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" aria-hidden="true" />
          <span>ADMIN ACCESS ({user.email})</span>
        </div>
      </div>

      {/* Beginner-friendly page guide */}
      <PageHelpBanner
        id="admin-dashboard"
        title="Admin Guide: What is managed on this page?"
        description="This control center is restricted to administrators. Use it to configure your office settings, add staff accounts, and run the monthly case generator."
        steps={[
          {
            label: 'Monthly Case Setup',
            detail: 'At the start of every month, open the Case Generator below to create folders for all active clients.',
          },
          {
            label: 'Team & Accounts',
            detail: 'Manage staff members, passwords, and permissions (Admin vs Staff role).',
          },
          {
            label: 'Document Types & Import',
            detail: 'Configure your office master document catalog, or import clients in bulk from Excel.',
          },
        ]}
        tip="The Monthly Case Generator is completely safe to test — click 'Preview Without Saving' to see what will be created before confirming."
      />

      {/* Featured Primary Action: Monthly Case Generator */}
      <Link
        href="/admin/generate-cases"
        className="group block p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-blue-800"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl shrink-0 group-hover:bg-white/20 transition-colors">
              <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-xs font-semibold uppercase tracking-wider">
                  Monthly Action Required
                </span>
                <span className="text-xs text-blue-300">Run at month start</span>
              </div>
              <h2 className="text-xl font-bold mt-1 text-white group-hover:text-blue-100 flex items-center gap-2">
                Monthly Case Generator
                <span className="text-blue-300 group-hover:translate-x-1 transition-transform">&rarr;</span>
              </h2>
              <p className="mt-1 text-xs text-blue-200 max-w-2xl leading-relaxed">
                Automatically generate Cycle A (due 11th) and Cycle B (due 20th) folders for all active client firms. Copies their checklist templates with a safe preview before creating.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-white text-blue-950 hover:bg-blue-50 shrink-0">
            Open Generator
          </span>
        </div>
      </Link>

      {/* Administration Hub Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* User Administration Card */}
        <Link
          href="/admin/users"
          className="group block p-6 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 bg-purple-50 text-purple-700 rounded-xl group-hover:bg-purple-100 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {usersCount || 0} Registered
            </span>
          </div>

          <h2 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center justify-between">
            <span>Users</span>
            <svg
              className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Activate staff accounts, manage roles, and maintain user profiles protected by last-admin guards.
          </p>
        </Link>

        {/* Document Types Catalog Card */}
        <Link
          href="/admin/document-types"
          className="group block p-6 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-xl group-hover:bg-blue-100 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {docTypesCount || 0} Types
            </span>
          </div>

          <h2 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center justify-between">
            <span>Doc Types</span>
            <svg
              className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Configure master document types used across all compliance firm checklists.
          </p>
        </Link>

        {/* Batch Firm Importer Card */}
        <Link
          href="/admin/import"
          className="group block p-6 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl group-hover:bg-emerald-100 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Batch Tool
            </span>
          </div>

          <h2 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors flex items-center justify-between">
            <span>Firm Importer</span>
            <svg
              className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Upload .xlsx or .csv files to bulk-register client firms with templates and validation reports.
          </p>
        </Link>

        {/* System Activity & Audit Log Card */}
        <Link
          href="/admin/activity"
          className="group block p-6 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-200 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {activityLogsCount || 0} Events
            </span>
          </div>

          <h2 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center justify-between">
            <span>Activity Log</span>
            <svg
              className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Forensic audit trail with actor filtering, entity deep-links, and payload inspection.
          </p>
        </Link>
      </div>

      {/* Quick Summary Card */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          Office Directory Snapshot
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Total Generated Cases</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{casesCount || 0}</div>
            <Link
              href="/cases"
              className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View Cases &rarr;
            </Link>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Registered Firms</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{firmsCount || 0}</div>
            <Link
              href="/firms"
              className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Manage Firms &rarr;
            </Link>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Document Categories</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{docTypesCount || 0}</div>
            <Link
              href="/admin/document-types"
              className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View Catalog &rarr;
            </Link>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Team Profiles</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{usersCount || 0}</div>
            <Link
              href="/admin/users"
              className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Manage Team &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
