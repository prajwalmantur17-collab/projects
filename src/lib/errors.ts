import type { TranslationKey } from '../i18n/en'

interface ErrorLike {
  message?: string
  code?: string
  details?: string
}

const MESSAGE_CODES: Array<[string, TranslationKey]> = [
  ['HR_DATE_TAKEN', 'booking.error.dateTaken'],
  ['HR_BLACKOUT', 'booking.error.blackout'],
  ['HR_MACHINE_PAUSED', 'booking.error.machinePaused'],
  ['HR_MACHINE_INACTIVE', 'booking.error.paused'],
  ['HR_OWN_MACHINE', 'booking.error.own'],
  ['HR_DUPLICATE_PENDING', 'booking.error.duplicate'],
  ['HR_CROP_NOT_SUPPORTED', 'booking.error.crop'],
  ['HR_PAST_DATE', 'booking.error.past'],
  ['HR_NOT_OWNER', 'booking.error.notOwner'],
  ['HR_INVALID_STATE', 'booking.error.invalidState'],
  ['HR_INVALID_DECISION', 'booking.error.invalidDecision'],
  ['HR_ROLE_NOT_SET', 'booking.error.role'],
  ['HR_ROLE_REQUIRED', 'booking.error.role'],
  ['HR_ROLE_ALREADY_SET', 'booking.error.roleSet'],
  ['HR_LOCATION_REQUIRED', 'booking.error.locationRequired'],
  ['HR_BLACKOUT_CONFLICT', 'machine.dateAddError'],
  ['HR_MACHINE_BUSY', 'booking.error.machineBusy'],
  ['HR_NOT_BUSY', 'booking.error.notBusy'],
  ['HR_NOT_FARMER', 'booking.error.notFarmer'],
  ['HR_NOT_FOUND', 'error.notFound'],
  ['HR_UNAUTHORIZED', 'error.unauthorized'],
]

function asErrorLike(error: unknown): ErrorLike {
  if (typeof error === 'string') return { message: error }
  if (error && typeof error === 'object') {
    const candidate = error as ErrorLike
    return candidate
  }
  return {}
}

export function logError(context: string, error: unknown) {
  if (import.meta.env.DEV) {
    const { message, code, details } = asErrorLike(error)
    console.warn(`[harvest-rentals] ${context}`, { message, code, details })
  }
}

export function mapErrorToKey(
  error: unknown,
  fallback: TranslationKey = 'error.generic',
): TranslationKey {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'error.network'
  }

  const { message = '', code = '', details = '' } = asErrorLike(error)
  const haystack = `${message} ${details}`

  if (/failed to fetch|networkerror|network request failed|load failed/i.test(haystack)) {
    return 'auth.serviceUnavailable'
  }
  if (/invalid login credentials|invalid credentials/i.test(haystack)) {
    return 'auth.invalidCredentials'
  }
  if (/email not confirmed/i.test(haystack)) return 'auth.emailNotConfirmed'
  if (/user already registered|already been registered/i.test(haystack)) {
    return 'auth.emailInUse'
  }
  if (/unable to validate email|invalid email/i.test(haystack)) return 'auth.emailInvalid'
  if (/password should be at least/i.test(haystack)) return 'auth.passwordShort'
  if (/jwt expired|invalid jwt|refresh token|session from session_id claim in jwt does not exist/i.test(haystack)) {
    return 'error.sessionExpired'
  }
  if (code === 'invalid_credentials') return 'auth.invalidCredentials'
  if (code === 'email_not_confirmed') return 'auth.emailNotConfirmed'
  if (code === 'user_already_exists' || code === 'email_exists') return 'auth.emailInUse'
  if (code === 'weak_password') return 'auth.passwordShort'
  if (code === 'same_password') return 'auth.passwordSame'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'auth.emailRateLimit'
  }
  if (code === 'PGRST301' || code === 'PGRST302') return 'error.unauthorized'
  if (code === 'PGRST116') return 'error.notFound'
  if (code === '42501') return 'error.notAllowed'
  if (code === '42P01' || code === 'PGRST202' || code === 'PGRST204') return fallback
  if (code === '23505') {
    if (/bookings_one_confirmed|bookings_machine_date|date/i.test(haystack)) {
      return 'booking.error.dateTaken'
    }
    return fallback
  }
  if (code === '23514') return fallback
  if (code === '429') return 'error.rateLimit'
  if (/^5\d\d$/.test(code)) return 'error.server'

  const direct = MESSAGE_CODES.find(([prefix]) => message.includes(prefix))
  if (direct) return direct[1]

  if (code === '23503') return 'error.notFound'
  return fallback
}

export function isSessionExpiredError(error: unknown): boolean {
  const { message = '', code = '' } = asErrorLike(error)
  return (
    code === 'PGRST301' ||
    /jwt expired|invalid jwt|refresh token/i.test(message)
  )
}
