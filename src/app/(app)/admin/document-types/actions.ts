'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/utils/auth'
import { documentTypeSchema } from '@/lib/validations/documentType'

export interface DocumentTypeActionState {
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
 * Creates a new document type in the master dictionary.
 */
export async function createDocumentTypeAction(
  prevState: DocumentTypeActionState | null,
  formData: FormData
): Promise<DocumentTypeActionState> {
  try {
    await requireAdmin()

    const rawData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      is_active: formData.get('is_active') === 'false' ? false : true,
    }

    const parseResult = documentTypeSchema.safeParse(rawData)
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Please fix the validation errors.',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createClient()
    const { error } = await supabase.from('document_types').insert({
      name: parseResult.data.name,
      description: parseResult.data.description,
      is_active: parseResult.data.is_active,
    })

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'A document type with this name already exists.',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to create document type.',
      }
    }

    revalidatePath('/admin/document-types')
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Updates a document type's name and description.
 */
export async function updateDocumentTypeAction(
  id: string,
  prevState: DocumentTypeActionState | null,
  formData: FormData
): Promise<DocumentTypeActionState> {
  try {
    await requireAdmin()

    const rawData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      is_active: formData.get('is_active') === 'false' ? false : true,
    }

    const parseResult = documentTypeSchema.safeParse(rawData)
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Please fix the validation errors.',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('document_types')
      .update({
        name: parseResult.data.name,
        description: parseResult.data.description,
        is_active: parseResult.data.is_active,
      })
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'A document type with this name already exists.',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to update document type.',
      }
    }

    revalidatePath('/admin/document-types')
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Activates or deactivates a document type.
 * Document types are never hard deleted to preserve historical dockets.
 */
export async function toggleDocumentTypeActiveAction(
  id: string,
  isActive: boolean
): Promise<DocumentTypeActionState> {
  try {
    await requireAdmin()

    const supabase = await createClient()
    const { error } = await supabase
      .from('document_types')
      .update({ is_active: isActive })
      .eq('id', id)

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to update document type status.',
      }
    }

    revalidatePath('/admin/document-types')
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}
