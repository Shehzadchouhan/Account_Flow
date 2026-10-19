import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types/database.types'

export type { UserRole }

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
 * Retrieves the role for the current user directly from the 'profiles' table.
 * Falls back safely to 'staff' if unauthenticated or on fetch error.
 */
export async function getCurrentUserRole(): Promise<UserRole> {
  const user = await getCurrentUser()
  if (!user) {
    return 'staff'
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (error || !data) {
      // Fallback: check user metadata or default to 'staff'
      const metaRole = user.user_metadata?.role as UserRole | undefined
      return metaRole === 'admin' ? 'admin' : 'staff'
    }

    return (data.role as UserRole) || 'staff'
  } catch (err) {
    console.error('Error querying profiles table for role:', err)
    return 'staff'
  }
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
