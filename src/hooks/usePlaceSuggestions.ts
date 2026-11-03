import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { searchPlaces } from '../services/placeSearch'
import type { PlaceSuggestion } from '../services/placeSearch'
import type { Coordinates } from '../types'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

/**
 * Live place suggestions for a text box. Waits for a short pause in typing,
 * cancels outdated requests, and keeps the previous list on screen while the
 * next one loads so the dropdown does not flicker.
 */
export function usePlaceSuggestions(query: string, enabled: boolean, near?: Coordinates | null) {
  const { language } = useI18n()
  const q = query.trim()
  const active = enabled && q.length >= MIN_CHARS
  const lat = near?.latitude
  const lon = near?.longitude
  const key = `${language}|${q}|${lat ?? ''},${lon ?? ''}`

  const [result, setResult] = useState<{ key: string; items: PlaceSuggestion[] }>({
    key: '',
    items: [],
  })

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchPlaces(q, language, controller.signal, lat !== undefined && lon !== undefined ? { latitude: lat, longitude: lon } : null)
        .then((items) => {
          if (!controller.signal.aborted) setResult({ key, items })
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ key, items: [] })
        })
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [active, q, language, key, lat, lon])

  return {
    suggestions: active ? result.items : [],
    loading: active && result.key !== key,
  }
}
