import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { searchPlaces } from '../services/placeSearch'
import type { PlaceSuggestion } from '../services/placeSearch'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

/**
 * Live place suggestions for a text box. Waits for a short pause in typing,
 * cancels outdated requests, and keeps the previous list on screen while the
 * next one loads so the dropdown does not flicker.
 */
export function usePlaceSuggestions(query: string, enabled: boolean) {
  const { language } = useI18n()
  const q = query.trim()
  const active = enabled && q.length >= MIN_CHARS
  const key = `${language}|${q}`

  const [result, setResult] = useState<{ key: string; items: PlaceSuggestion[] }>({
    key: '',
    items: [],
  })

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchPlaces(q, language, controller.signal)
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
  }, [active, q, language, key])

  return {
    suggestions: active ? result.items : [],
    loading: active && result.key !== key,
  }
}
