import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { localMatches, searchPlaces } from '../services/placeSearch'
import type { PlaceSuggestion } from '../services/placeSearch'
import type { Coordinates } from '../types'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

/**
 * Live place suggestions for a text box. Shows instant local suggestions immediately,
 * debounces remote lookups, cancels outdated requests, and avoids layout jumps.
 */
export function usePlaceSuggestions(query: string, enabled: boolean, near?: Coordinates | null) {
  const { language } = useI18n()
  const q = query.trim()
  const active = enabled && q.length >= MIN_CHARS
  const lat = near?.latitude
  const lon = near?.longitude
  const key = `${language}|${q}|${lat ?? ''},${lon ?? ''}`

  const [result, setResult] = useState<{ key: string; items: PlaceSuggestion[] }>(() => {
    return { key: '', items: [] }
  })
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!active) {
      setLoading(false)
      return
    }

    const currentRequestId = ++requestIdRef.current

    // 1. Immediately show local matches so user sees instant feedback while remote request runs
    const instantLocal = localMatches(q, language)
    if (instantLocal.length > 0) {
      setResult({ key, items: instantLocal })
    }
    setLoading(true)

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchPlaces(
        q,
        language,
        controller.signal,
        lat !== undefined && lon !== undefined ? { latitude: lat, longitude: lon } : null,
      )
        .then((items) => {
          if (currentRequestId === requestIdRef.current && !controller.signal.aborted) {
            setResult({ key, items })
            setLoading(false)
          }
        })
        .catch(() => {
          if (currentRequestId === requestIdRef.current && !controller.signal.aborted) {
            // Keep local matches if remote failed, don't clear them completely
            if (instantLocal.length === 0) {
              setResult({ key, items: [] })
            }
            setLoading(false)
          }
        })
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [active, q, language, key, lat, lon])

  return {
    suggestions: active ? result.items : [],
    loading: active && loading,
  }
}
