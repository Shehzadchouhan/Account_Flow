import React from 'react'

interface EmptyStateCardProps {
  title: string
  subtitle: string
  phaseText: string
  description: string
  plannedFeatures?: string[]
  icon: (props: { className?: string }) => React.ReactElement
}

export function EmptyStateCard({
  title,
  subtitle,
  phaseText,
  description,
  plannedFeatures = [],
  icon: Icon,
}: EmptyStateCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-5 bg-slate-50/75 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>

        {/* Status Badge with TEXT + Color */}
        <div className="inline-flex items-center gap-2 self-start sm:self-center px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold uppercase tracking-wide">
          <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
          <span>Status: {phaseText}</span>
        </div>
      </div>

      {/* Body / Empty State */}
      <div className="p-6 sm:p-10 flex flex-col items-center text-center max-w-2xl mx-auto">
        <div className="h-16 w-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-4">
          <Icon className="w-8 h-8" />
        </div>

        <h2 className="text-lg font-bold text-slate-900">No data available yet</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {description}
        </p>

        {plannedFeatures.length > 0 && (
          <div className="mt-6 w-full text-left bg-slate-50 rounded-lg p-5 border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
              Planned Capabilities for this Module
            </h3>
            <ul className="space-y-2 text-sm text-slate-700">
              {plannedFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-blue-700 font-bold shrink-0">&bull;</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 text-xs text-slate-500">
          This page skeleton has been initialized for Phase 1. Database tables and business logic will be integrated in subsequent phases.
        </div>
      </div>
    </div>
  )
}
