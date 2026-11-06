import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGeolocation, clearGeolocationCache } from './useGeolocation'

describe('useGeolocation hook', () => {
  beforeEach(() => {
    clearGeolocationCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('handles unsupported geolocation gracefully', async () => {
    const originalGeo = navigator.geolocation
    // @ts-expect-error Mocking missing geolocation
    delete navigator.geolocation

    const { result } = renderHook(() => useGeolocation())
    let fix = null
    await act(async () => {
      fix = await result.current.request()
    })

    expect(fix).toBeNull()
    expect(result.current.error).toBe('farmer.locationUnsupported')

    // Restore
    Object.defineProperty(navigator, 'geolocation', { value: originalGeo, configurable: true })
  })

  it('handles permission denied gracefully', async () => {
    const mockWatch = vi.fn().mockImplementation((_success, error) => {
      error({ code: 1, message: 'User denied Geolocation' })
      return 123
    })
    const mockGetCurrent = vi.fn().mockImplementation((_success, error) => {
      error({ code: 1, message: 'User denied Geolocation' })
    })
    const mockClear = vi.fn()

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrent, watchPosition: mockWatch, clearWatch: mockClear },
      configurable: true,
    })

    const { result } = renderHook(() => useGeolocation())
    let fix = null
    await act(async () => {
      fix = await result.current.request()
    })

    expect(fix).toBeNull()
    expect(result.current.error).toBe('farmer.locationDenied')
  })

  it('resolves immediately with cached location when recent and accurate', async () => {
    let watchCallback: ((pos: GeolocationPosition) => void) | null = null
    const mockWatch = vi.fn().mockImplementation((success) => {
      watchCallback = success
      return 1
    })
    const mockGetCurrent = vi.fn()
    const mockClear = vi.fn()

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrent, watchPosition: mockWatch, clearWatch: mockClear },
      configurable: true,
    })

    const { result } = renderHook(() => useGeolocation())

    // First request
    let firstPromise: Promise<unknown>
    act(() => {
      firstPromise = result.current.request()
    })

    // Simulate watch callback with high accuracy
    act(() => {
      watchCallback?.({
        coords: {
          latitude: 13.1067,
          longitude: 77.6174,
          accuracy: 25,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      })
    })

    const fix1 = await firstPromise!
    expect(fix1).toEqual({ latitude: 13.1067, longitude: 77.6174, accuracy: 25 })

    // Second request within cache window
    let fix2 = null
    await act(async () => {
      fix2 = await result.current.request()
    })

    expect(fix2).toEqual({ latitude: 13.1067, longitude: 77.6174, accuracy: 25 })
    // Only 1 watchPosition was called because cache fulfilled second request
    expect(mockWatch).toHaveBeenCalledTimes(1)
  })
})
