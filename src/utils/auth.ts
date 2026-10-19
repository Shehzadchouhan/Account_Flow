import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import type { User } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'staff'

/**
 * Retrieves the currently authenticated Supabase user on the server.
 * Returns null if the user is unauthenticated or has an invalid session.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    return user
  } catch (error) {
    // Fail closed if Supabase cannot be reached
    console.error('Error fetching current user:', error)
    return null
  }
}

/**
 * Server-side helper to ensure the user is authenticated.
 * Enforces authentication on the server layer in addition to middleware.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

/**
 * Retrieves the role for the current user.
 * 
 * =========================================================================
 * TODO: Phase 2 - Database Integration
 * =========================================================================
 * In Phase 2, when the 'profiles' table is created with a 'role' column,
 * this function should query the database:
 * 
 *   const supabase = await createClient()
 *   const { data, error } = await supabase
 *     .from('profiles')
 *     .select('role')
 *     .eq('id', user.id)
 *     .single()
 *   if (error || !data) return 'staff'
 *   return data.role as UserRole
 * =========================================================================
 * 
 * For Phase 1 skeleton:
 * Reads role from user_metadata if available, otherwise defaults to 'admin'
 * so the guarded /admin page and role permissions can be demonstrated and verified.
 */
export async function getCurrentUserRole(): Promise<UserRole> {
  const user = await getCurrentUser()
  if (!user) {
    return 'staff'
  }

  // Check if role was specified in user metadata during sign-in/creation
  const metaRole = user.user_metadata?.role as UserRole | undefined
  if (metaRole === 'admin' || metaRole === 'staff') {
    return metaRole
  }

  // Phase 1 fallback default
  return 'admin'
}

/**
 * Server-side guard to ensure the current user has the 'admin' role.
 * Redirects unauthenticated users to /login and unauthorized non-admin users to /.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireAuth()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    // Non-admin users are denied access and redirected to the main dashboard
    redirect('/')
  }

  return user
}
