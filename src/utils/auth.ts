import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types/database.types'

export type { UserRole }

export interface UserProfile {
  id: string
  email: string | null
  full_name: string
  role: UserRole
  is_active: boolean
}

export interface UserContext {
  user: User
  profile: UserProfile
}

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
    console.error('Error fetching current user:', error)
    return null
  }
}

/**
 * Retrieves the full user context including profile, role, and active status.
 * Fails safely by returning null if unauthenticated or profile not found.
 */
export const getCurrentUserProfile = cache(async function getCurrentUserProfile(): Promise<UserContext | null> {
  const user = await getCurrentUser()
  if (!user) {
    return null
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', user.id)
      .single()

    if (error || !data) {
      // Fallback: check user metadata
      const metaRole = (user.user_metadata?.role as UserRole) || 'staff'
      return {
        user,
        profile: {
          id: user.id,
          email: user.email || null,
          full_name: user.user_metadata?.full_name || user.email || 'User',
          role: metaRole,
          is_active: true,
        },
      }
    }

    return {
      user,
      profile: data as UserProfile,
    }
  } catch (err) {
    console.error('Error querying profiles table for user context:', err)
    return null
  }
})

/**
 * Retrieves the role for the current user directly from the 'profiles' table.
 * Falls back safely to 'staff' if unauthenticated or on fetch error.
 */
export async function getCurrentUserRole(): Promise<UserRole> {
  const ctx = await getCurrentUserProfile()
  return ctx?.profile.role || 'staff'
}

/**
 * Server action / API assertion: Verifies caller is authenticated and active.
 * Throws explicit Error rather than redirecting, ideal for try/catch server actions.
 */
export async function assertAuth(): Promise<UserContext> {
  const ctx = await getCurrentUserProfile()
  if (!ctx) {
    throw new Error('Unauthorized: Authentication required.')
  }
  if (!ctx.profile.is_active) {
    throw new Error('Unauthorized: Account is deactivated.')
  }
  return ctx
}

/**
 * Server action / API assertion: Verifies caller is authenticated, active, and has 'admin' role.
 * Throws explicit Error rather than redirecting, ideal for try/catch server actions.
 */
export async function assertAdmin(): Promise<UserContext> {
  const ctx = await assertAuth()
  if (ctx.profile.role !== 'admin') {
    throw new Error('Forbidden: Administrator privileges required.')
  }
  return ctx
}

/**
 * Page route guard to ensure the user is authenticated and active.
 * Redirects unauthenticated users to /login and inactive users to /login?error=account_deactivated.
 */
export async function requireAuth(options?: { redirectOnFail?: boolean }): Promise<User> {
  const shouldRedirect = options?.redirectOnFail !== false
  const ctx = await getCurrentUserProfile()

  if (!ctx) {
    if (shouldRedirect) redirect('/login')
    throw new Error('Unauthorized: Authentication required.')
  }

  if (!ctx.profile.is_active) {
    if (shouldRedirect) redirect('/login?error=account_deactivated')
    throw new Error('Unauthorized: Account is deactivated.')
  }

  return ctx.user
}

/**
 * Page route guard to ensure the current user has the 'admin' role and is active.
 * Redirects unauthenticated users to /login and non-admin users to /.
 */
export async function requireAdmin(options?: { redirectOnFail?: boolean }): Promise<User> {
  const shouldRedirect = options?.redirectOnFail !== false
  const ctx = await getCurrentUserProfile()

  if (!ctx) {
    if (shouldRedirect) redirect('/login')
    throw new Error('Unauthorized: Authentication required.')
  }

  if (!ctx.profile.is_active) {
    if (shouldRedirect) redirect('/login?error=account_deactivated')
    throw new Error('Unauthorized: Account is deactivated.')
  }

  if (ctx.profile.role !== 'admin') {
    if (shouldRedirect) redirect('/')
    throw new Error('Forbidden: Administrator privileges required.')
  }

  return ctx.user
}
