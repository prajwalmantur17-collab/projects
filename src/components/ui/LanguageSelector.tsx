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

  return (
    <div className={className}>
      <label htmlFor={compact ? 'language-compact' : 'language'} className={compact ? 'sr-only' : 'sr-only'}>
        {t('a11y.language')}
      </label>
      <select
        id={compact ? 'language-compact' : 'language'}
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
        className={`min-h-11 rounded-xl border-2 border-cream-300 bg-white font-semibold text-ink hover:border-leaf-300 ${
          compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2 text-base'
        }`}
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
