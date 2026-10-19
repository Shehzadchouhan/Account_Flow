'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Fatal Root Layout Error:', error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-900 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            System Service Unavailable
          </h1>

          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            A critical application error occurred while initializing the user interface.
          </p>

          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  )
}
