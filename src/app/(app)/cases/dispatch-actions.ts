'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin, requireAuth } from '@/utils/auth'
import { createDispatchSchema, voidDispatchSchema } from '@/lib/validations/dispatch'

export interface DispatchActionState {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  data?: Record<string, unknown>
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message
  }
  return fallback
}

/**
 * Creates an outward dispatch for one or more received documents.
 * Atomic, idempotent, and requires active authenticated user.
 */
export async function createDispatchAction(
  prevState: DispatchActionState | null,
  formData: FormData
): Promise<DispatchActionState> {
  try {
    await requireAuth()

    // Handle document IDs whether passed as multiple fields, comma-separated, or JSON array
    const rawDocIds: string[] = []
    const allDocValues = formData.getAll('case_document_ids')
    if (allDocValues.length > 0) {
      for (const val of allDocValues) {
        if (typeof val === 'string') {
          if (val.startsWith('[') && val.endsWith(']')) {
            try {
              const parsed = JSON.parse(val)
              if (Array.isArray(parsed)) {
                rawDocIds.push(...parsed)
              }
            } catch {
              rawDocIds.push(val)
            }
          } else if (val.includes(',')) {
            rawDocIds.push(...val.split(',').map((s) => s.trim()))
          } else if (val.trim().length > 0) {
            rawDocIds.push(val.trim())
          }
        }
      }
    }

    const rawData = {
      case_id: formData.get('case_id') as string,
      recipient: formData.get('recipient') as string,
      case_document_ids: rawDocIds,
      sent_at: formData.get('sent_at') as string,
      email_reference: formData.get('email_reference') as string,
      idempotency_key: formData.get('idempotency_key') as string,
    }

    const parseResult = createDispatchSchema.safeParse(rawData)
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Please fix the validation errors.',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('create_dispatch', {
      p_case_id: parseResult.data.case_id,
      p_recipient: parseResult.data.recipient,
      p_case_document_ids: parseResult.data.case_document_ids,
      p_sent_at: parseResult.data.sent_at,
      p_email_reference: parseResult.data.email_reference,
      p_idempotency_key: parseResult.data.idempotency_key,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to record outward dispatch.',
      }
    }

    revalidatePath('/cases')
    revalidatePath(`/cases/${parseResult.data.case_id}`)
    revalidatePath('/dispatches')

    return {
      success: true,
      data: (data as Record<string, unknown>) || {},
    }
  } catch (err) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected error occurred while creating the dispatch.'),
    }
  }
}

/**
 * Voids an outward dispatch with a mandatory reason.
 * Admin only. Reverts associated documents to undispatched in status calculations.
 */
export async function voidDispatchAction(
  prevState: DispatchActionState | null,
  formData: FormData
): Promise<DispatchActionState> {
  try {
    await requireAdmin()

    const rawData = {
      dispatch_id: formData.get('dispatch_id') as string,
      case_id: (formData.get('case_id') as string) || undefined,
      reason: formData.get('reason') as string,
    }

    const parseResult = voidDispatchSchema.safeParse(rawData)
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Please fix the validation errors.',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createClient()
    const { error } = await supabase.rpc('void_dispatch', {
      p_dispatch_id: parseResult.data.dispatch_id,
      p_reason: parseResult.data.reason,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to void outward dispatch.',
      }
    }

    revalidatePath('/cases')
    revalidatePath('/dispatches')
    if (parseResult.data.case_id) {
      revalidatePath(`/cases/${parseResult.data.case_id}`)
    }

    return {
      success: true,
    }
  } catch (err) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected error occurred while voiding the dispatch.'),
    }
  }
}

/**
 * Fetches distinct recipients from previous dispatches for autocomplete suggestions.
 */
export async function getDistinctRecipientsAction(): Promise<string[]> {
  try {
    await requireAuth()
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_distinct_recipients')
    if (error || !data) {
      return []
    }
    return data as string[]
  } catch {
    return []
  }
}
