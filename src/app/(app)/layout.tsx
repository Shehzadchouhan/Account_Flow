import { requireAuth, getCurrentUserRole } from '@/utils/auth'
import { AppLayoutNav } from '@/components/AppLayoutNav'

// Force dynamic rendering since authenticated routes read request cookies & user session
export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side authentication guard:
  // Redirects unauthenticated requests to /login even if middleware was bypassed
  const user = await requireAuth()
  const role = await getCurrentUserRole()

  return (
    <AppLayoutNav
      userEmail={user.email || 'officer@financeflow.local'}
      userRole={role}
    >
      {children}
    </AppLayoutNav>
  )
}
