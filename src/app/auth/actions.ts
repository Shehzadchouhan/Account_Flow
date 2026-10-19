'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export interface AuthState {
  error?: string
}

/**
 * Server Action for authenticating with Email and Password.
 */
export async function login(prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Please enter both email and password.' }
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message || 'Invalid login credentials. Please try again.' }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred during login.'
    return { error: message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Server Action for signing out of the application.
 */
export async function logout(): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (err) {
    console.error('Logout error:', err)
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}
