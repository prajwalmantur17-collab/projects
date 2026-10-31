import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationKey } from '../i18n'
import type { Coordinates } from '../types'

interface GeoState {
  coordinates: Coordinates | null
  loading: boolean
  error: TranslationKey | null
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    coordinates: null,
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

  const request = useCallback((): Promise<Coordinates | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ coordinates: null, loading: false, error: 'farmer.locationUnsupported' })
      return Promise.resolve(null)
    }

    setState((previous) => ({ ...previous, loading: true, error: null }))

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }
          if (mounted.current) {
            setState({ coordinates, loading: false, error: null })
          }
          resolve(coordinates)
        },
        () => {
          if (mounted.current) {
            setState({
              coordinates: null,
              loading: false,
              error: 'farmer.locationDenied',
            })
          }
          resolve(null)
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      )
    })
  }, [])

  const clear = useCallback(() => {
    setState({ coordinates: null, loading: false, error: null })
  }, [])

  return { ...state, request, clear }
}
