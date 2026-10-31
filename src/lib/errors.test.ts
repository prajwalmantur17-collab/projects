import { describe, expect, it, vi } from 'vitest'
import { isSessionExpiredError, mapErrorToKey } from './errors'

describe('mapErrorToKey', () => {
  it('maps database hint codes from booking RPCs', () => {
    expect(mapErrorToKey({ message: 'HR_DATE_TAKEN: already booked' })).toBe(
      'booking.error.dateTaken',
    )
    expect(mapErrorToKey({ message: 'HR_BLACKOUT' })).toBe('booking.error.blackout')
    expect(mapErrorToKey({ message: 'HR_DUPLICATE_PENDING' })).toBe('booking.error.duplicate')
    expect(mapErrorToKey({ message: 'HR_ROLE_ALREADY_SET' })).toBe('booking.error.roleSet')
  })

  it('maps network and session failures', () => {
    expect(mapErrorToKey(new TypeError('Failed to fetch'))).toBe('auth.serviceUnavailable')
    expect(mapErrorToKey({ message: 'JWT expired' })).toBe('error.sessionExpired')
    expect(mapErrorToKey({ code: 'PGRST301' })).toBe('error.unauthorized')
  })

  it('reports offline only when the browser is offline', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(mapErrorToKey(new TypeError('Failed to fetch'))).toBe('error.network')
    spy.mockRestore()
  })

  it('maps duplicate booking constraints to a date conflict', () => {
    expect(
      mapErrorToKey({
        code: '23505',
        message: 'duplicate key value violates unique constraint bookings_one_confirmed_per_date',
      }),
    ).toBe('booking.error.dateTaken')
  })

  it('falls back for unknown and server errors', () => {
    expect(mapErrorToKey({ message: 'boom' }, 'machine.saveError')).toBe('machine.saveError')
    expect(mapErrorToKey({ code: '500' })).toBe('error.server')
  })

  it('detects expired sessions', () => {
    expect(isSessionExpiredError({ code: 'PGRST301' })).toBe(true)
    expect(isSessionExpiredError(new Error('nothing'))).toBe(false)
  })
})
