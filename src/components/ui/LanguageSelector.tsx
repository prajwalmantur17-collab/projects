import { ChevronDown, Globe } from 'lucide-react'
import { useI18n } from '../../i18n'
import type { Language } from '../../types'
import { LANGUAGES, LANGUAGE_NATIVE_NAMES } from '../../i18n'
import { useAuth } from '../../auth/AuthProvider'
import { refreshLanguagePreference } from '../../auth/languagePreference'

export function LanguageSelector({
  className = '',
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const { language, setLanguage, t } = useI18n()
  const { profile, refreshProfile } = useAuth()

  const onChange = (next: Language) => {
    setLanguage(next)
    if (profile && profile.preferred_language !== next) {
      void refreshLanguagePreference(profile.id, next, refreshProfile)
    }
  }

  if (compact) {
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <label htmlFor="language-compact" className="sr-only">
          {t('a11y.language')}
        </label>
        <Globe className="pointer-events-none absolute left-3 size-4 text-gray-600" aria-hidden="true" />
        <select
          id="language-compact"
          value={language}
          onChange={(event) => onChange(event.target.value as Language)}
          className="h-10 cursor-pointer appearance-none rounded-full border border-white/60 bg-white/85 py-1.5 pl-8.5 pr-7 text-xs font-bold text-gray-800 shadow-xs backdrop-blur-md hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label={t('a11y.language')}
        >
          {LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {LANGUAGE_NATIVE_NAMES[code]}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-gray-500" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className={className}>
      <label htmlFor="language" className="sr-only">
        {t('a11y.language')}
      </label>
      <select
        id="language"
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
        className="min-h-11 rounded-xl border-2 border-cream-300 bg-white px-3 py-2 text-base font-semibold text-ink hover:border-leaf-300"
        aria-label={t('a11y.language')}
      >
        {LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_NATIVE_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
  )
}
