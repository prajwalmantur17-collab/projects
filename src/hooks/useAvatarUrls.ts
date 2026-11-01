import { useEffect, useState } from 'react'
import { getAvatarUrls } from '../services/avatars'

/** Profile photo addresses for a list of people, keyed by user id. Missing ids have no photo. */
export function useAvatarUrls(userIds: Array<string | null | undefined>): Record<string, string> {
  const key = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))))
    .sort()
    .join(',')
  const [state, setState] = useState<{ key: string; urls: Record<string, string> }>({
    key: '',
    urls: {},
  })

  useEffect(() => {
    if (!key) return
    let alive = true
    void getAvatarUrls(key.split(',')).then((urls) => {
      if (alive) setState({ key, urls })
    })
    return () => {
      alive = false
    }
  }, [key])

  return state.key === key ? state.urls : {}
}
