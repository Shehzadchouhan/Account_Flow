import { z } from 'zod'

export const firmSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Firm name must be at least 2 characters long' })
    .max(200, { message: 'Firm name must not exceed 200 characters' }),
  contact_person: z
    .string()
    .trim()
    .max(100, { message: 'Contact person must not exceed 100 characters' })
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  contact_email: z
    .string()
    .trim()
    .max(150, { message: 'Contact email must not exceed 150 characters' })
    .optional()
    .refine((val) => !val || val === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Please provide a valid email address',
    })
    .transform((val) => (val && val.length > 0 ? val : null)),
  contact_phone: z
    .string()
    .trim()
    .max(25, { message: 'Contact phone must not exceed 25 characters' })
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  default_employee: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  is_active: z.boolean().default(true),
})

export type FirmInput = z.infer<typeof firmSchema>
