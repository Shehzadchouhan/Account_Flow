'use server'

import { assertAdmin } from '@/utils/auth'
import { createClient } from '@/utils/supabase/server'
import { parseImportFile, type ImportPreviewResult, type ParsedRowPreview } from '@/lib/import-parser'

export interface ParseResultResponse {
  success: boolean
  error?: string
  data?: ImportPreviewResult
}

export interface ConfirmImportResponse {
  success: boolean
  error?: string
  importedCount?: number
  skippedCount?: number
  createdDocTypes?: number
}

/**
 * Server action: Parses uploaded .xlsx/.csv file and generates pre-validation preview.
 * Strictly read-only: does not insert or modify database records.
 */
export async function parseImportAction(formData: FormData): Promise<ParseResultResponse> {
  try {
    // 1. Admin authorization check
    await assertAdmin()

    const file = formData.get('file') as File | null
    if (!file) {
      return { success: false, error: 'Please select a file to upload.' }
    }

    // 2. Size guard (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'File size exceeds maximum allowable limit of 5 MB.' }
    }

    const fileName = file.name || 'upload.xlsx'
    const lowerName = fileName.toLowerCase()
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.csv')) {
      return { success: false, error: 'Unsupported file type. Only .xlsx and .csv files are supported.' }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 3. Fetch reference metadata for validations
    const supabase = await createClient()

    const [firmsRes, staffRes, docTypesRes] = await Promise.all([
      supabase.from('firms').select('name'),
      supabase.from('profiles').select('id, email').eq('is_active', true),
      supabase.from('document_types').select('name'),
    ])

    const existingFirmsLower = new Set(
      (firmsRes.data || []).map((f) => f.name.trim().toLowerCase())
    )

    const activeEmployeesEmailMap = new Map<string, string>()
    ;(staffRes.data || []).forEach((p) => {
      if (p.email) {
        activeEmployeesEmailMap.set(p.email.trim().toLowerCase(), p.id)
      }
    })

    const knownDocTypesLower = new Set(
      (docTypesRes.data || []).map((dt) => dt.name.trim().toLowerCase())
    )

    // 4. Parse workbook
    const previewResult = await parseImportFile(
      buffer,
      fileName,
      existingFirmsLower,
      activeEmployeesEmailMap,
      knownDocTypesLower
    )

    return {
      success: true,
      data: previewResult,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to parse import file.'
    return { success: false, error: message }
  }
}

/**
 * Server action: Executes atomic batch insert for valid firm records in ONE transaction.
 * Calls public.import_firms_batch RPC function.
 */
export async function confirmImportAction(
  rows: ParsedRowPreview[],
  createMissingDocTypes: boolean
): Promise<ConfirmImportResponse> {
  try {
    await assertAdmin()

    if (!rows || rows.length === 0) {
      return { success: false, error: 'No valid rows to import.' }
    }

    // Filter to only rows eligible for import
    const eligibleRows = rows.filter((r) => {
      if (r.status === 'Valid') return true
      // If admin agreed to create unknown document types, rows whose ONLY issue was unknown doc types become eligible
      if (
        createMissingDocTypes &&
        r.status === 'Unknown document type' &&
        r.reasons.every((msg) => msg.startsWith('Unknown document types:'))
      ) {
        return true
      }
      return false
    })

    if (eligibleRows.length === 0) {
      return { success: false, error: 'No eligible valid rows available for import.' }
    }

    const payload = eligibleRows.map((r) => ({
      firm_name: r.firm_name,
      contact_person: r.contact_person,
      contact_email: r.contact_email,
      contact_phone: r.contact_phone,
      employee_email: r.employee_email,
      required_documents: r.required_documents,
      optional_documents: r.optional_documents,
    }))

    const supabase = await createClient()

    const { data: resultRaw, error: rpcError } = await supabase.rpc(
      'import_firms_batch',
      {
        p_rows: payload,
        p_create_missing_doc_types: createMissingDocTypes,
      }
    )

    if (rpcError) {
      console.error('import_firms_batch RPC error:', rpcError)
      return { success: false, error: rpcError.message }
    }

    const res = resultRaw as {
      success: boolean
      imported_count: number
      skipped_count: number
      created_doc_types: number
    }

    return {
      success: true,
      importedCount: res.imported_count,
      skippedCount: res.skipped_count,
      createdDocTypes: res.created_doc_types,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Import confirmation failed.'
    return { success: false, error: message }
  }
}
