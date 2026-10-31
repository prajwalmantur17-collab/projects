import type { FieldErrors } from './validation'

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}

export function firstError(errors: FieldErrors): string | null {
  const keys = Object.keys(errors)
  return keys.length > 0 ? keys[0] : null
}
