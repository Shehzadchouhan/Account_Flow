'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { assertAdmin } from '@/utils/auth'
import {
  userProfileUpdateSchema,
  createTeamMemberSchema,
} from '@/lib/validations/profile'
import type { UserRole } from '@/types/database.types'

export interface UserActionState {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export interface CreateTeamMemberResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  credentials?: {
    id: string
    full_name: string
    email: string
    role: UserRole
    is_active: boolean
    password?: string
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message
  }
  return fallback
}

/**
 * Creates and onboards a new staff or admin team member.
 * If SUPABASE_SERVICE_ROLE_KEY is present, provisions the user directly in Supabase Auth
 * without hitting public email verification rate limits.
 */
export async function createTeamMemberAction(
  prevState: CreateTeamMemberResult | null,
  formData: FormData
): Promise<CreateTeamMemberResult> {
  try {
    await assertAdmin()

    const rawData = {
      full_name: formData.get('full_name') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as string,
      password: formData.get('password') as string,
      is_active: formData.get('is_active') === 'true',
    }

    const parseResult = createTeamMemberSchema.safeParse(rawData)
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Please fix the validation errors.',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      }
    }

    const { full_name, email, role, password, is_active } = parseResult.data

    // 1. Try privileged admin client first (bypasses email rate limit & auto-confirms email)
    const adminClient = createAdminClient()
    if (adminClient) {
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      })

      if (authError) {
        return {
          success: false,
          error: authError.message || 'Failed to create user account.',
        }
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'User creation failed: No user record returned by auth service.',
        }
      }

      const newUserId = authData.user.id

      // Update profile with requested role and active status
      const { error: profileError } = await adminClient
        .from('profiles')
        .update({
          full_name,
          email,
          role,
          is_active,
        })
        .eq('id', newUserId)

      if (profileError) {
        console.warn('Profile update warning:', profileError)
      }

      revalidatePath('/admin/users')
      return {
        success: true,
        credentials: {
          id: newUserId,
          full_name,
          email,
          role,
          is_active,
          password,
        },
      }
    }

    // 2. Fallback: Standard client signup (when service role key is not configured)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase configuration is missing from environment variables.',
      }
    }

    const isolatedAnonClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: signUpData, error: signUpError } = await isolatedAnonClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
        },
      },
    })

    if (signUpError) {
      const msg = signUpError.message?.toLowerCase() || ''
      if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        return {
          success: false,
          error:
            'Supabase free tier email rate limit reached (3 emails/hour). Choose one of 2 quick fixes:\n\n' +
            '1. (Recommended) Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file. Find it in Supabase Dashboard > Settings > API > Project API keys > "service_role" (click "Reveal").\n' +
            '2. OR in Supabase Dashboard > Authentication > Providers > Email, turn OFF "Confirm email" and Save so no confirmation emails are sent.',
        }
      }
      return {
        success: false,
        error: signUpError.message || 'Failed to create user account.',
      }
    }

    if (signUpData.user) {
      // Use caller's authenticated admin client to update the new profile
      const callerSupabase = await createServerClient()
      await callerSupabase
        .from('profiles')
        .update({
          full_name,
          email,
          role,
          is_active,
        })
        .eq('id', signUpData.user.id)

      revalidatePath('/admin/users')
      return {
        success: true,
        credentials: {
          id: signUpData.user.id,
          full_name,
          email,
          role,
          is_active,
          password,
        },
      }
    }

    return {
      success: false,
      error: 'Unable to provision team member. Please verify configuration.',
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Updates a user profile's full name, role, and active status.
 * Enforces server-side requireAdmin check and handles last-admin database trigger errors.
 */
export async function updateUserProfileAction(
  userId: string,
  prevState: UserActionState | null,
  formData: FormData
): Promise<UserActionState> {
  try {
    await assertAdmin()

    const rawData = {
      full_name: formData.get('full_name') as string,
      role: formData.get('role') as string,
      is_active: formData.get('is_active') === 'true',
    }

    const parseResult = userProfileUpdateSchema.safeParse(rawData)
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Please fix the validation errors.',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: parseResult.data.full_name,
        role: parseResult.data.role,
        is_active: parseResult.data.is_active,
      })
      .eq('id', userId)

    if (error) {
      if (
        error.message?.includes('last remaining active administrator') ||
        error.details?.includes('last remaining active administrator')
      ) {
        return {
          success: false,
          error:
            'Operation prohibited: You cannot deactivate or demote the only remaining active administrator in the system.',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to update user profile.',
      }
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * 1-Click quick toggle for team member active status.
 * Prevents deactivating the last active administrator.
 */
export async function toggleUserStatusAction(
  userId: string,
  newActiveState: boolean
): Promise<UserActionState> {
  try {
    await assertAdmin()

    const supabase = await createServerClient()

    // Database trigger trg_profiles_last_admin_guard will reject deactivating the last admin
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newActiveState })
      .eq('id', userId)

    if (error) {
      if (
        error.message?.includes('last remaining active administrator') ||
        error.details?.includes('last remaining active administrator')
      ) {
        return {
          success: false,
          error:
            'Operation prohibited: You cannot deactivate the only remaining active administrator.',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to update user status.',
      }
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected error occurred.'),
    }
  }
}

/**
 * Resets or updates a team member's password.
 * Requires SUPABASE_SERVICE_ROLE_KEY to be configured.
 */
export async function resetUserPasswordAction(
  userId: string,
  newPassword: string
): Promise<UserActionState> {
  try {
    await assertAdmin()

    if (!newPassword || newPassword.length < 6) {
      return {
        success: false,
        error: 'Password must be at least 6 characters long.',
      }
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return {
        success: false,
        error:
          'Password reset directly from admin panel requires SUPABASE_SERVICE_ROLE_KEY in .env.local.',
      }
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to reset password.',
      }
    }

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'Failed to reset user password.'),
    }
  }
}
