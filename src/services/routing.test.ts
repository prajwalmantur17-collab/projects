import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearRouteCache,
  distanceMeters,
  getRoadRoute,
  shouldRefetchRoute,
} from './routing'
import type { Coordinates } from '../types'

describe('routing service', () => {
  const p1: Coordinates = { latitude: 12.9716, longitude: 77.5946 }
  const p2: Coordinates = { latitude: 12.9800, longitude: 77.6000 }

  beforeEach(() => {
    clearRouteCache()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calculates distanceMeters correctly between two coordinates', () => {
    const dist = distanceMeters(p1, p2)
    expect(dist).toBeGreaterThan(1000)
    expect(dist).toBeLessThan(1500)
  })

  it('respects movement threshold and request gap in shouldRefetchRoute', () => {
    const now = 100_000
    // First request should always be true
    expect(shouldRefetchRoute(null, p1, p2, now)).toBe(true)

    // Second request immediately after (< 15s) with no movement should be false
    const state = { from: p1, to: p2, at: now }
    expect(shouldRefetchRoute(state, p1, p2, now + 5000)).toBe(false)

    // Request after 16s with no movement (< 100m) should be false
    expect(shouldRefetchRoute(state, p1, p2, now + 16_000)).toBe(false)

    // Request after 16s with movement > 100m should be true
    const pMoved: Coordinates = { latitude: 12.9750, longitude: 77.5950 } // ~380m away
    expect(shouldRefetchRoute(state, pMoved, p2, now + 16_000)).toBe(true)
  })

  it('fetches route from OSRM and reuses cached route on repeated coordinates', async () => {
    let osrmCalls = 0
    const mockFetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input.toString()
      if (urlStr.includes('openrouteservice')) {
        return Promise.resolve({ ok: false, status: 401 })
      }
      osrmCalls++
      return Promise.resolve({
        ok: true,
        json: async () => ({
          routes: [
            {
              geometry: {
                coordinates: [
                  [77.5946, 12.9716],
                  [77.6000, 12.9800],
                ],
              },
              distance: 1250,
              duration: 180,
            },
          ],
        }),
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const route1 = await getRoadRoute(p1, p2)
    expect(route1).not.toBeNull()
    expect(route1?.source).toBe('osrm')
    expect(route1?.distanceMeters).toBe(1250)
    expect(osrmCalls).toBe(1)

    // Call again with same coordinates -> should hit cache without calling OSRM again
    const route2 = await getRoadRoute(p1, p2)
    expect(route2).toEqual(route1)
    expect(osrmCalls).toBe(1)

    // Call with tiny GPS jitter (~10 meters) -> rounded coordinates should hit cache
    const p1Jitter: Coordinates = { latitude: 12.97161, longitude: 77.59461 }
    const route3 = await getRoadRoute(p1Jitter, p2)
    expect(route3).toEqual(route1)
    expect(osrmCalls).toBe(1)
  })

  it('handles cancellation via AbortSignal without throwing', async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await getRoadRoute(p1, p2, controller.signal)
    expect(result).toBeNull()
  })

  it('falls back to null gracefully on network failure or timeout', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network down'))
    vi.stubGlobal('fetch', mockFetch)

    const result = await getRoadRoute(p1, p2)
    expect(result).toBeNull()
  })
})
