import type { CropKey, MachineType } from '../types'

export const MACHINE_TYPES: MachineType[] = [
  'combine_harvester',
  'tractor_harvester',
  'reaper',
  'thresher',
  'baler',
  'tractor',
  'trailer',
  'tractor_trailer',
  'other',
]

/** Transport equipment: rented with or without a driver, often by the trip or day. */
export const TRANSPORT_TYPES: MachineType[] = ['tractor', 'trailer', 'tractor_trailer']

export function isTransportType(value: unknown): boolean {
  return typeof value === 'string' && (TRANSPORT_TYPES as string[]).includes(value)
}

export const CROP_KEYS: CropKey[] = [
  'wheat',
  'rice',
  'maize',
  'sugarcane',
  'cotton',
  'soybean',
  'groundnut',
  'millet',
  'barley',
  'mustard',
  'chickpea',
  'pigeon_pea',
  'jowar',
  'ragi',
  'bajra',
  'sunflower',
  'sesame',
  'green_gram',
  'black_gram',
  'lentil',
]

export function isMachineType(value: unknown): value is MachineType {
  return typeof value === 'string' && (MACHINE_TYPES as string[]).includes(value)
}

export function isCropKey(value: unknown): value is CropKey {
  return typeof value === 'string' && (CROP_KEYS as string[]).includes(value)
}

export const MAX_VILLAGES = 8
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const IMAGE_BUCKET = 'machine-images'

export const PHONE_DISPLAY_PREFIX = '+91'

export const APP_NAME = 'Harvest Rentals'
