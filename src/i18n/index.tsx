import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Language } from '../types'
import { en } from './en'
import type { TranslationKey } from './en'
import { kn } from './kn'
import { hi } from './hi'
import { ta } from './ta'

export const LANGUAGES: Language[] = ['en', 'kn', 'hi', 'ta']

export const LANGUAGE_NATIVE_NAMES: Record<Language, string> = {
  en: 'English',
  kn: 'ಕನ್ನಡ',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
}

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, kn, hi, ta }

const LOCALES: Record<Language, string> = {
  en: 'en-IN',
  kn: 'kn-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
}

const STORAGE_KEY = 'harvest-rentals-language'

export type TranslationParams = Record<string, string | number>

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as string[]).includes(value)
}

function readStoredLanguage(): Language | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isLanguage(stored) ? stored : null
  } catch {
    return null
  }
}

export function storeLanguage(language: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Storage can be unavailable in private modes. The app still works for this session.
  }
}

export function hasStoredLanguage(): boolean {
  return readStoredLanguage() !== null
}

export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const template = dictionaries[language][key] ?? en[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export function getLocale(language: Language): string {
  return LOCALES[language]
}

interface I18nContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey, params?: TranslationParams) => string
  locale: string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage() ?? 'en')

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    storeLanguage(next)
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(language, key, params),
    [language],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t, locale: getLocale(language) }),
    [language, setLanguage, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }
  return context
}

export type { TranslationKey }
