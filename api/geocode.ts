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
        address?: Record<string, string>
      }
      const addr = data.address || {}

      // Detailed hierarchy: prioritize finest local place (village/hamlet/neighbourhood)
      // over broad postal suburbs (e.g. Bhartiya City over Kogilu, or Toravi over Vijayapura).
      const rawVillage =
        addr.village ||
        addr.hamlet ||
        addr.isolated_dwelling ||
        addr.neighbourhood ||
        addr.residential ||
        addr.quarter ||
        addr.suburb ||
        addr.locality ||
        addr.town ||
        addr.city_district ||
        addr.city ||
        addr.county ||
        ''

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
