import { logError } from '../lib/errors'
import { updateProfile } from '../services/profiles'
import type { Profile } from '../types'
import type { Language } from '../types'

export async function refreshLanguagePreference(
  userId: string,
  language: Language,
  refreshProfile: () => Promise<Profile | null>,
): Promise<void> {
  try {
    await updateProfile(userId, { preferred_language: language })
    await refreshProfile()
  } catch (caught) {
    logError('languagePreference.save', caught)
  }
}
