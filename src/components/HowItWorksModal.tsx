'use client'

import { useState } from 'react'

interface HowItWorksModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
  const [activeTab, setActiveTab] = useState<'workflow' | 'glossary' | 'faq'>('workflow')

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-it-works-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div>
              <h2 id="how-it-works-title" className="text-lg sm:text-xl font-bold tracking-tight text-white">
                How FinanceFlow Works
              </h2>
              <p className="text-xs text-blue-200 mt-0.5">
                Simple, step-by-step guide to daily accounting &amp; document operations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="rounded-lg p-2 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-3 sm:px-6 gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors whitespace-nowrap min-h-[40px] flex items-center shrink-0 ${
              activeTab === 'workflow'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1. The 5-Step Workflow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('glossary')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors whitespace-nowrap min-h-[40px] flex items-center shrink-0 ${
              activeTab === 'glossary'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Simple Words (Jargon Buster)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors whitespace-nowrap min-h-[40px] flex items-center shrink-0 ${
              activeTab === 'faq'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Common Questions &amp; Tips
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-slate-700 text-sm">
          {activeTab === 'workflow' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                FinanceFlow connects your clients, monthly accounting tasks, missing document collection, and deliveries into one seamless flow:
              </p>

              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>Client Directory (Firms)</span>
                    <span className="text-2xs font-normal text-slate-500">— Client profiles &amp; required checklist</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Add each client business (Acme Corp, Sharma Traders) with their contact person, phone, email, and assigned employee. Set up their default monthly document list (e.g., Sales Invoices, Purchase Bills, Bank Statement).
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>Monthly Work Folders (Cases)</span>
                    <span className="text-2xs font-normal text-slate-500">— One folder per client per month</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    At the start of each month, case folders are generated for all active clients. Each case has a due date (Cycle A: 11th or Cycle B: 20th) and holds the checklist of documents needed for that period.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
                <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>Collect &amp; Check Documents (Pending Work)</span>
                    <span className="text-2xs font-normal text-amber-700 font-semibold">— Daily Action Center</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    When a client brings in documents, check them off as <strong>Received</strong>. If documents are missing, click <strong>&quot;Email Reminder&quot;</strong> to automatically open an email draft requesting the specific missing papers from the client.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                  4
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>Deliver Work Back (Dispatches)</span>
                    <span className="text-2xs font-normal text-emerald-700 font-semibold">— Finishing the Job</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Once accounting or tax filing is done, return original files, signed balance sheets, or tax acknowledgement proofs to the client. Click <strong>&quot;Record Dispatch&quot;</strong> inside the case to log recipient name and courier/handover details.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="h-8 w-8 rounded-lg bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0">
                  5
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>Track Everything (Dashboard &amp; Reports)</span>
                    <span className="text-2xs font-normal text-slate-500">— Management &amp; Oversight</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Check the Dashboard every morning to see overdue tasks, items due today, and staff workloads. Export Excel reports anytime for reviews or client status meetings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'glossary' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 font-medium">
                Confused by accounting or system words? Here is what each term means in simple English:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="font-bold text-blue-700 block text-sm">Firm</span>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    Your <strong>client business</strong> (e.g. Acme Industries, Star Traders). Each firm has contact info and an assigned team member.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="font-bold text-blue-700 block text-sm">Case</span>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    A client&apos;s <strong>monthly work folder</strong> (e.g. &quot;Acme Corp - April 2026&quot;). It holds that month&apos;s document checklist.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="font-bold text-blue-700 block text-sm">Cycle A vs. Cycle B</span>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    <strong>Cycle A</strong> is due on the <strong>11th</strong> (e.g. GSTR-1 sales).<br />
                    <strong>Cycle B</strong> is due on the <strong>20th</strong> (e.g. GSTR-3B return &amp; monthly books).
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="font-bold text-blue-700 block text-sm">Dispatch</span>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    <strong>Delivering completed documents</strong> or audit files back to the client or chartered accountant.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="font-bold text-blue-700 block text-sm">Awaiting Documents</span>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    The case cannot be completed yet because <strong>the client hasn&apos;t provided one or more required papers</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="font-bold text-blue-700 block text-sm">Pending Dispatch</span>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    All required documents are <strong>in the office</strong>, work is being done, and completed files are waiting to be sent out.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="font-bold text-blue-700 block text-sm">Completed</span>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    Everything for this client&apos;s month is <strong>100% finished, verified, and delivered</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="font-bold text-blue-700 block text-sm">Template</span>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    The <strong>standard list of papers</strong> this client regularly needs each month (so you don&apos;t have to re-type it every month).
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <h4 className="font-bold text-slate-900 text-sm">
                  How do I send a reminder email to a client for missing papers?
                </h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Go to <strong>Pending Work</strong> or open any <strong>Case</strong>. If documents are missing, you will see a blue <strong>&quot;Email Reminder&quot;</strong> button. Click it to immediately open a pre-formatted email draft listing all missing items with one click.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <h4 className="font-bold text-slate-900 text-sm">
                  How do I record a dispatch (delivery)?
                </h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Open the client&apos;s case under <strong>Cases</strong>. Once documents are marked as received, click the <strong>&quot;Record Dispatch&quot;</strong> button at the top of the checklist. Enter who received it (e.g. &quot;Client Handover&quot; or &quot;BlueDart Courier #1234&quot;) and click Save.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <h4 className="font-bold text-slate-900 text-sm">
                  How do I see only MY assigned work?
                </h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  On the <strong>Pending Work</strong> page, click the <strong>&quot;Filter to My Work&quot;</strong> button at the top right. It will instantly filter the list to only documents and clients assigned to you.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <h4 className="font-bold text-slate-900 text-sm">
                  What if a client brings a document that wasn&apos;t on their checklist?
                </h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Inside the case, an Admin can click <strong>&quot;Add Document to Case&quot;</strong> to attach extra document types for just this month without affecting other clients.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            Need more help? Check with your office administrator.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors min-h-[40px] text-center"
          >
            Got It! Close Guide
          </button>
        </div>
      </div>
    </div>
  )
}
