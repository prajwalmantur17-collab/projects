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

  // 2. High-precision local community / neighbourhood / village / hamlet
  let candidate =
    addr.village ||
    addr.hamlet ||
    addr.isolated_dwelling ||
    addr.neighbourhood ||
    addr.residential ||
    ''

  // 3. Proximity check for REVA University (covers 550m radius around campus center and main gate)
  const dReva = getDistanceKm(latitude, longitude, 13.1154, 77.6358)
  if (dReva <= 0.6) {
    return 'REVA University'
  }

  // 4. Proximity check for Bhartiya City (covers 650m radius around center and Nikoo Homes)
  const dBhartiya = getDistanceKm(latitude, longitude, 13.0845, 77.6410)
  if (dBhartiya <= 0.65) {
    return 'Bhartiya City'
  }

  // 5. Named educational / civic / community landmark (excluding generic roads)
  if (!candidate && rawName && data.category !== 'highway' && rawName !== addr.road) {
    if (data.category === 'amenity' || data.type === 'university' || data.type === 'college' || addr.amenity) {
      candidate = rawName
    }
  }

  // 6. Road name locality extraction (e.g. "Bellahalli Main Road" -> "Bellahalli")
  if (!candidate && addr.road) {
    const roadPrefix = addr.road.replace(/\s+(main\s+road|road|cross|layout|street|way)$/i, '').trim()
    if (roadPrefix && roadPrefix !== addr.road && roadPrefix.length >= 3) {
      if (/^(bellahalli|kattigenahalli|nikoo homes|thanisandra|toravi|chokkanahalli|sampigehalli)$/i.test(roadPrefix)) {
        candidate = roadPrefix
      }
    }
  }

  // 7. Guard against OSM's oversized 25 sq-km "Kogilu" bounding box relation (19884610):
  // True Kogilu village is at 13.1039, 77.6167. If candidate is Kogilu or empty,
  // but coordinate is > 1.3 km away from Kogilu village, check neighbouring true localities.
  const dKogilu = getDistanceKm(latitude, longitude, 13.1039, 77.6167)
  const dKattigenahalli = getDistanceKm(latitude, longitude, 13.1205, 77.6300)
  const dBellahalli = getDistanceKm(latitude, longitude, 13.1100, 77.6420)
  const dChokkanahalli = getDistanceKm(latitude, longitude, 13.0950, 77.6320)

  if (dKattigenahalli <= 1.0 && (!candidate || candidate.toLowerCase() === 'kogilu') && dKogilu > 1.3) {
    return 'Kattigenahalli'
  }
  if (dBellahalli <= 1.0 && (!candidate || candidate.toLowerCase() === 'kogilu') && dKogilu > 1.3) {
    return 'Bellahalli'
  }
  if (dChokkanahalli <= 1.0 && (!candidate || candidate.toLowerCase() === 'kogilu') && dKogilu > 1.3) {
    return 'Chokkanahalli'
  }

  // 8. Broad suburb, quarter, town, locality fallback
  if (!candidate) {
    if (addr.suburb && addr.suburb.toLowerCase() === 'kogilu' && dKogilu > 1.4) {
      // Too far from Kogilu village — fallback to city or city district
      candidate = addr.city_district || addr.city || ''
    } else {
      candidate =
        addr.quarter ||
        addr.suburb ||
        addr.locality ||
        addr.town ||
        addr.city_district ||
        addr.city ||
        addr.county ||
        ''
    }
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

      // Check proximity guards even for BigDataCloud
      const dReva = getDistanceKm(latitude, longitude, 13.1154, 77.6358)
      if (dReva <= 0.6) {
        rawVillage = 'REVA University'
      } else {
        const dBhartiya = getDistanceKm(latitude, longitude, 13.0845, 77.6410)
        if (dBhartiya <= 0.65) {
          rawVillage = 'Bhartiya City'
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
