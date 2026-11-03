import { describe, expect, it, beforeEach } from 'vitest'
import {
  calculateEstimatedTotal,
  clearHiddenBookingsForUser,
  getHiddenBookingIds,
  hideBookingLocally,
  hideMultipleBookingsLocally,
} from './bookings'

describe('calculateEstimatedTotal', () => {
  it('calculates total for per_acre pricing', () => {
    const res = calculateEstimatedTotal(1200, 'per_acre', 3.5)
    expect(res.isPerAcre).toBe(true)
    expect(res.total).toBe(4200)
    expect(res.unitLabelKey).toBe('common.perAcre')
  })

  it('defaults to per_acre when pricing_unit is undefined', () => {
    const res = calculateEstimatedTotal(1000, undefined, 2)
    expect(res.isPerAcre).toBe(true)
    expect(res.total).toBe(2000)
    expect(res.unitLabelKey).toBe('common.perAcre')
  })

  it('returns null total for per_hour with unitLabelKey common.perHour without multiplying by acres', () => {
    const res = calculateEstimatedTotal(800, 'per_hour', 5)
    expect(res.isPerAcre).toBe(false)
    expect(res.total).toBeNull()
    expect(res.unitLabelKey).toBe('common.perHour')
  })

  it('returns null total for per_day with unitLabelKey common.perDay without multiplying by acres', () => {
    const res = calculateEstimatedTotal(5000, 'per_day', 3)
    expect(res.isPerAcre).toBe(false)
    expect(res.total).toBeNull()
    expect(res.unitLabelKey).toBe('common.perDay')
  })

  it('returns null total when acreage is 0 or null for per_acre', () => {
    const zero = calculateEstimatedTotal(1000, 'per_acre', 0)
    expect(zero.total).toBeNull()

    const none = calculateEstimatedTotal(1000, 'per_acre', null)
    expect(none.total).toBeNull()
  })
})

describe('user-scoped hidden bookings in localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('isolates hidden bookings per user ID', () => {
    hideBookingLocally('booking-1', 'user-farmer')
    hideBookingLocally('booking-2', 'user-owner')

    const farmerHidden = getHiddenBookingIds('user-farmer')
    const ownerHidden = getHiddenBookingIds('user-owner')

    expect(farmerHidden.has('booking-1')).toBe(true)
    expect(farmerHidden.has('booking-2')).toBe(false)

    expect(ownerHidden.has('booking-2')).toBe(true)
    expect(ownerHidden.has('booking-1')).toBe(false)
  })

  it('hides multiple bookings and clears on user logout', () => {
    hideMultipleBookingsLocally(['b-10', 'b-11'], 'user-farmer')
    expect(getHiddenBookingIds('user-farmer').has('b-10')).toBe(true)
    expect(getHiddenBookingIds('user-farmer').has('b-11')).toBe(true)

    clearHiddenBookingsForUser('user-farmer')
    expect(getHiddenBookingIds('user-farmer').size).toBe(0)
  })

  it('clears all user hidden booking stores when no specific user ID is passed', () => {
    hideBookingLocally('b-1', 'user-a')
    hideBookingLocally('b-2', 'user-b')

    clearHiddenBookingsForUser()
    expect(getHiddenBookingIds('user-a').size).toBe(0)
    expect(getHiddenBookingIds('user-b').size).toBe(0)
  })
})
