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
const MAX_SUGGESTIONS = 6
const REQUEST_TIMEOUT_MS = 5000

/** Prefer results near Karnataka (a bias, not a hard limit) so local names rank first. */
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

interface NominatimItem {
  place_id?: number
  lat?: string
  lon?: string
  name?: string
  category?: string
  address?: Record<string, string>
}

const cache = new Map<string, PlaceSuggestion[]>()

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

function toSuggestion(item: NominatimItem, language: Language): PlaceSuggestion | null {
  if (item.category && IGNORED_CATEGORIES.has(item.category)) return null

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
  if (!rawName.trim()) return null

  const rawDistrict = cleanDistrictName(addr.state_district || addr.county || addr.city || '')
  const rawState = addr.state || ''

  // The "parent" area helps tell two places with the same name apart (e.g. Kogilu vs. Kogilu Cross).
  const parent =
    [addr.suburb, addr.village, addr.town, addr.city, addr.county, addr.state_district]
      .map((p) => (p || '').trim())
      .find((p) => p && p.toLowerCase() !== rawName.trim().toLowerCase()) || ''

  const name = normalizePlaceName(rawName, language)
  const district = normalizePlaceName(rawDistrict, language)
  const state = normalizePlaceName(rawState, language)
  const detail = uniqueParts([
    normalizePlaceName(parent, language),
    district,
    state,
  ])
    .filter((p) => p.toLowerCase() !== name.toLowerCase())
    .join(', ')

  const lat = parseFloat(item.lat ?? '')
  const lon = parseFloat(item.lon ?? '')
  const coords = Number.isFinite(lat) && Number.isFinite(lon) ? { latitude: lat, longitude: lon } : null

  return {
    id: `osm-${item.place_id ?? `${name}-${district}`}`,
    name,
    detail,
    village: name,
    district: district || normalizePlaceName(parent, language),
    state,
    coords,
  }
}

async function fetchRemote(
  query: string,
  language: Language,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

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
      const suggestion = toSuggestion(item, language)
      if (suggestion) out.push(suggestion)
    }
    return out
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

function localMatches(query: string): PlaceSuggestion[] {
  const q = normalizePlaceName(query, 'en').trim().toLowerCase()
  if (q.length < MIN_QUERY_LENGTH) return []

  const starts: PlaceSuggestion[] = []
  const contains: PlaceSuggestion[] = []
  for (const [name, district, lat, lon] of LOCAL_PLACES) {
    const lower = name.toLowerCase()
    const hit = lower.startsWith(q) ? starts : lower.includes(q) ? contains : null
    if (!hit) continue
    hit.push({
      id: `local-${lower}`,
      name,
      detail: [district !== name ? district : '', 'Karnataka'].filter(Boolean).join(', '),
      village: name,
      district,
      state: 'Karnataka',
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
 * Suggests villages, towns and city areas for what the person has typed so far.
 * Works offline for common places; throws only when the request is aborted.
 */
export async function searchPlaces(
  query: string,
  language: Language = 'en',
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < MIN_QUERY_LENGTH) return []

  const key = `${language}:${q.toLowerCase()}`
  const cached = cache.get(key)
  if (cached) return cached

  let remote: PlaceSuggestion[] = []
  try {
    remote = await fetchRemote(q, language, signal)
  } catch (error) {
    if (signal?.aborted) throw error
    // Offline or timed out: fall back to the built-in list below.
  }

  const result = merge(remote, localMatches(q))
  if (remote.length > 0) cache.set(key, result)
  return result
}
