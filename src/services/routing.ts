import type { Coordinates } from '../types'

export interface RoadRoute {
  /** Points along the road as [lat, lng], ready for a Leaflet polyline. */
  points: Array<[number, number]>
  distanceMeters: number
  durationSeconds: number
  source: 'ors' | 'osrm'
}

/** Do not ask for a new route unless one of these is true (keeps free services happy). */
export const MIN_MOVE_METERS = 100
export const MAX_ROUTE_AGE_MS = 30_000
export const MIN_REQUEST_GAP_MS = 15_000
const REQUEST_TIMEOUT_MS = 4_000 // Fast 4s timeout per provider

const ROUTE_CACHE_MAX = 50
const ROUTE_CACHE_TTL_MS = 60_000

interface CacheEntry {
  route: RoadRoute
  timestamp: number
}

const routeCache = new Map<string, CacheEntry>()
const inflightRoutes = new Map<string, Promise<RoadRoute | null>>()

export function clearRouteCache(): void {
  routeCache.clear()
  inflightRoutes.clear()
}

function getCacheKey(from: Coordinates, to: Coordinates): string {
  // Round to 3 decimal places (~110m resolution) to absorb GPS jitter
  return `${from.latitude.toFixed(3)},${from.longitude.toFixed(3)}->${to.latitude.toFixed(3)},${to.longitude.toFixed(3)}`
}

/** Straight-line distance in metres between two points (haversine). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadius = 6_371_000
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface RouteRequestState {
  from: Coordinates
  to: Coordinates
  at: number
}

/**
 * Whether a new road route should be requested. `last` is the previous request
 * (null for the first one). Rules: never more than once per 15 seconds; ask again
 * when either end moved more than 100 m, or when the route is older than 30 seconds
 * and something moved at all.
 */
export function shouldRefetchRoute(
  last: RouteRequestState | null,
  from: Coordinates,
  to: Coordinates,
  now: number,
): boolean {
  if (!last) return true
  const age = now - last.at
  if (age < MIN_REQUEST_GAP_MS) return false
  const moved = Math.max(distanceMeters(last.from, from), distanceMeters(last.to, to))
  if (moved > MIN_MOVE_METERS) return true
  return age > MAX_ROUTE_AGE_MS && moved > 10
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

function toLatLngPairs(coordinates: unknown): Array<[number, number]> | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null
  const points: Array<[number, number]> = []
  for (const pair of coordinates) {
    if (!Array.isArray(pair) || typeof pair[0] !== 'number' || typeof pair[1] !== 'number') {
      return null
    }
    points.push([pair[1], pair[0]]) // service gives [lng, lat]
  }
  return points
}

async function fromOpenRouteService(
  from: Coordinates,
  to: Coordinates,
  signal?: AbortSignal,
): Promise<RoadRoute | null> {
  const key = import.meta.env.VITE_ORS_API_KEY as string | undefined
  if (!key) return null
  const guard = withTimeout(signal)
  try {
    const response = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: { Authorization: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: [
            [from.longitude, from.latitude],
            [to.longitude, to.latitude],
          ],
        }),
        signal: guard.signal,
      },
    )
    if (!response.ok) return null
    const body = (await response.json()) as {
      features?: Array<{
        geometry?: { coordinates?: unknown }
        properties?: { summary?: { distance?: number; duration?: number } }
      }>
    }
    const feature = body.features?.[0]
    const points = toLatLngPairs(feature?.geometry?.coordinates)
    const summary = feature?.properties?.summary
    if (!points || typeof summary?.distance !== 'number' || typeof summary.duration !== 'number') {
      return null
    }
    return {
      points,
      distanceMeters: summary.distance,
      durationSeconds: summary.duration,
      source: 'ors',
    }
  } catch {
    return null
  } finally {
    guard.done()
  }
}

async function fromOsrm(
  from: Coordinates,
  to: Coordinates,
  signal?: AbortSignal,
): Promise<RoadRoute | null> {
  const guard = withTimeout(signal)
  try {
    // Use overview=simplified to optimize payload and network response
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      `?overview=simplified&geometries=geojson`
    const response = await fetch(url, { signal: guard.signal })
    if (!response.ok) return null
    const body = (await response.json()) as {
      routes?: Array<{ geometry?: { coordinates?: unknown }; distance?: number; duration?: number }>
    }
    const route = body.routes?.[0]
    const points = toLatLngPairs(route?.geometry?.coordinates)
    if (!points || typeof route?.distance !== 'number' || typeof route.duration !== 'number') {
      return null
    }
    return { points, distanceMeters: route.distance, durationSeconds: route.duration, source: 'osrm' }
  } catch {
    return null
  } finally {
    guard.done()
  }
}

/**
 * Road route between two points. Tries memory cache first, then OpenRouteService,
 * then OSRM fallback. Deduplicates simultaneous lookups.
 * Never throws: returns null when no route could be found.
 */
export async function getRoadRoute(
  from: Coordinates,
  to: Coordinates,
  signal?: AbortSignal,
): Promise<RoadRoute | null> {
  if (signal?.aborted) return null

  const key = getCacheKey(from, to)
  const cached = routeCache.get(key)
  const now = Date.now()
  if (cached && now - cached.timestamp < ROUTE_CACHE_TTL_MS) {
    return cached.route
  }

  const inflight = inflightRoutes.get(key)
  if (inflight) {
    return inflight
  }

  const promise = (async () => {
    const ors = await fromOpenRouteService(from, to, signal)
    if (ors) {
      if (routeCache.size >= ROUTE_CACHE_MAX) {
        const oldestKey = routeCache.keys().next().value
        if (oldestKey) routeCache.delete(oldestKey)
      }
      routeCache.set(key, { route: ors, timestamp: Date.now() })
      return ors
    }

    if (signal?.aborted) return null

    const osrm = await fromOsrm(from, to, signal)
    if (osrm) {
      if (routeCache.size >= ROUTE_CACHE_MAX) {
        const oldestKey = routeCache.keys().next().value
        if (oldestKey) routeCache.delete(oldestKey)
      }
      routeCache.set(key, { route: osrm, timestamp: Date.now() })
      return osrm
    }

    return null
  })().finally(() => {
    inflightRoutes.delete(key)
  })

  inflightRoutes.set(key, promise)
  return promise
}
