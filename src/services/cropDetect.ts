import { CROP_KEYS } from '../lib/constants'
import { requireSupabase } from '../lib/supabase'
import type { CropKey } from '../types'

export interface CropDetection {
  /** The crop the photo most likely shows, or null when it could not tell. */
  crop: CropKey | null
  confidence: 'high' | 'medium' | 'low'
  alternatives: CropKey[]
}

const MAX_SIDE = 768

function isCropKey(value: unknown): value is CropKey {
  return typeof value === 'string' && (CROP_KEYS as string[]).includes(value)
}

/** Shrinks the picture so it uploads fast on slow internet. Returns base64 (no data: prefix). */
async function prepareImage(file: File): Promise<{ image: string; mime: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('no canvas')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  return { image: dataUrl.slice(dataUrl.indexOf(',') + 1), mime: 'image/jpeg' }
}

/**
 * Asks the server function which crop is in the photo. Throws when the check is not
 * available (not installed, no internet, free limit used up); the caller then asks the
 * farmer to choose the crop by hand.
 */
export async function detectCropFromPhoto(file: File): Promise<CropDetection> {
  const body = await prepareImage(file)
  const { data, error } = await requireSupabase().functions.invoke('detect-crop', { body })
  if (error || !data || typeof data !== 'object') throw error ?? new Error('detect-crop failed')

  const raw = data as { crop?: unknown; confidence?: unknown; alternatives?: unknown; error?: unknown }
  if (raw.error) throw new Error(String(raw.error))

  const crop = isCropKey(raw.crop) ? raw.crop : null
  const confidence =
    raw.confidence === 'high' || raw.confidence === 'medium' ? raw.confidence : 'low'
  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives.filter(isCropKey).filter((key) => key !== crop)
    : []
  return { crop, confidence, alternatives }
}
