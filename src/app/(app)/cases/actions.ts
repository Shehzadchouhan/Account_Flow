'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { assertAdmin, assertAuth } from '@/utils/auth'
import {
  generateCasesSchema,
  updateCaseDetailsSchema,
  addCaseDocumentSchema,
  updateDocumentNotesSchema,
} from '@/lib/validations/case'

export interface CaseActionState {
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
 * Runs the case generator in dry-run or creation mode.
 * Admin only.
 */
export async function generateCasesAction(
  prevState: CaseActionState | null,
  formData: FormData
): Promise<CaseActionState> {
  try {
    await assertAdmin()

    const rawData = {
      month: formData.get('month') as string,
      cycle: formData.get('cycle') as string,
      due_date: formData.get('due_date') as string,
      dry_run: formData.get('dry_run') === 'true',
    }

    const parseResult = generateCasesSchema.safeParse(rawData)
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Please fix the validation errors.',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('generate_cases', {
      p_month: parseResult.data.month,
      p_cycle: parseResult.data.cycle,
      p_due_date: parseResult.data.due_date,
      p_dry_run: parseResult.data.dry_run,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to execute case generation.',
      }
    }

    if (!parseResult.data.dry_run) {
      revalidatePath('/cases')
      revalidatePath('/admin/generate-cases')
    }

    return {
      success: true,
      data: data as Record<string, unknown>,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Marks a single document received in a case.
 */
export async function receiveDocumentAction(
  caseDocumentId: string,
  caseId: string
): Promise<CaseActionState> {
  try {
    await assertAuth()

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('receive_document', {
      p_case_document_id: caseDocumentId,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to mark document as received.',
      }
    }

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/cases')
    return { success: true, data: data as Record<string, unknown> }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected error occurred.'),
    }
  }
}

/**
 * Reverses a document receipt.
 * Blocked if the document is part of an active dispatch item.
 */
export async function unreceiveDocumentAction(
  caseDocumentId: string,
  caseId: string
): Promise<CaseActionState> {
  try {
    await assertAuth()

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('unreceive_document', {
      p_case_document_id: caseDocumentId,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to un-receive document.',
      }
    }

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/cases')
    return { success: true, data: data as Record<string, unknown> }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected error occurred.'),
    }
  }
}

/**
 * Bulk marks multiple selected documents as received within one case.
 */
export async function bulkReceiveDocumentsAction(
  caseId: string,
  documentIds: string[]
): Promise<CaseActionState> {
  try {
    await assertAuth()

    if (!documentIds || documentIds.length === 0) {
      return {
        success: false,
        error: 'No documents selected for receipt.',
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('bulk_receive_documents', {
      p_case_id: caseId,
      p_case_document_ids: documentIds,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to bulk-receive selected documents.',
      }
    }

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/cases')
    return { success: true, data: data as Record<string, unknown> }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected error occurred.'),
    }
  }
}

/**
 * Updates notes on a checklist item.
 */
export async function updateCaseNotesAction(
  caseDocumentId: string,
  caseId: string,
  notes: string
): Promise<CaseActionState> {
  try {
    await assertAuth()

    const parseResult = updateDocumentNotesSchema.safeParse({
      case_document_id: caseDocumentId,
      notes,
    })

    if (!parseResult.success) {
      return {
        success: false,
        error: 'Notes cannot exceed 1000 characters.',
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('update_case_document_notes', {
      p_case_document_id: caseDocumentId,
      p_notes: parseResult.data.notes,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to update notes.',
      }
    }

    revalidatePath(`/cases/${caseId}`)
    return { success: true, data: data as Record<string, unknown> }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected error occurred.'),
    }
  }
}

/**
 * Updates case due date and assignee using optimistic concurrency control.
 * Admin only.
 */
export async function updateCaseDetailsAction(
  prevState: CaseActionState | null,
  formData: FormData
): Promise<CaseActionState> {
  try {
    await assertAdmin()

    const rawData = {
      case_id: formData.get('case_id') as string,
      due_date: formData.get('due_date') as string,
      assigned_to: formData.get('assigned_to') as string,
      version: Number(formData.get('version')),
    }

    const parseResult = updateCaseDetailsSchema.safeParse(rawData)
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Please fix the validation errors.',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('update_case_details', {
      p_case_id: parseResult.data.case_id,
      p_due_date: parseResult.data.due_date,
      p_assigned_to: parseResult.data.assigned_to,
      p_version: parseResult.data.version,
    })

    if (error) {
      if (
        error.message?.includes('Concurrency conflict') ||
        error.details?.includes('Concurrency conflict')
      ) {
        return {
          success: false,
          error:
            'Concurrency Conflict: This case was modified by another user. Please reload the page to see the latest changes.',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to update case details.',
      }
    }

    revalidatePath(`/cases/${parseResult.data.case_id}`)
    revalidatePath('/cases')
    return { success: true, data: data as Record<string, unknown> }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Adds a document type to a case's checklist.
 * Admin only.
 */
export async function addCaseDocumentAction(
  caseId: string,
  documentTypeId: string,
  isRequired: boolean
): Promise<CaseActionState> {
  try {
    await assertAdmin()

    const parseResult = addCaseDocumentSchema.safeParse({
      case_id: caseId,
      document_type_id: documentTypeId,
      is_required: isRequired,
    })

    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid document type or case selection.',
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('add_case_document', {
      p_case_id: parseResult.data.case_id,
      p_document_type_id: parseResult.data.document_type_id,
      p_is_required: parseResult.data.is_required,
    })

    if (error) {
      if (error.code === '23505' || error.message?.includes('already present')) {
        return {
          success: false,
          error: 'This document type is already active in this case checklist.',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to add document to case.',
      }
    }

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/cases')
    return { success: true, data: { caseDocumentId: data } }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Soft-removes a document from a case.
 * Blocked if document is in an active dispatch.
 * Admin only.
 */
export async function removeCaseDocumentAction(
  caseDocumentId: string,
  caseId: string
): Promise<CaseActionState> {
  try {
    await assertAdmin()

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('remove_case_document', {
      p_case_document_id: caseDocumentId,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to remove document from case.',
      }
    }

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/cases')
    return { success: true, data: data as Record<string, unknown> }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}

/**
 * Toggles whether a case document is required or optional.
 * Admin only.
 */
export async function setDocumentRequiredAction(
  caseDocumentId: string,
  caseId: string,
  isRequired: boolean
): Promise<CaseActionState> {
  try {
    await assertAdmin()

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('set_document_required', {
      p_case_document_id: caseDocumentId,
      p_is_required: isRequired,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to update document requirement.',
      }
    }

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/cases')
    return { success: true, data: data as Record<string, unknown> }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected authorization error occurred.'),
    }
  }
}


/**
 * Uploads and attaches a PDF or image scan to a case checklist item.
 */
export async function uploadDocumentAttachmentAction(
  formData: FormData
): Promise<CaseActionState> {
  try {
    await assertAuth()

    const caseDocumentId = formData.get('case_document_id') as string
    const caseId = formData.get('case_id') as string
    const markAsReceived = formData.get('mark_as_received') === 'true'
    const file = formData.get('file') as File | null

    if (!caseDocumentId || !caseId) {
      return { success: false, error: 'Document and Case identifiers are required.' }
    }

    if (!file || file.size === 0) {
      return { success: false, error: 'Please select a valid document or PDF file to upload.' }
    }

    const MAX_SIZE = 15 * 1024 * 1024 // 15MB
    if (file.size > MAX_SIZE) {
      return { success: false, error: 'File size exceeds maximum allowed limit of 15MB.' }
    }

    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ]
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: 'Only PDF documents and images (PNG, JPG, WebP) can be uploaded.',
      }
    }

    const supabase = await createClient()

    // 1. Upload to Supabase Storage
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `cases/${caseId}/${caseDocumentId}/${Date.now()}_${safeFileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('case-attachments')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    let fileUrl: string
    if (uploadError) {
      return {
        success: false,
        error: `Storage upload failed: ${uploadError.message}. Ensure 'case-attachments' bucket is configured in Supabase.`,
      }
    } else {
      const { data: urlData } = supabase.storage
        .from('case-attachments')
        .getPublicUrl(uploadData.path)
      fileUrl = urlData.publicUrl
    }

    // 2. Call RPC attach_case_document_file or fallback update
    const { error: rpcError } = await supabase.rpc('attach_case_document_file', {
      p_case_document_id: caseDocumentId,
      p_file_url: fileUrl,
      p_file_name: file.name,
      p_file_size: file.size,
      p_file_type: file.type,
    })

    if (rpcError) {
      // Fallback direct update if RPC is missing
      const { error: updateError } = await supabase
        .from('case_documents')
        .update({
          file_url: fileUrl,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          updated_at: new Date().toISOString(),
        })
        .eq('id', caseDocumentId)

      if (updateError) {
        return { success: false, error: updateError.message || 'Failed to attach file to document.' }
      }
    }

    // 3. Optional: Mark document as received if requested and not yet received
    if (markAsReceived) {
      await supabase.rpc('receive_document', {
        p_case_document_id: caseDocumentId,
      })
    }

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/cases')
    revalidatePath('/pending')

    return {
      success: true,
      data: {
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
      },
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'An unexpected error occurred during document upload.'),
    }
  }
}

/**
 * Removes the digital attachment from a case document.
 */
export async function removeDocumentAttachmentAction(
  caseDocumentId: string,
  caseId: string
): Promise<CaseActionState> {
  try {
    await assertAuth()

    const supabase = await createClient()
    const { error: rpcError } = await supabase.rpc('remove_case_document_file', {
      p_case_document_id: caseDocumentId,
    })

    if (rpcError) {
      await supabase
        .from('case_documents')
        .update({
          file_url: null,
          file_name: null,
          file_size: null,
          file_type: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', caseDocumentId)
    }

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/cases')
    revalidatePath('/pending')

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'Failed to remove attachment.'),
    }
  }
}
