import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationKey } from '../i18n'
import type { Coordinates } from '../types'

export interface GeoFix extends Coordinates {
  /** Horizontal accuracy radius in metres (smaller is better). */
  accuracy: number
}

interface GeoState {
  coordinates: Coordinates | null
  accuracy: number | null
  loading: boolean
  error: TranslationKey | null
}

/** Stop waiting as soon as a fix is this precise. */
export const GOOD_ACCURACY_M = 50
/** Return early without waiting for high precision if an acceptable fix is found. */
export const USABLE_ACCURACY_M = 200
/** Above this the position is too coarse to trust for searching. */
export const POOR_ACCURACY_M = 1500

/** Max age of a cached GPS fix in memory (1 minute). */
const CACHE_VALID_MS = 60_000
/** Fast-return timer: if we already have a usable fix after this time, don't keep user waiting. */
const FAST_RETURN_MS = 2500
/** Hard timeout for GPS fix. */
const MAX_WAIT_MS = 5000

let lastKnownFix: { fix: GeoFix; timestamp: number } | null = null

export function clearGeolocationCache(): void {
  lastKnownFix = null
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    coordinates: null,
    accuracy: null,
    loading: false,
    error: null,
  })
  const mounted = useRef(true)
  const activeWatchId = useRef<number | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (activeWatchId.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(activeWatchId.current)
        activeWatchId.current = null
      }
    }
  }, [])

  /**
   * Gets a GPS fix. Reuses a recent cached fix (< 60s, <= 200m) immediately.
   * Otherwise listens with a fast-return deadline so users are never stuck waiting.
   */
  const request = useCallback((): Promise<GeoFix | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ coordinates: null, accuracy: null, loading: false, error: 'farmer.locationUnsupported' })
      return Promise.resolve(null)
    }

    // 1. Fast path: return recent accurate cached fix immediately
    const now = Date.now()
    if (lastKnownFix && now - lastKnownFix.timestamp < CACHE_VALID_MS && lastKnownFix.fix.accuracy <= USABLE_ACCURACY_M) {
      const cached = lastKnownFix.fix
      setState({
        coordinates: { latitude: cached.latitude, longitude: cached.longitude },
        accuracy: cached.accuracy,
        loading: false,
        error: null,
      })
      return Promise.resolve(cached)
    }

    setState({ coordinates: null, accuracy: null, loading: true, error: null })

    return new Promise((resolve) => {
      let best: GeoFix | null = null
      let finished = false
      let watchId: number | null = null
      let fastTimer: number | null = null
      let hardTimer: number | null = null

      const cleanup = () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId)
          if (activeWatchId.current === watchId) activeWatchId.current = null
        }
        if (fastTimer !== null) window.clearTimeout(fastTimer)
        if (hardTimer !== null) window.clearTimeout(hardTimer)
      }

      const finish = (result: GeoFix | null, errorKey: TranslationKey | null) => {
        if (finished) return
        finished = true
        cleanup()

        if (result) {
          lastKnownFix = { fix: result, timestamp: Date.now() }
        }

        if (mounted.current) {
          setState(
            result
              ? {
                  coordinates: { latitude: result.latitude, longitude: result.longitude },
                  accuracy: result.accuracy,
                  loading: false,
                  error: null,
                }
              : { coordinates: null, accuracy: null, loading: false, error: errorKey ?? 'farmer.locationDenied' },
          )
        }
        resolve(result)
      }

      try {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const fix: GeoFix = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : Infinity,
            }
            if (!best || fix.accuracy < best.accuracy) best = fix

            // If we hit high accuracy immediately, finish without waiting
            if (best.accuracy <= GOOD_ACCURACY_M) {
              finish(best, null)
            }
          },
          () => {
            if (best) {
              finish(best, null)
              return
            }
            finish(null, 'farmer.locationDenied')
          },
          { enableHighAccuracy: true, timeout: MAX_WAIT_MS, maximumAge: 30_000 },
        )
        activeWatchId.current = watchId
      } catch {
        finish(null, 'farmer.locationUnsupported')
        return
      }

      // Fast-return timer: If we got any usable fix within 2.5s, resolve now so UI moves forward
      fastTimer = window.setTimeout(() => {
        if (best && best.accuracy <= USABLE_ACCURACY_M) {
          finish(best, null)
        }
      }, FAST_RETURN_MS)

      // Hard max wait
      hardTimer = window.setTimeout(() => {
        if (best) {
          finish(best, null)
        } else {
          finish(null, 'farmer.locationDenied')
        }
      }, MAX_WAIT_MS)
    })
  }, [])

  const clear = useCallback(() => {
    if (activeWatchId.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(activeWatchId.current)
      activeWatchId.current = null
    }
    setState({ coordinates: null, accuracy: null, loading: false, error: null })
  }, [])

  return { ...state, request, clear }
}
