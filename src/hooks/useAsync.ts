import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationKey } from '../i18n'
import { logError, mapErrorToKey } from '../lib/errors'

export interface AsyncResult<T> {
  data: T | null
  loading: boolean
  error: TranslationKey | null
  reload: () => void
}

export function useAsync<T>(
  loader: () => Promise<T>,
  options: { enabled?: boolean; fallback?: TranslationKey } = {},
): AsyncResult<T> {
  const { enabled = true, fallback = 'error.generic' } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [version, setVersion] = useState(0)
  const requestId = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    loader()
      .then((result) => {
        if (requestId.current === current) setData(result)
      })
      .catch((caught: unknown) => {
        if (requestId.current === current) {
          logError('useAsync', caught)
          setError(mapErrorToKey(caught, fallback))
        }
      })
      .finally(() => {
        if (requestId.current === current) setLoading(false)
      })
  }, [loader, enabled, fallback, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  return { data, loading, error, reload }
}
