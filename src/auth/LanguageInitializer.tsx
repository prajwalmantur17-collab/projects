import { hasStoredLanguage, useI18n } from '../i18n'
import { useAuth } from '../auth/AuthProvider'
import { useEffect, useRef } from 'react'

/** Applies the language saved on the user's profile once per sign-in. */
export function LanguageInitializer() {
  const { profile } = useAuth()
  const { setLanguage } = useI18n()
  const appliedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!profile) {
      appliedFor.current = null
      return
    }
    if (appliedFor.current === profile.id) return
    appliedFor.current = profile.id
    if (!hasStoredLanguage()) {
      setLanguage(profile.preferred_language)
    }
  }, [profile, setLanguage])

  return null
}
