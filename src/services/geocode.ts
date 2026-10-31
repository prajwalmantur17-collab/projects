import type { Coordinates } from '../types'

export interface ReverseGeocodeResult {
  village: string
  district: string
  state: string
}

function cleanDistrict(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/\s+(district|taluk|taluka|urban taluku|rural taluku|tahsil|tehsil)$/i, '')
    .trim()
}

/**
 * Reverse geocodes latitude & longitude into a human-readable village/town,
 * revenue district, and state.
 * Uses Nominatim with a fast fallback to BigDataCloud client geocoding.
 */
export async function reverseGeocode(coords: Coordinates): Promise<ReverseGeocodeResult | null> {
  const { latitude, longitude } = coords

  // 1. Try OpenStreetMap Nominatim with 4s timeout
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HarvestRentalsApp/1.0',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.ok) {
      const data = await res.json()
      const addr = data.address || {}
      const village =
        addr.village ||
        addr.town ||
        addr.hamlet ||
        addr.suburb ||
        addr.city_district ||
        addr.city ||
        addr.locality ||
        addr.county ||
        ''
      const district = cleanDistrict(addr.state_district || addr.county || '')
      const state = addr.state || ''

      if (village || district) {
        return {
          village: village || district,
          district: district || village,
          state,
        }
      }
    }
  } catch {
    // Fall through to fallback
  }

  // 2. Fallback: BigDataCloud client reverse geocode API (fast, free client-side)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.ok) {
      const data = await res.json()
      const village = data.locality || data.city || ''
      let district = ''
      if (Array.isArray(data.localityInfo?.administrative)) {
        const dObj = data.localityInfo.administrative.find(
          (a: { adminLevel?: number; name?: string }) =>
            a.adminLevel === 5 || (a.name && /district/i.test(a.name)),
        )
        if (dObj?.name) {
          district = cleanDistrict(dObj.name)
        }
      }
      const state = data.principalSubdivision || ''
      if (village || district) {
        return {
          village: village || district,
          district: district || village,
          state,
        }
      }
    }
  } catch {
    // Both failed or offline
  }

  return null
}
