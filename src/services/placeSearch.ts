import type { Coordinates, Language } from '../types'
import { normalizePlaceName } from './geocode'

/**
 * One row in the "type a place, pick from the list" dropdown (Uber / Rapido style).
 * `village` and `district` are what the machine search uses; `name` and `detail`
 * are only for display.
 */
export interface PlaceSuggestion {
  id: string
  /** Main line, e.g. "Bharathi City". */
  name: string
  /** Second line, e.g. "Kogilu, Bengaluru, Karnataka". */
  detail: string
  village: string
  district: string
  state: string
  coords: Coordinates | null
}

const MIN_QUERY_LENGTH = 2
const MAX_SUGGESTIONS = 7
const REQUEST_TIMEOUT_PHOTON = 2500
const REQUEST_TIMEOUT_NOMINATIM = 2000
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const CACHE_MAX_ENTRIES = 150

interface CacheEntry {
  items: PlaceSuggestion[]
  expires: number
}

const cache = new Map<string, CacheEntry>()

export function clearPlaceCache(): void {
  cache.clear()
}

/** Rough centre of Karnataka, used to rank local places first when GPS is off. */
const DEFAULT_BIAS: Coordinates = { latitude: 14.8, longitude: 75.7 }
/** Whole of India: lng/lat box (min lon, min lat, max lon, max lat). */
const INDIA_BBOX = '68.1,6.7,97.4,35.7'
const KARNATAKA_VIEWBOX = '74.0,18.5,78.6,11.5'

/** OSM categories that are shops, roads, buildings etc. Farmers search for places, not these. */
const IGNORED_CATEGORIES = new Set([
  'highway',
  'amenity',
  'shop',
  'building',
  'tourism',
  'railway',
  'office',
  'man_made',
  'healthcare',
  'craft',
  'public_transport',
  'aeroway',
  'emergency',
])

/** Used when the network is down so the dropdown still helps for the common places. */
const LOCAL_PLACES: Array<[name: string, district: string, lat: number, lon: number]> = [
  ['Bhartiya City', 'Bengaluru', 13.0845, 77.6410],
  ['Thanisandra', 'Bengaluru', 13.0549, 77.6322],
  ['Kannuru', 'Bengaluru', 13.0906, 77.6534],
  ['Bengaluru', 'Bengaluru', 12.9716, 77.5946],
  ['Yelahanka', 'Bengaluru', 13.1007, 77.5963],
  ['Kogilu', 'Bengaluru', 13.1067, 77.6174],
  ['Hebbal', 'Bengaluru', 13.0358, 77.597],
  ['Jalahalli', 'Bengaluru', 13.0528, 77.5407],
  ['Vijayapura', 'Vijayapura', 16.8302, 75.71],
  ['Tikota', 'Vijayapura', 16.8286, 75.5412],
  ['Toravi', 'Vijayapura', 16.8155, 75.6601],
  ['Aninapur', 'Vijayapura', 16.85, 75.6],
  ['Babaleshwar', 'Vijayapura', 16.6667, 75.5333],
  ['Hubballi', 'Dharwad', 15.3647, 75.124],
  ['Dharwad', 'Dharwad', 15.4589, 75.0078],
  ['Mandya', 'Mandya', 12.5218, 76.8951],
  ['Mysuru', 'Mysuru', 12.2958, 76.6394],
  ['Belagavi', 'Belagavi', 15.8497, 74.4977],
  ['Ranebennur', 'Haveri', 14.6231, 75.6218],
]

function cleanDistrictName(raw: string): string {
  return raw
    .replace(/\s+(district|taluk|taluka|urban taluku|rural taluku|tahsil|tehsil)$/i, '')
    // OSM calls the Bengaluru city district "Bengaluru Urban"; machines are listed under "Bengaluru".
    .replace(/\s+urban$/i, '')
    .trim()
}

function acceptLanguage(language: Language): string {
  if (language === 'kn') return 'kn,en'
  if (language === 'hi') return 'hi,en'
  if (language === 'ta') return 'ta,en'
  return 'en'
}

function uniqueParts(parts: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

function buildSuggestion(
  id: string,
  rawName: string,
  rawParent: string,
  rawCity: string,
  rawDistrict: string,
  rawState: string,
  coords: Coordinates | null,
  language: Language,
): PlaceSuggestion {
  const name = normalizePlaceName(rawName, language)
  const district = normalizePlaceName(cleanDistrictName(rawDistrict), language)
  const state = normalizePlaceName(rawState, language)
  const parent = normalizePlaceName(rawParent, language)
  const city = normalizePlaceName(rawCity, language)

  const detail = uniqueParts([parent, city, district, state])
    .filter((p) => p.toLowerCase() !== name.toLowerCase())
    .join(', ')

  return {
    id,
    name,
    detail,
    village: name,
    district: district || city || parent,
    state,
    coords,
  }
}

// -----------------------------------------------------------------------------
// Photon (OpenStreetMap data, made for search-as-you-type; matches partial words
// like "Bharat" -> "Bharathi City" and ranks results near a point first)
// -----------------------------------------------------------------------------

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    osm_id?: number
    osm_type?: string
    osm_key?: string
    name?: string
    district?: string
    locality?: string
    city?: string
    county?: string
    state?: string
    countrycode?: string
    type?: string
  }
}

async function fetchPhoton(
  query: string,
  near: Coordinates,
  language: Language,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_PHOTON)

  try {
    const url =
      'https://photon.komoot.io/api/' +
      `?q=${encodeURIComponent(query)}&limit=12&lang=en` +
      `&lat=${near.latitude}&lon=${near.longitude}&bbox=${INDIA_BBOX}`
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    if (!res.ok) return []
    const data = (await res.json()) as { features?: PhotonFeature[] }
    if (!Array.isArray(data.features)) return []

    const out: PlaceSuggestion[] = []
    for (const feature of data.features) {
      const p = feature.properties
      if (!p?.name) continue
      if (p.countrycode && p.countrycode.toUpperCase() !== 'IN') continue
      if (p.osm_key && IGNORED_CATEGORIES.has(p.osm_key)) continue
      if (p.type && ['house', 'street', 'country', 'state'].includes(p.type)) continue

      const [lon, lat] = feature.geometry?.coordinates ?? []
      const coords =
        typeof lat === 'number' && typeof lon === 'number' ? { latitude: lat, longitude: lon } : null

      const parent = [p.locality, p.district].find((x) => x && x.toLowerCase() !== p.name!.toLowerCase()) || ''
      out.push(
        buildSuggestion(
          `photon-${p.osm_type ?? ''}${p.osm_id ?? p.name}`,
          p.name,
          parent,
          p.city && p.city.toLowerCase() !== p.name.toLowerCase() ? p.city : '',
          p.county || p.city || p.district || '',
          p.state || '',
          coords,
          language,
        ),
      )
    }
    return out
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

// -----------------------------------------------------------------------------
// Nominatim fallback (whole-word search only)
// -----------------------------------------------------------------------------

interface NominatimItem {
  place_id?: number
  lat?: string
  lon?: string
  name?: string
  category?: string
  address?: Record<string, string>
}

async function fetchNominatim(
  query: string,
  language: Language,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_NOMINATIM)

  try {
    const lang = acceptLanguage(language)
    const url =
      'https://nominatim.openstreetmap.org/search' +
      `?format=jsonv2&addressdetails=1&limit=10&dedupe=1&countrycodes=in` +
      `&viewbox=${KARNATAKA_VIEWBOX}&accept-language=${lang}&q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'Accept-Language': lang },
      signal: controller.signal,
    })
    if (!res.ok) return []
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return []

    const out: PlaceSuggestion[] = []
    for (const item of data as NominatimItem[]) {
      if (item.category && IGNORED_CATEGORIES.has(item.category)) continue
      const addr = item.address ?? {}
      const rawName =
        item.name ||
        addr.village ||
        addr.hamlet ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.town ||
        addr.city ||
        addr.locality ||
        ''
      if (!rawName.trim()) continue

      const parent =
        [addr.suburb, addr.village, addr.town, addr.city]
          .map((x) => (x || '').trim())
          .find((x) => x && x.toLowerCase() !== rawName.trim().toLowerCase()) || ''

      const lat = parseFloat(item.lat ?? '')
      const lon = parseFloat(item.lon ?? '')
      out.push(
        buildSuggestion(
          `osm-${item.place_id ?? rawName}`,
          rawName,
          parent,
          '',
          addr.state_district || addr.county || addr.city || '',
          addr.state || '',
          Number.isFinite(lat) && Number.isFinite(lon) ? { latitude: lat, longitude: lon } : null,
          language,
        ),
      )
    }
    return out
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

// -----------------------------------------------------------------------------

export function localMatches(query: string, language: Language = 'en'): PlaceSuggestion[] {
  const q = normalizePlaceName(query, 'en').trim().toLowerCase()
  if (q.length < MIN_QUERY_LENGTH) return []

  const starts: PlaceSuggestion[] = []
  const contains: PlaceSuggestion[] = []
  for (const [rawName, rawDistrict, lat, lon] of LOCAL_PLACES) {
    const lower = rawName.toLowerCase()
    const hit = lower.startsWith(q) ? starts : lower.includes(q) ? contains : null
    if (!hit) continue

    const name = normalizePlaceName(rawName, language)
    const district = normalizePlaceName(rawDistrict, language)
    const state = normalizePlaceName('Karnataka', language)

    hit.push({
      id: `local-${lower}`,
      name,
      detail: [district !== name ? district : '', state].filter(Boolean).join(', '),
      village: name,
      district,
      state,
      coords: { latitude: lat, longitude: lon },
    })
  }
  return [...starts, ...contains]
}

function merge(primary: PlaceSuggestion[], secondary: PlaceSuggestion[]): PlaceSuggestion[] {
  const seen = new Set<string>()
  const out: PlaceSuggestion[] = []
  for (const s of [...primary, ...secondary]) {
    const key = `${s.village.toLowerCase()}|${s.district.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length >= MAX_SUGGESTIONS) break
  }
  return out
}

/**
 * Suggests villages, towns and city areas for what the person has typed so far,
 * nearest to `near` (GPS or the last picked place) first.
 * Works offline for common places; throws only when the request is aborted.
 */
export async function searchPlaces(
  query: string,
  language: Language = 'en',
  signal?: AbortSignal,
  near?: Coordinates | null,
): Promise<PlaceSuggestion[]> {
  if (signal?.aborted) {
    throw new DOMException('The user aborted a request.', 'AbortError')
  }

  const q = query.trim()
  if (q.length < MIN_QUERY_LENGTH) return []

  const bias = near ?? DEFAULT_BIAS
  // ~11 km buckets so small GPS jitter does not defeat the cache.
  const key = `${language}:${q.toLowerCase()}:${bias.latitude.toFixed(1)},${bias.longitude.toFixed(1)}`
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expires > now) {
    return cached.items
  }

  let remote: PlaceSuggestion[] = []
  try {
    remote = await fetchPhoton(q, bias, language, signal)
  } catch (error) {
    if (signal?.aborted) throw error
  }

  // Only fall back to Nominatim if Photon gave 0 results AND query is at least 3 characters
  if (remote.length === 0 && q.length >= 3 && !signal?.aborted) {
    try {
      remote = await fetchNominatim(q, language, signal)
    } catch (error) {
      if (signal?.aborted) throw error
      // Offline or timed out: fall back to the built-in list below.
    }
  }

  const result = merge(remote, localMatches(q, language))
  if (remote.length > 0) {
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value
      if (oldestKey) cache.delete(oldestKey)
    }
    cache.set(key, { items: result, expires: now + CACHE_TTL_MS })
  }
  return result
}
