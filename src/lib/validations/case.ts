import { z } from 'zod'

export const generateCasesSchema = z.object({
  month: z
    .string()
    .trim()
    .refine((val) => /^\d{4}-\d{2}(-\d{2})?$/.test(val), {
      message: 'Invalid month format (expected YYYY-MM or YYYY-MM-01)',
    })
    .transform((val) => {
      // Coerce to YYYY-MM-01
      const parts = val.split('-')
      return `${parts[0]}-${parts[1]}-01`
    }),
  cycle: z.enum(['A_11th', 'B_20th'], {
    message: 'Cycle must be either A_11th (Cycle A) or B_20th (Cycle B)',
  }),
  due_date: z
    .string()
    .trim()
    .refine((val) => /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: 'Invalid due date format (expected YYYY-MM-DD)',
    }),
  dry_run: z.boolean().default(true),
})

export type GenerateCasesInput = z.infer<typeof generateCasesSchema>

export const updateCaseDetailsSchema = z.object({
  case_id: z.string().uuid({ message: 'Invalid case identifier' }),
  due_date: z
    .string()
    .trim()
    .refine((val) => /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: 'Invalid due date format (expected YYYY-MM-DD)',
    }),
  assigned_to: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  version: z.coerce.number().int().min(1, { message: 'Invalid version number' }),
})

export type UpdateCaseDetailsInput = z.infer<typeof updateCaseDetailsSchema>

export const addCaseDocumentSchema = z.object({
  case_id: z.string().uuid({ message: 'Invalid case identifier' }),
  document_type_id: z.string().uuid({ message: 'Invalid document type identifier' }),
  is_required: z.boolean().default(true),
})

export type AddCaseDocumentInput = z.infer<typeof addCaseDocumentSchema>

export const updateDocumentNotesSchema = z.object({
  case_document_id: z.string().uuid({ message: 'Invalid document identifier' }),
  notes: z
    .string()
    .trim()
    .max(1000, { message: 'Notes cannot exceed 1000 characters' })
    .default(''),
})

export type UpdateDocumentNotesInput = z.infer<typeof updateDocumentNotesSchema>
