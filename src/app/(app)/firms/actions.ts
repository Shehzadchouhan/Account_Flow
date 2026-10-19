'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { assertAdmin } from '@/utils/auth'
import { firmSchema } from '@/lib/validations/firm'
import { templateItemSchema } from '@/lib/validations/templateItem'

export interface ActionState {
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
 * Creates a new client firm.
 * Guarded by requireAdmin() and RLS.
 */
export async function createFirmAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  try {
    await assertAdmin()

    const rawData = {
      name: formData.get('name') as string,
      contact_person: formData.get('contact_person') as string,
      contact_email: formData.get('contact_email') as string,
      contact_phone: formData.get('contact_phone') as string,
      default_employee: formData.get('default_employee') as string,
      is_active: formData.get('is_active') === 'false' ? false : true,
    }

    const parseResult = firmSchema.safeParse(rawData)
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Please correct the validation errors below.',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('firms')
      .insert({
        name: parseResult.data.name,
        contact_person: parseResult.data.contact_person,
        contact_email: parseResult.data.contact_email,
        contact_phone: parseResult.data.contact_phone,
        default_employee: parseResult.data.default_employee,
        is_active: parseResult.data.is_active,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'A firm with this name already exists. Firm names must be unique.',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to create client firm.',
      }
    }

    revalidatePath('/firms')
    return {
      success: true,
      data: { firmId: data.id },
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Updates an existing client firm.
 * Guarded by requireAdmin() and RLS.
 */
export async function updateFirmAction(
  firmId: string,
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  try {
    await assertAdmin()

    const rawData = {
      name: formData.get('name') as string,
      contact_person: formData.get('contact_person') as string,
      contact_email: formData.get('contact_email') as string,
      contact_phone: formData.get('contact_phone') as string,
      default_employee: formData.get('default_employee') as string,
      is_active: formData.get('is_active') === 'false' ? false : true,
    }

    const parseResult = firmSchema.safeParse(rawData)
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Please correct the validation errors below.',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('firms')
      .update({
        name: parseResult.data.name,
        contact_person: parseResult.data.contact_person,
        contact_email: parseResult.data.contact_email,
        contact_phone: parseResult.data.contact_phone,
        default_employee: parseResult.data.default_employee,
        is_active: parseResult.data.is_active,
      })
      .eq('id', firmId)

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'A firm with this name already exists. Firm names must be unique.',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to update client firm.',
      }
    }

    revalidatePath('/firms')
    revalidatePath(`/firms/${firmId}`)
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Toggles a firm's active/archived status.
 */
export async function toggleFirmActiveAction(
  firmId: string,
  isActive: boolean
): Promise<ActionState> {
  try {
    await assertAdmin()

    const supabase = await createClient()
    const { error } = await supabase
      .from('firms')
      .update({ is_active: isActive })
      .eq('id', firmId)

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to update firm status.',
      }
    }

    revalidatePath('/firms')
    revalidatePath(`/firms/${firmId}`)
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Adds a document type to a firm's checklist template.
 */
export async function addTemplateItemAction(
  firmId: string,
  documentTypeId: string,
  isRequired: boolean
): Promise<ActionState> {
  try {
    await assertAdmin()

    const parseResult = templateItemSchema.safeParse({
      firm_id: firmId,
      document_type_id: documentTypeId,
      is_required: isRequired,
    })

    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid document type or firm selection.',
      }
    }

    const supabase = await createClient()
    const { error } = await supabase.from('firm_template_items').insert({
      firm_id: parseResult.data.firm_id,
      document_type_id: parseResult.data.document_type_id,
      is_required: parseResult.data.is_required,
    })

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'This document type is already in the firm checklist template.',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to add document type to template.',
      }
    }

    revalidatePath(`/firms/${firmId}`)
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Updates the required flag of a firm template item.
 */
export async function updateTemplateItemAction(
  itemId: string,
  firmId: string,
  isRequired: boolean
): Promise<ActionState> {
  try {
    await assertAdmin()

    const supabase = await createClient()
    const { error } = await supabase
      .from('firm_template_items')
      .update({ is_required: isRequired })
      .eq('id', itemId)
      .eq('firm_id', firmId)

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to update template item requirement.',
      }
    }

    revalidatePath(`/firms/${firmId}`)
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Removes a document type from a firm's checklist template.
 */
export async function removeTemplateItemAction(
  itemId: string,
  firmId: string
): Promise<ActionState> {
  try {
    await assertAdmin()

    const supabase = await createClient()
    const { error } = await supabase
      .from('firm_template_items')
      .delete()
      .eq('id', itemId)
      .eq('firm_id', firmId)

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to remove document type from template.',
      }
    }

    revalidatePath(`/firms/${firmId}`)
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}
