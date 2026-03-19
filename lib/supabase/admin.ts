import { createClient } from "@supabase/supabase-js"

import { getSupabaseAdminConfig } from "@/lib/env"

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig()

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
