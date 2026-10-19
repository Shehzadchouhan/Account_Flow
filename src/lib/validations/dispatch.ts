import { z } from 'zod'

export const createDispatchSchema = z.object({
  case_id: z.string().uuid({ message: 'Invalid case identifier' }),
  recipient: z
    .string()
    .trim()
    .min(1, { message: 'Recipient is required' })
    .max(200, { message: 'Recipient name cannot exceed 200 characters' }),
  case_document_ids: z
    .array(z.string().uuid({ message: 'Invalid document identifier' }))
    .min(1, { message: 'At least one document must be selected for dispatch' }),
  sent_at: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  email_reference: z
    .string()
    .trim()
    .max(300, { message: 'Email reference cannot exceed 300 characters' })
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  idempotency_key: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
})

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>

export const voidDispatchSchema = z.object({
  dispatch_id: z.string().uuid({ message: 'Invalid dispatch identifier' }),
  case_id: z.string().uuid({ message: 'Invalid case identifier' }).optional(),
  reason: z
    .string()
    .trim()
    .min(5, { message: 'Void reason must be at least 5 characters explaining why the dispatch is voided' })
    .max(500, { message: 'Reason cannot exceed 500 characters' }),
})

export type VoidDispatchInput = z.infer<typeof voidDispatchSchema>
