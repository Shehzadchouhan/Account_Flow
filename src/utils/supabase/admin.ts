import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client using the SUPABASE_SERVICE_ROLE_KEY.
 * Returns null if the service role key is not configured in the environment.
 * Bypasses Row Level Security and rate limits for admin operations (like creating users).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
