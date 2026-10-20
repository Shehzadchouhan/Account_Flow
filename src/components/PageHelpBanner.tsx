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
    <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 transition-all shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="flex items-center gap-2.5 text-left text-xs font-bold text-blue-900 hover:text-blue-700 transition-colors group flex-1"
        >
          <span className="h-6 w-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            💡
          </span>
          <span className="text-sm font-bold text-slate-900 group-hover:text-blue-900">
            {title}
          </span>
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
            {isOpen ? 'Hide Guide ▲' : 'What is this page? ▼'}
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-blue-200/60 text-xs text-slate-700 space-y-3 animate-in fade-in duration-150">
          <p className="leading-relaxed text-slate-600 font-medium">
            {description}
          </p>

          {steps.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-white/80 border border-blue-100/80 shadow-2xs"
                >
                  <span className="font-bold text-slate-900 block text-xs">
                    {idx + 1}. {step.label}
                  </span>
                  <span className="text-2xs text-slate-600 block mt-0.5 leading-snug">
                    {step.detail}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tip && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-100/60 border border-blue-200/80 text-blue-950 font-medium text-2xs">
              <span className="font-bold shrink-0">💡 Quick Tip:</span>
              <span className="leading-snug">{tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
