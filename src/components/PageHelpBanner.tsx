'use client'

import { useState, useEffect } from 'react'

interface PageHelpBannerProps {
  id: string
  title: string
  description: string
  steps?: Array<{
    label: string
    detail: string
  }>
  tip?: string
  defaultOpen?: boolean
}

export function PageHelpBanner({
  id,
  title,
  description,
  steps = [],
  tip,
  defaultOpen = false,
}: PageHelpBannerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const storageKey = `ff_help_dismissed_${id}`

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === 'collapsed') {
        setIsOpen(false)
      } else if (stored === 'expanded') {
        setIsOpen(true)
      }
    } catch {
      // localStorage unavailable (e.g. incognito restrictions)
    }
  }, [storageKey])

  const toggle = () => {
    const next = !isOpen
    setIsOpen(next)
    try {
      localStorage.setItem(storageKey, next ? 'expanded' : 'collapsed')
    } catch {
      // ignore storage error
    }
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-3.5 sm:p-4 transition-all shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-left text-xs font-bold text-blue-900 hover:text-blue-700 transition-colors group w-full min-h-[40px]"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="h-6 w-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform text-xs">
              💡
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-900 leading-snug">
              {title}
            </span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 shrink-0">
            {isOpen ? 'Hide Guide ▲' : 'What is this page? ▼'}
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-blue-200/60 text-xs sm:text-sm text-slate-700 space-y-3 animate-in fade-in duration-150">
          <p className="leading-relaxed text-slate-700 font-normal">
            {description}
          </p>

          {steps.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white border border-blue-100 shadow-2xs"
                >
                  <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                    {idx + 1}. {step.label}
                  </span>
                  <span className="text-xs text-slate-600 block mt-1 leading-relaxed font-normal">
                    {step.detail}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tip && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-100/70 border border-blue-200 text-blue-950 font-medium text-xs">
              <span className="font-bold shrink-0">💡 Quick Tip:</span>
              <span className="leading-relaxed">{tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
