import type { Coordinates, Language } from '../types'

export interface ReverseGeocodeResult {
  village: string
  district: string
  state: string
}

// -----------------------------------------------------------------------------
// Comprehensive Bidirectional Dictionaries for Karnataka Districts & Common Places
// -----------------------------------------------------------------------------

interface PlaceNames {
  en: string
  kn: string
  hi: string
}

const DISTRICT_NAMES: PlaceNames[] = [
  { en: 'Bagalkot', kn: 'ಬಾಗಲಕೋಟೆ', hi: 'बागलकोट' },
  { en: 'Ballari', kn: 'ಬಳ್ಳಾರಿ', hi: 'बल्लारी' },
  { en: 'Belagavi', kn: 'ಬೆಳಗಾವಿ', hi: 'बेलगावी' },
  { en: 'Bengaluru Urban', kn: 'ಬೆಂಗಳೂರು ನಗರ', hi: 'बेंगलुरु शहरी' },
  { en: 'Bengaluru Rural', kn: 'ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ', hi: 'बेंगलुरु ग्रामीण' },
  { en: 'Bengaluru', kn: 'ಬೆಂಗಳೂರು', hi: 'बेंगलुरु' },
  { en: 'Bangalore Urban', kn: 'ಬೆಂಗಳೂರು ನಗರ', hi: 'बेंगलुरु शहरी' },
  { en: 'Bangalore Rural', kn: 'ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ', hi: 'बेंगलुरु ग्रामीण' },
  { en: 'Bangalore', kn: 'ಬೆಂಗಳೂರು', hi: 'बेंगलुरु' },
  { en: 'Bidar', kn: 'ಬೀದರ್', hi: 'बीदर' },
  { en: 'Chamarajanagar', kn: 'ಚಾಮರಾಜನಗರ', hi: 'चामराजनगर' },
  { en: 'Chikkaballapur', kn: 'ಚಿಕ್ಕಬಳ್ಳಾಪುರ', hi: 'चिकबल्लापुर' },
  { en: 'Chikkamagaluru', kn: 'ಚಿಕ್ಕಮಗಳೂರು', hi: 'चिकमगलूर' },
  { en: 'Chitradurga', kn: 'ಚಿತ್ರದುರ್ಗ', hi: 'चित्रदुर्ग' },
  { en: 'Dakshina Kannada', kn: 'ದಕ್ಷಿಣ ಕನ್ನಡ', hi: 'दक्षिण कन्नड़' },
  { en: 'Davanagere', kn: 'ದಾವಣಗೆರೆ', hi: 'दावणगेरे' },
  { en: 'Dharwad', kn: 'ಧಾರವಾಡ', hi: 'धारवाड़' },
  { en: 'Gadag', kn: 'ಗದಗ', hi: 'गदग' },
  { en: 'Hassan', kn: 'ಹಾಸನ', hi: 'हासन' },
  { en: 'Haveri', kn: 'ಹಾವೇರಿ', hi: 'हावेरी' },
  { en: 'Kalaburagi', kn: 'ಕಲಬುರಗಿ', hi: 'कलबुर्गी' },
  { en: 'Kodagu', kn: 'ಕೊಡಗು', hi: 'कोडगु' },
  { en: 'Kolar', kn: 'ಕೋಲಾರ', hi: 'कोलार' },
  { en: 'Koppal', kn: 'ಕೊಪ್ಪಳ', hi: 'कोप्पल' },
  { en: 'Mandya', kn: 'ಮಂಡ್ಯ', hi: 'मांड्या' },
  { en: 'Mysuru', kn: 'ಮೈಸೂರು', hi: 'मैसूरु' },
  { en: 'Raichur', kn: 'ರಾಯಚೂರು', hi: 'रायचूर' },
  { en: 'Ramanagara', kn: 'ರಾಮನಗರ', hi: 'रामनगर' },
  { en: 'Shivamogga', kn: 'ಶಿವಮೊಗ್ಗ', hi: 'शिवमोग्गा' },
  { en: 'Tumakuru', kn: 'ತುಮಕೂರು', hi: 'तुमकुरु' },
  { en: 'Udupi', kn: 'ಉಡುಪಿ', hi: 'उडुपी' },
  { en: 'Uttara Kannada', kn: 'ಉತ್ತರ ಕನ್ನಡ', hi: 'उत्तर कन्नड़' },
  { en: 'Vijayanagara', kn: 'ವಿಜಯನಗರ', hi: 'विजयनगर' },
  { en: 'Vijayapura', kn: 'ವಿಜಯಪುರ', hi: 'विजयपुर' },
  { en: 'Bijapur', kn: 'ವಿಜಯಪುರ', hi: 'विजयपुर' },
  { en: 'Yadgir', kn: 'ಯಾದಗಿರಿ', hi: 'यादगीर' },
]

const COMMON_PLACES: PlaceNames[] = [
  { en: 'Kogilu', kn: 'ಕೋಗಿಲು', hi: 'कोगिलु' },
  { en: 'Yelahanka', kn: 'ಯಲಹಂಕ', hi: 'यलहंका' },
  { en: 'Allalasandra', kn: 'ಅಲ್ಲಾಲಸಂದ್ರ', hi: 'अल्लालसंद्रा' },
  { en: 'Hebbal', kn: 'ಹೆಬ್ಬಾಳ', hi: 'हेब्बल' },
  { en: 'Jalahalli', kn: 'ಜಾಲಹಳ್ಳಿ', hi: 'जालहल्ली' },
  { en: 'Tikota', kn: 'ಟಿಕೋಟ', hi: 'टिकोता' },
  { en: 'Tikota', kn: 'ತಿಕ್ಕೋಟ', hi: 'टिकोता' },
  { en: 'Babaleshwar', kn: 'ಬಬಲೇಶ್ವರ', hi: 'बाबलेश्वर' },
  { en: 'Hubballi', kn: 'ಹುಬ್ಬಳ್ಳಿ', hi: 'हुबली' },
  { en: 'Ranebennur', kn: 'ರಾಣೆಬೆನ್ನೂರು', hi: 'राणेबेन्नूर' },
  { en: 'Sirsi', kn: 'ಶಿರಸಿ', hi: 'सिरसी' },
  { en: 'Sindhanur', kn: 'ಸಿಂಧನೂರು', hi: 'सिंधानूर' },
  { en: 'Gangavathi', kn: 'ಗಂಗಾವತಿ', hi: 'गंगावती' },
  { en: 'Karnataka', kn: 'ಕರ್ನಾಟಕ', hi: 'कर्नाटक' },
  { en: 'India', kn: 'ಭಾರತ', hi: 'भारत' },
]

const ALL_PLACES = [...DISTRICT_NAMES, ...COMMON_PLACES]

// Fast lookup maps
const KN_TO_EN = new Map<string, string>()
const HI_TO_EN = new Map<string, string>()
const EN_TO_KN = new Map<string, string>()
const EN_TO_HI = new Map<string, string>()

for (const p of ALL_PLACES) {
  const knKey = p.kn.trim().toLowerCase()
  const hiKey = p.hi.trim().toLowerCase()
  const enKey = p.en.trim().toLowerCase()

  if (!KN_TO_EN.has(knKey)) KN_TO_EN.set(knKey, p.en)
  if (!HI_TO_EN.has(hiKey)) HI_TO_EN.set(hiKey, p.en)
  if (!EN_TO_KN.has(enKey)) EN_TO_KN.set(enKey, p.kn)
  if (!EN_TO_HI.has(enKey)) EN_TO_HI.set(enKey, p.hi)
}

// -----------------------------------------------------------------------------
// Phonetic Transliteration Fallback (Kannada Unicode <-> Latin)
// -----------------------------------------------------------------------------

const KN_VOWELS: Record<number, string> = {
  0x0c85: 'a', 0x0c86: 'aa', 0x0c87: 'i', 0x0c88: 'ee', 0x0c89: 'u', 0x0c8a: 'oo', 0x0c8b: 'ru',
  0x0c8e: 'e', 0x0c8f: 'e', 0x0c90: 'ai', 0x0c92: 'o', 0x0c93: 'o', 0x0c94: 'au',
}

const KN_CONSONANTS: Record<number, string> = {
  0x0c95: 'k', 0x0c96: 'kh', 0x0c97: 'g', 0x0c98: 'gh', 0x0c99: 'ng',
  0x0c9a: 'ch', 0x0c9b: 'chh', 0x0c9c: 'j', 0x0c9d: 'jh', 0x0c9e: 'ny',
  0x0c9f: 't', 0x0ca0: 'th', 0x0ca1: 'd', 0x0ca2: 'dh', 0x0ca3: 'n',
  0x0ca4: 't', 0x0ca5: 'th', 0x0ca6: 'd', 0x0ca7: 'dh', 0x0ca8: 'n',
  0x0caa: 'p', 0x0cab: 'ph', 0x0cac: 'b', 0x0cad: 'bh', 0x0cae: 'm',
  0x0caf: 'y', 0x0cb0: 'r', 0x0cb1: 'r', 0x0cb2: 'l', 0x0cb3: 'l', 0x0cb5: 'v',
  0x0cb6: 'sh', 0x0cb7: 'sh', 0x0cb8: 's', 0x0cb9: 'h',
}

const KN_MATRAS: Record<number, string> = {
  0x0cbe: 'a', 0x0cbf: 'i', 0x0cc0: 'ee', 0x0cc1: 'u', 0x0cc2: 'oo', 0x0cc3: 'ru',
  0x0cc6: 'e', 0x0cc7: 'e', 0x0cc8: 'ai', 0x0cca: 'o', 0x0ccb: 'o', 0x0ccc: 'au',
}

function transliterateKnToEn(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (KN_VOWELS[code]) {
      out += KN_VOWELS[code]
    } else if (KN_CONSONANTS[code]) {
      const c = KN_CONSONANTS[code]
      const next = text.charCodeAt(i + 1)
      if (KN_MATRAS[next]) {
        out += c + KN_MATRAS[next]
        i++
      } else if (next === 0x0ccd) {
        // Halant (virama): suppress inherent vowel
        out += c
        i++
      } else if (next === 0x0c82) {
        // Anusvara
        out += c + 'an'
        i++
      } else {
        out += c + 'a'
      }
    } else if (code === 0x0c82) {
      out += 'n'
    } else if (code === 0x0ccd) {
      // Standalone virama
    } else {
      out += text[i]
    }
  }
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : text
}

function hasKannadaChars(str: string): boolean {
  return /[\u0C80-\u0CFF]/.test(str)
}

/**
 * Normalizes any place or district name to the target language (en, kn, hi).
 */
export function normalizePlaceName(rawName: string, targetLanguage: Language = 'en'): string {
  const trimmed = rawName.trim()
  if (!trimmed) return ''

  const lower = trimmed.toLowerCase()

  // 1. Target: English
  if (targetLanguage === 'en') {
    if (KN_TO_EN.has(lower)) return KN_TO_EN.get(lower)!
    if (HI_TO_EN.has(lower)) return HI_TO_EN.get(lower)!
    if (hasKannadaChars(trimmed)) {
      return transliterateKnToEn(trimmed)
    }
    return trimmed
  }

  // 2. Target: Kannada
  if (targetLanguage === 'kn') {
    if (EN_TO_KN.has(lower)) return EN_TO_KN.get(lower)!
    if (HI_TO_EN.has(lower)) {
      const en = HI_TO_EN.get(lower)!.toLowerCase()
      if (EN_TO_KN.has(en)) return EN_TO_KN.get(en)!
    }
    return trimmed
  }

  // 3. Target: Hindi
  if (targetLanguage === 'hi') {
    if (EN_TO_HI.has(lower)) return EN_TO_HI.get(lower)!
    if (KN_TO_EN.has(lower)) {
      const en = KN_TO_EN.get(lower)!.toLowerCase()
      if (EN_TO_HI.has(en)) return EN_TO_HI.get(en)!
    }
    return trimmed
  }

  return trimmed
}

function cleanDistrict(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/\s+(district|taluk|taluka|urban taluku|rural taluku|tahsil|tehsil)$/i, '')
    // OSM calls the Bengaluru city district "Bengaluru Urban"; machines are listed under "Bengaluru".
    .replace(/\s+urban$/i, '')
    .trim()
}

// -----------------------------------------------------------------------------
// In-Memory Reverse Geocoding Cache & Request Deduplication
// -----------------------------------------------------------------------------

const reverseGeocodeCache = new Map<string, ReverseGeocodeResult>()
const inflightReverseGeocode = new Map<string, Promise<ReverseGeocodeResult | null>>()
const REVERSE_CACHE_MAX = 200

export function clearReverseGeocodeCache(): void {
  reverseGeocodeCache.clear()
  inflightReverseGeocode.clear()
}

function getGeocodeCacheKey(coords: Coordinates, lang: Language): string {
  return `${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)},${lang}`
}

/**
 * Reverse geocodes latitude & longitude into a human-readable village/town,
 * revenue district, and state according to the user's active language ('en', 'kn', 'hi').
 *
 * Performance features:
 * - In-memory cache by rounded coordinates (~110m resolution) & language.
 * - Simultaneous request deduplication.
 * - Guaranteed timeout cleanup in finally blocks.
 * - Fast-fail timeout budget (2.5s Nominatim + 2.0s BigDataCloud fallback).
 * - Full AbortSignal support for client cancellation.
 */
export async function reverseGeocode(
  coords: Coordinates,
  language: Language = 'en',
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult | null> {
  if (
    !coords ||
    typeof coords.latitude !== 'number' ||
    typeof coords.longitude !== 'number' ||
    Number.isNaN(coords.latitude) ||
    Number.isNaN(coords.longitude)
  ) {
    return null
  }

  if (signal?.aborted) return null

  const cacheKey = getGeocodeCacheKey(coords, language)
  const cached = reverseGeocodeCache.get(cacheKey)
  if (cached) return cached

  const existingPromise = inflightReverseGeocode.get(cacheKey)
  if (existingPromise) return existingPromise

  const fetchPromise = (async (): Promise<ReverseGeocodeResult | null> => {
    const { latitude, longitude } = coords
    const acceptLang = language === 'kn' ? 'kn,en' : language === 'hi' ? 'hi,en' : 'en'
    const bdcLang = language === 'kn' ? 'kn' : language === 'hi' ? 'hi' : 'en'

    // 1. Try OpenStreetMap Nominatim with 2.5s timeout
    let nominatimResult: ReverseGeocodeResult | null = null
    const nomController = new AbortController()
    const onAbortNom = () => nomController.abort()
    signal?.addEventListener('abort', onAbortNom, { once: true })
    const nomTimer = setTimeout(() => nomController.abort(), 2500)

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=17&addressdetails=1&accept-language=${acceptLang}`
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'HarvestRentalsApp/1.0',
          'Accept-Language': acceptLang,
        },
        signal: nomController.signal,
      })

      if (res.ok) {
        const data = await res.json()
        const addr = data.address || {}
        const rawVillage =
          addr.village ||
          addr.neighbourhood ||
          addr.suburb ||
          addr.hamlet ||
          addr.locality ||
          addr.town ||
          addr.city_district ||
          addr.city ||
          addr.county ||
          ''
        const rawDistrict = cleanDistrict(addr.state_district || addr.county || '')
        const rawState = addr.state || ''

        if (rawVillage || rawDistrict) {
          const village = normalizePlaceName(rawVillage || rawDistrict, language)
          const district = normalizePlaceName(rawDistrict || rawVillage, language)
          const state = normalizePlaceName(rawState, language)
          nominatimResult = {
            village: village || district,
            district: district || village,
            state,
          }
        }
      }
    } catch {
      // Fall through to secondary provider
    } finally {
      clearTimeout(nomTimer)
      signal?.removeEventListener('abort', onAbortNom)
    }

    if (nominatimResult) {
      if (reverseGeocodeCache.size >= REVERSE_CACHE_MAX) {
        const first = reverseGeocodeCache.keys().next().value
        if (first) reverseGeocodeCache.delete(first)
      }
      reverseGeocodeCache.set(cacheKey, nominatimResult)
      return nominatimResult
    }

    if (signal?.aborted) return null

    // 2. Fallback: BigDataCloud client reverse geocode API with 2.0s timeout
    const bdcController = new AbortController()
    const onAbortBdc = () => bdcController.abort()
    signal?.addEventListener('abort', onAbortBdc, { once: true })
    const bdcTimer = setTimeout(() => bdcController.abort(), 2000)

    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${bdcLang}`
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: bdcController.signal,
      })

      if (res.ok) {
        const data = await res.json()
        const rawVillage = data.locality || data.city || ''
        let rawDistrict = ''
        if (Array.isArray(data.localityInfo?.administrative)) {
          const dObj = data.localityInfo.administrative.find(
            (a: { adminLevel?: number; name?: string }) =>
              a.adminLevel === 5 || (a.name && /district/i.test(a.name)),
          )
          if (dObj?.name) {
            rawDistrict = cleanDistrict(dObj.name)
          }
        }
        const rawState = data.principalSubdivision || ''
        if (rawVillage || rawDistrict) {
          const village = normalizePlaceName(rawVillage || rawDistrict, language)
          const district = normalizePlaceName(rawDistrict || rawVillage, language)
          const state = normalizePlaceName(rawState, language)
          const result: ReverseGeocodeResult = {
            village: village || district,
            district: district || village,
            state,
          }
          if (reverseGeocodeCache.size >= REVERSE_CACHE_MAX) {
            const first = reverseGeocodeCache.keys().next().value
            if (first) reverseGeocodeCache.delete(first)
          }
          reverseGeocodeCache.set(cacheKey, result)
          return result
        }
      }
    } catch {
      // Both failed or offline
    } finally {
      clearTimeout(bdcTimer)
      signal?.removeEventListener('abort', onAbortBdc)
    }

    return null
  })()

  inflightReverseGeocode.set(cacheKey, fetchPromise)
  try {
    return await fetchPromise
  } finally {
    inflightReverseGeocode.delete(cacheKey)
  }
}

const KNOWN_PLACE_COORDINATES: Record<string, Coordinates> = {
  kogilu: { latitude: 13.1067, longitude: 77.6174 },
  yelahanka: { latitude: 13.1007, longitude: 77.5963 },
  sampigehalli: { latitude: 13.0844, longitude: 77.6326 },
  kattigenahalli: { latitude: 13.1186, longitude: 77.632 },
  tikota: { latitude: 16.8286, longitude: 75.5412 },
  toravi: { latitude: 16.8155, longitude: 75.6601 },
  aninapur: { latitude: 16.85, longitude: 75.6 },
  allalasandra: { latitude: 13.0838, longitude: 77.5855 },
  hebbal: { latitude: 13.0358, longitude: 77.597 },
  jalahalli: { latitude: 13.0528, longitude: 77.5407 },
  babaleshwar: { latitude: 16.6667, longitude: 75.5333 },
  hubballi: { latitude: 15.3647, longitude: 75.124 },
  ranebennur: { latitude: 14.6231, longitude: 75.6218 },
  sirsi: { latitude: 14.6195, longitude: 74.8354 },
  sindhanur: { latitude: 15.7667, longitude: 76.7667 },
  gangavathi: { latitude: 15.4333, longitude: 76.5333 },
  bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  bangalore: { latitude: 12.9716, longitude: 77.5946 },
  vijayapura: { latitude: 16.8302, longitude: 75.71 },
  bijapur: { latitude: 16.8302, longitude: 75.71 },
  bagalkot: { latitude: 16.18, longitude: 75.69 },
  belagavi: { latitude: 15.8497, longitude: 74.4977 },
  kalaburagi: { latitude: 17.3297, longitude: 76.8343 },
}

const memoryCoordsCache = new Map<string, Coordinates>()

export async function resolveVillageCoordinates(
  village: string,
  district?: string,
): Promise<Coordinates | null> {
  const normVillage = normalizePlaceName(village, 'en').trim().toLowerCase()
  if (!normVillage) return null

  if (KNOWN_PLACE_COORDINATES[normVillage]) {
    return KNOWN_PLACE_COORDINATES[normVillage]
  }

  const cacheKey = `${normVillage}:${(district || '').trim().toLowerCase()}`
  if (memoryCoordsCache.has(cacheKey)) {
    return memoryCoordsCache.get(cacheKey)!
  }

  try {
    const rawStorage = typeof window !== 'undefined' ? window.localStorage.getItem(`hr_geo_${cacheKey}`) : null
    if (rawStorage) {
      const parsed = JSON.parse(rawStorage) as Coordinates
      if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
        memoryCoordsCache.set(cacheKey, parsed)
        return parsed
      }
    }
  } catch {
    // Ignore storage errors
  }

  try {
    const query = district ? `${village}, ${district}, Karnataka, India` : `${village}, Karnataka, India`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=1`,
      {
        headers: { Accept: 'application/json', 'User-Agent': 'HarvestRentalsApp/1.0' },
        signal: controller.signal,
      },
    )
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const coords: Coordinates = {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        }
        memoryCoordsCache.set(cacheKey, coords)
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`hr_geo_${cacheKey}`, JSON.stringify(coords))
          }
        } catch {
          // Ignore
        }
        return coords
      }
    }
  } catch {
    // Offline or timeout
  }

  return null
}

