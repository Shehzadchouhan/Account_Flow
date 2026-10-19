'use client'

import { useActionState } from 'react'
import { login, type AuthState } from '@/app/auth/actions'

const initialState: AuthState = {}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState)

  return (
    <form action={formAction} className="space-y-5" noValidate={false}>
      {state?.error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 flex items-start gap-3"
        >
          <svg
            className="w-5 h-5 text-red-700 mt-0.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="font-semibold text-red-950">Authentication Error</p>
            <p className="mt-0.5">{state.error}</p>
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-slate-800 mb-1.5"
        >
          Work Email
        </label>
        <div className="relative">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="officer@accounts.firm.in"
            className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-base shadow-xs transition-colors focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-semibold text-slate-800 mb-1.5"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-base shadow-xs transition-colors focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full min-h-[44px] inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 active:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Signing In...
          </span>
        ) : (
          'Sign In to Dashboard'
        )}
      </button>
    </form>
  )
}
