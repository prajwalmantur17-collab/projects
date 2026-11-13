import type { IncomingMessage, ServerResponse } from 'node:http'

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': status === 200 ? 'public, max-age=300, stale-while-revalidate=600' : 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

function cleanDistrict(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/\s+(district|taluk|taluka|urban taluku|rural taluku|tahsil|tehsil)$/i, '')
    .replace(/\s+urban$/i, '')
    .trim()
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rLat1 = (lat1 * Math.PI) / 180
  const rLat2 = (lat2 * Math.PI) / 180
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Accurately extracts the most local, human-meaningful place name from an OSM reverse geocode payload.
 * Prevents broad administrative polygons (such as OSM's 25 km² Kogilu boundary) from masking
 * well-known colleges/universities (e.g. REVA University), townships (Bhartiya City), or distinct villages (Kattigenahalli).
 */
export function resolveAccuratePlaceName(
  data: {
    name?: string
    category?: string
    type?: string
    address?: Record<string, string>
  },
  latitude: number,
  longitude: number,
): string {
  const addr = data.address || {}
  const rawName = (data.name || '').trim()

  // 1. Direct university / college / campus check (e.g. REVA University campus & facilities)
  if (/reva/i.test(rawName) || /reva/i.test(addr.amenity || '') || /reva/i.test(addr.university || '') || /reva/i.test(addr.college || '')) {
    return 'REVA University'
  }

  // 2. Proximity check for REVA University (covers 1.2km radius around campus center, main gate, hostel blocks)
  const dReva = getDistanceKm(latitude, longitude, 13.1154, 77.6358)
  if (dReva <= 1.2) {
    return 'REVA University'
  }

  // 3. Proximity & keyword check for Bhartiya City & Nikoo Homes
  const dBhartiya = getDistanceKm(latitude, longitude, 13.0845, 77.6410)
  if (dBhartiya <= 1.5 || /bhartiya/i.test(rawName) || /bhartiya/i.test(addr.neighbourhood || '') || /nikoo/i.test(rawName) || /nikoo/i.test(addr.road || '')) {
    return 'Bhartiya City'
  }

  // 4. Specific village / neighbourhood name match
  if (/kattigenahalli/i.test(rawName) || /kattigenahalli/i.test(addr.village || '') || /kattigenahalli/i.test(addr.neighbourhood || '')) {
    return 'Kattigenahalli'
  }
  if (/bellahalli/i.test(rawName) || /bellahalli/i.test(addr.village || '') || /bellahalli/i.test(addr.neighbourhood || '')) {
    return 'Bellahalli'
  }
  if (/chokkanahalli/i.test(rawName) || /chokkanahalli/i.test(addr.village || '') || /chokkanahalli/i.test(addr.neighbourhood || '')) {
    return 'Chokkanahalli'
  }
  if (/kannuru/i.test(rawName) || /kannuru/i.test(addr.village || '') || /kannuru/i.test(addr.neighbourhood || '')) {
    return 'Kannuru'
  }
  if (/thanisandra/i.test(rawName) || /thanisandra/i.test(addr.suburb || '') || /thanisandra/i.test(addr.neighbourhood || '')) {
    return 'Thanisandra'
  }
  if (/toravi/i.test(rawName) || /toravi/i.test(addr.village || '')) {
    return 'Toravi'
  }
  if (/tikota/i.test(rawName) || /tikota/i.test(addr.village || '') || /tikkota/i.test(rawName)) {
    return 'Tikota'
  }

  const dKattigenahalli = getDistanceKm(latitude, longitude, 13.1205, 77.6300)
  if (dKattigenahalli <= 1.2) {
    return 'Kattigenahalli'
  }

  const dBellahalli = getDistanceKm(latitude, longitude, 13.1100, 77.6420)
  if (dBellahalli <= 1.2) {
    return 'Bellahalli'
  }

  const dChokkanahalli = getDistanceKm(latitude, longitude, 13.0950, 77.6320)
  if (dChokkanahalli <= 1.2) {
    return 'Chokkanahalli'
  }

  const dKannuru = getDistanceKm(latitude, longitude, 13.0906, 77.6534)
  if (dKannuru <= 1.3) {
    return 'Kannuru'
  }

  const dSampigehalli = getDistanceKm(latitude, longitude, 13.0880, 77.6180)
  if (dSampigehalli <= 1.2) {
    return 'Sampigehalli'
  }

  const dHegdeNagar = getDistanceKm(latitude, longitude, 13.0645, 77.6270)
  if (dHegdeNagar <= 1.2) {
    return 'Hegde Nagar'
  }

  const dThanisandra = getDistanceKm(latitude, longitude, 13.0549, 77.6322)
  if (dThanisandra <= 1.5) {
    return 'Thanisandra'
  }

  const dJakkur = getDistanceKm(latitude, longitude, 13.0783, 77.6074)
  if (dJakkur <= 1.5) {
    return 'Jakkur'
  }

  const dToravi = getDistanceKm(latitude, longitude, 16.8180, 75.6620)
  if (dToravi <= 2.5) {
    return 'Toravi'
  }

  const dTikota = getDistanceKm(latitude, longitude, 16.8286, 75.5412)
  if (dTikota <= 2.5) {
    return 'Tikota'
  }

  const dBabaleshwar = getDistanceKm(latitude, longitude, 16.6500, 75.6000)
  if (dBabaleshwar <= 2.5) {
    return 'Babaleshwar'
  }

  // 3. High-precision local community / neighbourhood / village / hamlet
  let candidate =
    addr.village ||
    addr.hamlet ||
    addr.isolated_dwelling ||
    addr.neighbourhood ||
    addr.residential ||
    ''

  // 4. Strict Kogilu bounding box guard:
  // True Kogilu village is at 13.1039, 77.6167. OSM's 25 sq-km relation falsely tags huge swathes
  // of North Bengaluru as Kogilu. If candidate contains Kogilu but distance > 1.2 km, DISCARD IT.
  const dKogilu = getDistanceKm(latitude, longitude, 13.1039, 77.6167)
  if (/kogilu/i.test(candidate) && dKogilu > 1.2) {
    candidate = ''
  }

  // 5. Named educational / civic / community landmark (excluding generic roads)
  if (!candidate && rawName && data.category !== 'highway' && rawName !== addr.road) {
    if (data.category === 'amenity' || data.type === 'university' || data.type === 'college' || addr.amenity) {
      if (!/kogilu/i.test(rawName) || dKogilu <= 1.2) {
        candidate = rawName
      }
    }
  }

  // 6. Road name locality extraction (e.g. "Bellahalli Main Road" -> "Bellahalli")
  if (!candidate && addr.road) {
    const roadPrefix = addr.road.replace(/\s+(main\s+road|road|cross|layout|street|way)$/i, '').trim()
    if (roadPrefix && roadPrefix !== addr.road && roadPrefix.length >= 3) {
      if (/^(bellahalli|kattigenahalli|nikoo homes|thanisandra|toravi|chokkanahalli|sampigehalli|hegde nagar|kannuru)$/i.test(roadPrefix)) {
        candidate = roadPrefix
      }
    }
  }

  // 7. Broad suburb, quarter, town, locality fallback (strictly filtering out Kogilu if outside village bounds)
  if (!candidate) {
    const suburb = (!/kogilu/i.test(addr.suburb || '') || dKogilu <= 1.2) ? addr.suburb : ''
    candidate =
      addr.quarter ||
      suburb ||
      addr.locality ||
      addr.town ||
      addr.city_district ||
      addr.city ||
      addr.county ||
      ''
  }

  if (/kogilu/i.test(candidate) && dKogilu > 1.2) {
    candidate = addr.city_district || addr.city || 'Bengaluru'
  }

  return candidate
}

/**
 * Serverless Reverse Geocode API for Harvest Rentals.
 * Runs on Node.js (Vercel) so it bypasses browser CORS restrictions and public
 * Nominatim rate limits, providing accurate village/neighbourhood-level place names.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed', message: 'Only GET is supported' })
    return
  }

  const reqUrl = new URL(req.url ?? '/', 'http://localhost')
  const latStr = reqUrl.searchParams.get('lat')
  const lonStr = reqUrl.searchParams.get('lon')
  const lang = reqUrl.searchParams.get('lang') || 'en'

  const latitude = parseFloat(latStr || '')
  const longitude = parseFloat(lonStr || '')

  if (Number.isNaN(latitude) || Number.isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    sendJson(res, 400, { error: 'invalid_coordinates', message: 'Latitude and longitude are required numbers.' })
    return
  }

  const acceptLang = lang === 'kn' ? 'kn,en' : lang === 'hi' ? 'hi,en' : lang === 'ta' ? 'ta,en' : 'en'
  const bdcLang = lang === 'kn' ? 'kn' : lang === 'hi' ? 'hi' : lang === 'ta' ? 'ta' : 'en'

  // 1. Primary: OpenStreetMap Nominatim with fine-grained zoom 18
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=${acceptLang}`

    const nomRes = await fetch(nomUrl, {
      headers: {
        'User-Agent': 'HarvestRentalsApp/1.0 (contact@harvestrentals.com)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (nomRes.ok) {
      const data = (await nomRes.json()) as {
        name?: string
        category?: string
        type?: string
        address?: Record<string, string>
      }
      const addr = data.address || {}

      const rawVillage = resolveAccuratePlaceName(data, latitude, longitude)
      const rawDistrict = cleanDistrict(addr.state_district || addr.county || '')
      const rawState = addr.state || ''

      if (rawVillage || rawDistrict) {
        sendJson(res, 200, {
          village: rawVillage || rawDistrict,
          district: rawDistrict || rawVillage,
          state: rawState,
        })
        return
      }
    }
  } catch {
    // Fall through to fallback provider
  }

  // 2. Secondary fallback: BigDataCloud client reverse geocode API
  try {
    const bdcController = new AbortController()
    const bdcTimer = setTimeout(() => bdcController.abort(), 2500)
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${bdcLang}`

    const bdcRes = await fetch(bdcUrl, {
      headers: { Accept: 'application/json' },
      signal: bdcController.signal,
    })
    clearTimeout(bdcTimer)

    if (bdcRes.ok) {
      const data = (await bdcRes.json()) as {
        locality?: string
        city?: string
        principalSubdivision?: string
        localityInfo?: { administrative?: Array<{ adminLevel?: number; name?: string }> }
      }

      let rawVillage = data.locality || data.city || ''
      let rawDistrict = ''

      if (Array.isArray(data.localityInfo?.administrative)) {
        const fineObj = [...data.localityInfo.administrative]
          .reverse()
          .find((a) => (a.adminLevel ?? 0) >= 8 && a.name)
        if (fineObj?.name && !rawVillage) {
          rawVillage = fineObj.name
        }

        const dObj = data.localityInfo.administrative.find(
          (a) => a.adminLevel === 5 || a.adminLevel === 6 || (a.name && /district/i.test(a.name)),
        )
        if (dObj?.name) {
          rawDistrict = cleanDistrict(dObj.name)
        }
      }

      // High-precision proximity overrides for BigDataCloud fallback
      const dReva = getDistanceKm(latitude, longitude, 13.1154, 77.6358)
      const dBhartiya = getDistanceKm(latitude, longitude, 13.0845, 77.6410)
      const dKattigenahalli = getDistanceKm(latitude, longitude, 13.1205, 77.6300)
      const dBellahalli = getDistanceKm(latitude, longitude, 13.1100, 77.6420)
      const dChokkanahalli = getDistanceKm(latitude, longitude, 13.0950, 77.6320)
      const dKannuru = getDistanceKm(latitude, longitude, 13.0906, 77.6534)
      const dSampigehalli = getDistanceKm(latitude, longitude, 13.0880, 77.6180)
      const dHegdeNagar = getDistanceKm(latitude, longitude, 13.0645, 77.6270)
      const dThanisandra = getDistanceKm(latitude, longitude, 13.0549, 77.6322)
      const dJakkur = getDistanceKm(latitude, longitude, 13.0783, 77.6074)
      const dToravi = getDistanceKm(latitude, longitude, 16.8180, 75.6620)
      const dTikota = getDistanceKm(latitude, longitude, 16.8286, 75.5412)
      const dBabaleshwar = getDistanceKm(latitude, longitude, 16.6500, 75.6000)
      const dKogilu = getDistanceKm(latitude, longitude, 13.1039, 77.6167)

      if (dReva <= 1.2 || /reva/i.test(rawVillage)) {
        rawVillage = 'REVA University'
      } else if (dBhartiya <= 1.5 || /bhartiya|nikoo/i.test(rawVillage)) {
        rawVillage = 'Bhartiya City'
      } else if (dKattigenahalli <= 1.2) {
        rawVillage = 'Kattigenahalli'
      } else if (dBellahalli <= 1.2) {
        rawVillage = 'Bellahalli'
      } else if (dChokkanahalli <= 1.2) {
        rawVillage = 'Chokkanahalli'
      } else if (dKannuru <= 1.3) {
        rawVillage = 'Kannuru'
      } else if (dSampigehalli <= 1.2) {
        rawVillage = 'Sampigehalli'
      } else if (dHegdeNagar <= 1.2) {
        rawVillage = 'Hegde Nagar'
      } else if (dThanisandra <= 1.5) {
        rawVillage = 'Thanisandra'
      } else if (dJakkur <= 1.5) {
        rawVillage = 'Jakkur'
      } else if (dToravi <= 2.5) {
        rawVillage = 'Toravi'
      } else if (dTikota <= 2.5) {
        rawVillage = 'Tikota'
      } else if (dBabaleshwar <= 2.5) {
        rawVillage = 'Babaleshwar'
      } else if (/kogilu/i.test(rawVillage) && dKogilu > 1.2) {
        // Discard broad BDC Kogilu adminLevel tag
        rawVillage = data.locality || data.city || ''
        if (/kogilu/i.test(rawVillage)) {
          rawVillage = data.city || 'Bengaluru'
        }
      }

      const rawState = data.principalSubdivision || ''
      if (rawVillage || rawDistrict) {
        sendJson(res, 200, {
          village: rawVillage || rawDistrict,
          district: rawDistrict || rawVillage,
          state: rawState,
        })
        return
      }
    }
  } catch {
    // Fall through
  }

  sendJson(res, 404, { error: 'not_found', message: 'Could not resolve place name for coordinates.' })
}
