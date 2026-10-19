import { z } from 'zod'

export const userProfileUpdateSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters long' })
    .max(100, { message: 'Full name must not exceed 100 characters' }),
  role: z.enum(['admin', 'staff'], {
    message: "Role must be either 'admin' or 'staff'",
  }),
  is_active: z.boolean(),
})

export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>
