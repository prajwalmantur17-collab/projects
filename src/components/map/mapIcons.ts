import L from 'leaflet'

/** Blue pulsing dot, like the "you are here" marker in ride apps. */
export const meIcon = L.divIcon({
  className: 'hr-marker',
  html: '<span class="hr-me"><span class="hr-me-pulse"></span><span class="hr-me-dot"></span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

/** A listed machine. */
export const machineIcon = L.divIcon({
  className: 'hr-marker',
  html: '<span class="hr-pin">🚜</span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
})

/** The machine that is on its way to the farmer (live position). */
export const trackedIcon = L.divIcon({
  className: 'hr-marker',
  html: '<span class="hr-pin hr-pin-live">🚜</span>',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
})

/** The viewer's own photo with a soft blue pulse, replacing the blue "you are here" dot. */
export function createMePhotoIcon(url: string): L.DivIcon {
  const safe = url.replace(/["'<>\s]/g, (char) => encodeURIComponent(char))
  return L.divIcon({
    className: 'hr-marker',
    html: `<span class="hr-me hr-me-photo"><span class="hr-me-pulse"></span><span class="hr-pin hr-pin-photo hr-pin-me"><img src="${safe}" alt="" onerror="this.remove()" /></span></span>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  })
}

/** A person's own photo as the map marker (medium size, round, white border). */
export function createPhotoIcon(url: string): L.DivIcon {
  const safe = url.replace(/["'<>\s]/g, (char) => encodeURIComponent(char))
  return L.divIcon({
    className: 'hr-marker',
    html: `<span class="hr-pin hr-pin-photo"><img src="${safe}" alt="" onerror="this.remove()" /></span>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  })
}

/** The farmer (live position), shown on the owner's map. */
export const farmerIcon = L.divIcon({
  className: 'hr-marker',
  html: '<span class="hr-pin hr-pin-live">🧑‍🌾</span>',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
})
