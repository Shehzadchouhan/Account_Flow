import { z } from 'zod'

export const documentTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Document type name must be at least 2 characters long' })
    .max(150, { message: 'Document type name must not exceed 150 characters' }),
  description: z
    .string()
    .trim()
    .max(500, { message: 'Description must not exceed 500 characters' })
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  is_active: z.boolean().default(true),
})

export type DocumentTypeInput = z.infer<typeof documentTypeSchema>
