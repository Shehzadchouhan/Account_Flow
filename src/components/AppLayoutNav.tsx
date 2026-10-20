'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import { GlobalSearch } from '@/components/GlobalSearch'
import { HowItWorksModal } from '@/components/HowItWorksModal'

interface NavItem {
  name: string
  subtitle: string
  href: string
  icon: (props: { className?: string }) => React.ReactElement
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    subtitle: 'Overview & Alerts',
    href: '/',
    icon: ({ className = 'w-5 h-5' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Pending Work',
    subtitle: 'Action Items & Reminders',
    href: '/pending',
    icon: ({ className = 'w-5 h-5' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: 'Cases',
    subtitle: 'Monthly Client Folders',
    href: '/cases',
    icon: ({ className = 'w-5 h-5' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    name: 'Dispatches',
    subtitle: 'Delivery Register',
    href: '/dispatches',
    icon: ({ className = 'w-5 h-5' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  {
    name: 'Firms',
    subtitle: 'Client Directory',
    href: '/firms',
    icon: ({ className = 'w-5 h-5' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    name: 'Reports',
    subtitle: 'Summaries & Exports',
    href: '/reports',
    icon: ({ className = 'w-5 h-5' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: 'Admin',
    subtitle: 'System & Case Setup',
    href: '/admin',
    icon: ({ className = 'w-5 h-5' }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

interface AppLayoutNavProps {
  userEmail: string
  userRole: string
  children: React.ReactNode
}

export function AppLayoutNav({ userEmail, userRole, children }: AppLayoutNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-900">
      {/* Interactive Workflow Guide Modal */}
      <HowItWorksModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* ========================================================= */}
      {/* Mobile Top Header */}
      {/* ========================================================= */}
      <header className="md:hidden bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-lg bg-white p-1 flex items-center justify-center shadow-xs shrink-0 border border-slate-700/50">
              <Image
                src="/logo-icon.png"
                alt="FinanceFlow Logo"
                width={30}
                height={30}
                className="object-contain"
                priority
              />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight block leading-tight text-white">
                Finance<span className="text-cyan-400">Flow</span>
              </span>
              <span className="text-2xs text-slate-400 block leading-none mt-0.5 font-medium">
                Every Document. In Flow.
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600/30 text-blue-200 border border-blue-500/40 text-xs font-bold hover:bg-blue-600/50"
            >
              📖 Guide
            </button>

            {/* Accessible Mobile Menu Toggle button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-800 bg-slate-950 px-3 py-3 space-y-1 animate-in fade-in duration-150">
            <nav aria-label="Mobile Navigation" className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <div>
                      <span className="block font-semibold leading-tight">{item.name}</span>
                      <span className={`block text-2xs leading-none mt-0.5 ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                        {item.subtitle}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </nav>

            {/* Mobile User Profile & Logout Area */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="px-3 py-2">
                <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Signed In As
                </div>
                <div className="text-sm font-medium text-slate-100 truncate" title={userEmail}>
                  {userEmail}
                </div>
                <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-semibold bg-slate-800 text-blue-300 border border-slate-700">
                  <span>Role:</span>
                  <span className="uppercase">{userRole}</span>
                </div>
              </div>

              <form action={logout} className="mt-2">
                <button
                  type="submit"
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-950 text-red-200 border border-red-800/60 font-semibold hover:bg-red-900 focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-colors"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================= */}
      {/* Desktop Persistent Left Sidebar */}
      {/* ========================================================= */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 border-r border-slate-800 text-white z-30">
        {/* Branding & Home Link */}
        <Link
          href="/"
          className="px-5 py-4 border-b border-slate-800 flex items-center gap-3 group hover:bg-slate-800/40 transition-colors"
        >
          <div className="h-10 w-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-sm shrink-0 border border-slate-700/60 group-hover:scale-105 transition-transform">
            <Image
              src="/logo-icon.png"
              alt="FinanceFlow Logo"
              width={34}
              height={34}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight text-white block leading-tight">
              Finance<span className="text-cyan-400">Flow</span>
            </span>
            <span className="text-2xs text-slate-400 font-medium block leading-none mt-1">
              Every Document. In Flow.
            </span>
          </div>
        </Link>

        {/* Quick Guide Pill Button */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-blue-950/80 text-blue-200 border border-blue-800/60 hover:bg-blue-900 hover:text-white transition-colors text-xs font-semibold group shadow-2xs"
          >
            <span className="h-5 w-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs group-hover:scale-105 transition-transform">
              📖
            </span>
            <span className="flex-1 text-left font-medium">How FinanceFlow Works</span>
            <span className="text-2xs bg-blue-800/80 px-1.5 py-0.5 rounded text-blue-200 font-bold">
              Guide
            </span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Main Navigation" className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold leading-snug">{item.name}</div>
                  <div className={`text-2xs leading-none truncate ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                    {item.subtitle}
                  </div>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* User Profile & Sign Out Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="mb-3 px-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Signed in as
            </p>
            <p className="text-sm font-semibold text-white truncate" title={userEmail}>
              {userEmail}
            </p>
            <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-semibold bg-slate-800 text-blue-300 border border-slate-700">
              <span className="text-slate-400">Role:</span>
              <span className="uppercase">{userRole}</span>
            </div>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-sm font-semibold hover:bg-red-950 hover:text-red-200 hover:border-red-900 focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* Main Content Area */}
      {/* ========================================================= */}
      <main className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Sticky Header Bar with Global Search & Guide */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 shadow-2xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1 max-w-xl">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 text-xs font-bold transition-colors shadow-2xs"
                title="Open 5-Step Workflow Guide & Glossary"
              >
                <span>📖</span>
                <span className="hidden sm:inline">How It Works</span>
              </button>
              <div className="hidden sm:flex items-center gap-3 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono text-2xs">
                  <span>IST</span>
                  <span>UTC+05:30</span>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600 truncate max-w-[160px]" title={userEmail}>
                  {userEmail}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
