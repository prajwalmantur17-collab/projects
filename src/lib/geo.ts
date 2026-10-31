export interface Coordinates {
  latitude: number
  longitude: number
}

const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Great-circle distance in kilometres. */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude)
  const dLon = toRadians(to.longitude - from.longitude)
  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(to.latitude)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

export function formatDistance(km: number): string {
  if (km < 1) return '<1'
  if (km < 10) return km.toFixed(1)
  return Math.round(km).toString()
}
