const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

const looksLikePlaceholder = (value: string) =>
  value === '' ||
  value.includes('your-project-ref') ||
  value.includes('your-anon-public-key') ||
  value.includes('your-supabase')

export const env = {
  supabaseUrl: rawUrl,
  supabaseAnonKey: rawKey,
  isConfigured:
    !looksLikePlaceholder(rawUrl) &&
    !looksLikePlaceholder(rawKey) &&
    /^https?:\/\/.+/.test(rawUrl),
}

export function getEnvIssue(): string | null {
  if (env.isConfigured) return null
  if (!rawUrl && !rawKey) {
    return 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.'
  }
  if (looksLikePlaceholder(rawUrl)) return 'VITE_SUPABASE_URL is missing or still a placeholder.'
  if (looksLikePlaceholder(rawKey)) {
    return 'VITE_SUPABASE_ANON_KEY is missing or still a placeholder.'
  }
  if (!/^https?:\/\/.+/.test(rawUrl)) {
    return 'VITE_SUPABASE_URL must be a valid http(s) URL.'
  }
  return 'Supabase environment variables are invalid.'
}
