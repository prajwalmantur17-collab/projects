import { useEffect, useRef, useState } from 'react'
import {
  MIN_REQUEST_GAP_MS,
  getRoadRoute,
  shouldRefetchRoute,
} from '../services/routing'
import type { RoadRoute, RouteRequestState } from '../services/routing'
import type { Coordinates } from '../types'

interface RouteState {
  route: RoadRoute | null
  settled: boolean
}

/**
 * Road route between two live points. Asks the routing service only when needed
 * (first time, or after someone moved far enough), and keeps showing the previous
 * route while a new one loads or if the service is down.
 */
export function useRoadRoute(from: Coordinates | null | undefined, to: Coordinates | null | undefined) {
  const [state, setState] = useState<RouteState>({ route: null, settled: false })
  const lastRequest = useRef<RouteRequestState | null>(null)
  const sequence = useRef(0)
  const lifetime = useRef<AbortController | null>(null)

  const fromLat = from?.latitude
  const fromLng = from?.longitude
  const toLat = to?.latitude
  const toLng = to?.longitude

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (
      fromLat === undefined ||
      fromLng === undefined ||
      toLat === undefined ||
      toLng === undefined
    ) {
      return
    }
    const start: Coordinates = { latitude: fromLat, longitude: fromLng }
    const end: Coordinates = { latitude: toLat, longitude: toLng }
    let timer: ReturnType<typeof setTimeout> | undefined

    const attempt = () => {
      const signal = lifetime.current?.signal
      if (!signal || signal.aborted) return
      const now = Date.now()
      const last = lastRequest.current
      if (!shouldRefetchRoute(last, start, end, now)) {
        // Too soon after the last request: look again once the gap has passed.
        if (last && now - last.at < MIN_REQUEST_GAP_MS) {
          timer = setTimeout(attempt, MIN_REQUEST_GAP_MS - (now - last.at) + 50)
        }
        return
      }
      lastRequest.current = { from: start, to: end, at: now }
      const mine = ++sequence.current
      void getRoadRoute(start, end, signal).then((route) => {
        if (signal.aborted || mine !== sequence.current) return
        setState((previous) => ({ route: route ?? previous.route, settled: true }))
      })
    }

    attempt()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [fromLat, fromLng, toLat, toLng])

  const active = fromLat !== undefined && toLat !== undefined
  return {
    route: active ? state.route : null,
    loading: active && !state.settled,
  }
}
