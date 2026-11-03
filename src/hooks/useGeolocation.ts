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
const GOOD_ACCURACY_M = 50
/** Never wait longer than this for a better fix. */
const MAX_WAIT_MS = 9000
/** Above this the position is too coarse to trust for searching. */
export const POOR_ACCURACY_M = 1500

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    coordinates: null,
    accuracy: null,
    loading: false,
    error: null,
  })
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  /**
   * Gets a fresh GPS fix. It never reuses a cached position (maximumAge 0) and
   * keeps listening for a few seconds so the most accurate reading wins.
   */
  const request = useCallback((): Promise<GeoFix | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ coordinates: null, accuracy: null, loading: false, error: 'farmer.locationUnsupported' })
      return Promise.resolve(null)
    }

    setState({ coordinates: null, accuracy: null, loading: true, error: null })

    return new Promise((resolve) => {
      let best: GeoFix | null = null
      let finished = false
      let watchId: number | null = null
      let timer: number | null = null

      const finish = (result: GeoFix | null, errorKey: TranslationKey | null) => {
        if (finished) return
        finished = true
        if (watchId !== null) navigator.geolocation.clearWatch(watchId)
        if (timer !== null) window.clearTimeout(timer)
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

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const fix: GeoFix = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : Infinity,
          }
          if (!best || fix.accuracy < best.accuracy) best = fix
          if (best.accuracy <= GOOD_ACCURACY_M) finish(best, null)
        },
        (error) => {
          if (best) {
            finish(best, null)
            return
          }
          // Permission denied, unavailable and timeout all show the same "could not get location" message.
          void error
          finish(null, 'farmer.locationDenied')
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      )

      timer = window.setTimeout(() => {
        if (best) finish(best, null)
        else finish(null, 'farmer.locationDenied')
      }, MAX_WAIT_MS)
    })
  }, [])

  const clear = useCallback(() => {
    setState({ coordinates: null, accuracy: null, loading: false, error: null })
  }, [])

  return { ...state, request, clear }
}
