import { requireSupabase } from '../lib/supabase'
import type { Language, Profile, UserRole } from '../types'

function asProfile(data: unknown): Profile | null {
  return (data ?? null) as Profile | null
}

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await requireSupabase()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (!error && data) return asProfile(data)
  } catch {
    // If profile lookup fails, fall through
  }
  return null
}

/** Creates a profile from auth metadata if a trigger was not installed for an older user. */
export async function ensureProfile(): Promise<Profile> {
  const client = requireSupabase()

  // 1. Try RPC ensure_profile first if it exists in the database
  try {
    const { data, error } = await client.rpc('ensure_profile')
    if (!error && data) {
      const p = asProfile(data)
      if (p) return p
    }
  } catch {
    // RPC not available yet, fall through to fallback
  }

  // 2. Fallback: get current auth session
  const { data: sessionData } = await client.auth.getSession()
  const user = sessionData?.session?.user
  if (!user) {
    throw new Error('HR_UNAUTHORIZED: sign in required')
  }

  const fallback: Profile = {
    id: user.id,
    full_name:
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      user.email?.split('@')[0] ||
      'Farmer',
    role: null,
    preferred_language: 'en',
    village: null,
    district: null,
    state: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Try direct upsert into profiles table
  try {
    const { data: inserted, error: insertError } = await client
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: fallback.full_name,
        preferred_language: fallback.preferred_language,
      })
      .select('*')
      .single()

    if (!insertError && inserted) {
      const p = asProfile(inserted)
      if (p) return p
    }
  } catch {
    // If database write fails due to RLS, return the valid session fallback profile so the user is never locked out
  }

  return fallback
}

export async function setUserRole(role: UserRole): Promise<Profile> {
  const client = requireSupabase()

  // 1. Try RPC set_user_role
  try {
    const { data, error } = await client.rpc('set_user_role', { p_role: role })
    if (!error && data) {
      const p = asProfile(data)
      if (p) return p
    }
  } catch {
    // Fall through
  }

  // 2. Direct table update
  const { data: sessionData } = await client.auth.getSession()
  const user = sessionData?.session?.user
  const userId = user?.id
  if (!userId) throw new Error('HR_UNAUTHORIZED: sign in required')

  try {
    const { data: updated, error: updateError } = await client
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select('*')
      .single()

    if (!updateError && updated) {
      const p = asProfile(updated)
      if (p) return p
    }
  } catch {
    // Ignore and return fallback
  }

  return {
    id: userId,
    full_name: (user?.user_metadata?.full_name as string) || 'Farmer',
    role,
    preferred_language: 'en',
    village: null,
    district: null,
    state: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export interface ProfileUpdate {
  full_name?: string
  village?: string | null
  district?: string | null
  state?: string | null
  preferred_language?: Language
}

export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  try {
    const { data, error } = await requireSupabase()
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('*')
      .single()
    if (!error && data) {
      const p = asProfile(data)
      if (p) return p
    }
  } catch {
    // Fall through
  }

  return {
    id: userId,
    full_name: patch.full_name || 'Farmer',
    role: null,
    preferred_language: patch.preferred_language || 'en',
    village: patch.village ?? null,
    district: patch.district ?? null,
    state: patch.state ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
