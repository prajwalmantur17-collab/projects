import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { env, getEnvIssue } from './env'

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/**
 * The Supabase client is intentionally untyped at the client level.
 * Each service in src/services declares the expected row shape with
 * `.returns<T>()`, which keeps database access typed at the boundary.
 * You can replace this with generated types via:
 *   supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * Only the public anon key is used here. The service-role key must never
 * be shipped to the browser.
 */
export const supabase: SupabaseClient | null = env.isConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'harvest-rentals-auth',
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new ConfigError(getEnvIssue() ?? 'Supabase is not configured.')
  }
  return supabase
}


