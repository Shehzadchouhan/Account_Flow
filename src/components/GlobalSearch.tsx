'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { searchGlobal, type GlobalSearchResults } from '@/app/actions/search'
import { StatusBadge } from '@/components/StatusBadge'
import { formatMonthYear } from '@/lib/date-utils'
import type { CaseStatusType, CaseDocumentStatusType } from '@/types/database.types'

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<GlobalSearchResults | null>(null)
  const [isPending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut: Ctrl+K or Cmd+K or "/" to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      } else if (e.key === '/' && document.activeElement !== inputRef.current && !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName || ''))) {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      } else if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search trigger
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      return
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await searchGlobal(trimmed)
          setResults(res)
          setIsOpen(true)
        } catch (err) {
          console.error('Global search error:', err)
        }
      })
    }, 280)

    return () => clearTimeout(timer)
  }, [query])

  const totalResults =
    (results?.firms.length || 0) +
    (results?.cases.length || 0) +
    (results?.documents.length || 0)

  const handleSelect = (url: string) => {
    setIsOpen(false)
    setQuery('')
    router.push(url)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-lg">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          {isPending ? (
            <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>

        <input
          ref={inputRef}
          id="global-search-input"
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls="global-search-results"
          aria-label="Search firms, cases, or documents"
          value={query}
          onChange={(e) => {
            const nextVal = e.target.value
            setQuery(nextVal)
            if (nextVal.trim().length < 2) {
              setResults(null)
              setIsOpen(false)
            } else {
              setIsOpen(true)
            }
          }}
          onFocus={() => {
            if (results && query.trim().length >= 2) {
              setIsOpen(true)
            }
          }}
          placeholder="Search firms, cases, docs... (Ctrl+K)"
          className="w-full pl-9 pr-9 py-2 text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition-colors shadow-2xs min-h-[38px]"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults(null)
              setIsOpen(false)
              inputRef.current?.focus()
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
            aria-label="Clear search query"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Floating Results Popup */}
      {isOpen && query.trim().length >= 2 && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-[80vh] overflow-y-auto animate-in fade-in duration-100"
        >
          {totalResults === 0 && !isPending && (
            <div className="p-6 text-center text-sm text-slate-500">
              <p className="font-medium text-slate-700">No results found</p>
              <p className="mt-1 text-xs text-slate-400">
                No matching firms, cases, or documents for &ldquo;{query}&rdquo;
              </p>
            </div>
          )}

          {isPending && totalResults === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              <p className="font-medium">Searching...</p>
            </div>
          )}

          {/* 1. Firms Group */}
          {results && results.firms.length > 0 && (
            <div className="p-2 border-b border-slate-100">
              <div className="px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Client Firms</span>
                <span className="text-slate-400">{results.firms.length}</span>
              </div>
              <div className="space-y-0.5">
                {results.firms.map((firm) => (
                  <button
                    key={firm.id}
                    type="button"
                    onClick={() => handleSelect(`/firms/${firm.id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 active:bg-slate-100 flex items-center justify-between transition-colors text-sm group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 truncate group-hover:text-blue-600">
                        {firm.name}
                      </div>
                      {firm.contact_person && (
                        <div className="text-xs text-slate-500 truncate">
                          Contact: {firm.contact_person}
                        </div>
                      )}
                    </div>
                    <div>
                      {firm.is_active ? (
                        <span className="px-1.5 py-0.5 text-2xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-2xs font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200">
                          ARCHIVED
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Cases Group */}
          {results && results.cases.length > 0 && (
            <div className="p-2 border-b border-slate-100">
              <div className="px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Compliance Cases</span>
                <span className="text-slate-400">{results.cases.length}</span>
              </div>
              <div className="space-y-0.5">
                {results.cases.map((c) => (
                  <button
                    key={c.case_id}
                    type="button"
                    onClick={() => handleSelect(`/cases/${c.case_id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 active:bg-slate-100 flex items-center justify-between transition-colors text-sm group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 truncate group-hover:text-blue-600">
                        {c.firm_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatMonthYear(c.period_month)} &bull; {c.cycle === 'A_11th' ? 'Cycle A (11th)' : 'Cycle B (20th)'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {c.is_overdue && (
                        <span className="px-1.5 py-0.5 text-2xs font-bold rounded bg-red-100 text-red-800 border border-red-300">
                          OVERDUE
                        </span>
                      )}
                      <StatusBadge status={c.status as CaseStatusType} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Documents Group */}
          {results && results.documents.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Checklist Documents</span>
                <span className="text-slate-400">{results.documents.length}</span>
              </div>
              <div className="space-y-0.5">
                {results.documents.map((doc) => (
                  <button
                    key={doc.case_document_id}
                    type="button"
                    onClick={() => handleSelect(`/cases/${doc.case_id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 active:bg-slate-100 flex items-center justify-between transition-colors text-sm group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 truncate group-hover:text-blue-600">
                        {doc.document_type_name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {doc.firm_name} &bull; {formatMonthYear(doc.period_month)} ({doc.cycle})
                      </div>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={doc.status as CaseDocumentStatusType} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 text-2xs text-slate-500 flex items-center justify-between">
            <span>Press <kbd className="font-mono bg-white px-1 py-0.5 border border-slate-200 rounded">Esc</kbd> to exit</span>
            <span>Server-side search</span>
          </div>
        </div>
      )}
    </div>
  )
}
