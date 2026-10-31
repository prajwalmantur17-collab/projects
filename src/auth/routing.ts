import type { Profile } from '../types'

export function homeForProfile(profile: Profile | null): string {
  if (!profile) return '/login'
  if (profile.role === 'farmer') return '/farmer'
  if (profile.role === 'owner') return '/owner'
  return '/select-role'
}
