import type { Language } from '../types'

const priceFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `₹${priceFormatter.format(value)}`
}

export function formatAcreage(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)
}

const dateLocales: Record<Language, string> = {
  en: 'en-IN',
  kn: 'kn-IN',
  hi: 'hi-IN',
}

/** Formats a yyyy-mm-dd date without timezone shifts. */
export function formatDate(isoDate: string, language: Language): string {
  const parts = isoDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return isoDate
  const [year, month, day] = parts
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat(dateLocales[language], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function formatDateTime(isoTimestamp: string, language: Language): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) return isoTimestamp
  return new Intl.DateTimeFormat(dateLocales[language], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
