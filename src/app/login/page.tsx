import type { Metadata } from 'next'
import { LoginForm } from '@/components/LoginForm'

export const metadata: Metadata = {
  title: 'Sign In | FinanceFlow',
  description: 'Sign in to FinanceFlow document tracking and dispatch management',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold text-xl shadow-xs">
            FF
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            FinanceFlow
          </span>
        </div>
        <h1 className="mt-4 text-center text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Accounts Office Portal
        </h1>
        <p className="mt-1.5 text-center text-sm text-slate-600">
          Document Tracking & Dispatch Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md shadow-slate-200/50 rounded-xl sm:px-10 border border-slate-200">
          <LoginForm />

          <div className="mt-6 pt-5 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-500">
              FinanceFlow Phase 1 &bull; Internal Accounts Office System
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
