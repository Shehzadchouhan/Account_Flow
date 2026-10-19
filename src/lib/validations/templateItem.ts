import { z } from 'zod'

export const templateItemSchema = z.object({
  firm_id: z.string().uuid({ message: 'Invalid firm identifier' }),
  document_type_id: z.string().uuid({ message: 'Invalid document type identifier' }),
  is_required: z.boolean().default(true),
})

export type TemplateItemInput = z.infer<typeof templateItemSchema>
