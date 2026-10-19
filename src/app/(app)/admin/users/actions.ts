'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/utils/auth'
import { userProfileUpdateSchema } from '@/lib/validations/profile'

export interface UserActionState {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message
  }
  return fallback
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
    await requireAdmin()

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

    const supabase = await createClient()
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
