import { requireSupabase } from '../lib/supabase'

const AVATAR_BUCKET = 'avatars'
const AVATAR_SIZE = 256
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

/** Public address of a stored photo, or null when there is none. Never throws. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null
  try {
    const { data } = requireSupabase().storage.from(AVATAR_BUCKET).getPublicUrl(path)
    return data.publicUrl || null
  } catch {
    return null
  }
}

/** Crops the picture to a square and shrinks it so it loads fast on slow internet. */
async function shrinkToSquare(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no canvas')
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    )
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (blob) return blob
  } catch {
    // fall through to the original file
  }
  if (file.size <= MAX_UPLOAD_BYTES) return file
  throw new Error('HR_INVALID_INPUT: photo is too large')
}

/** Saves a new profile photo and returns its stored path. Replaces and cleans up the old one. */
export async function uploadAvatar(
  file: File,
  userId: string,
  previousPath?: string | null,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('HR_INVALID_INPUT: choose a picture')
  }
  const client = requireSupabase()
  const blob = await shrinkToSquare(file)
  const path = `${userId}/avatar-${Date.now()}.jpg`

  const { error: uploadError } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) throw uploadError

  const { error: updateError } = await client
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userId)
  if (updateError) {
    await client.storage.from(AVATAR_BUCKET).remove([path])
    throw updateError
  }

  if (previousPath && previousPath !== path) {
    await client.storage.from(AVATAR_BUCKET).remove([previousPath]).catch(() => undefined)
  }
  return path
}

export async function removeAvatar(userId: string, path: string | null | undefined): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('profiles').update({ avatar_path: null }).eq('id', userId)
  if (error) throw error
  if (path) await client.storage.from(AVATAR_BUCKET).remove([path]).catch(() => undefined)
}

const pathCache = new Map<string, string | null>()

/**
 * Photo addresses for several people at once, keyed by user id. People without a
 * photo are left out. Never throws: if the photo column is not installed yet the
 * result is simply empty and the app shows initials.
 */
export async function getAvatarUrls(userIds: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  const missing = userIds.filter((id) => !pathCache.has(id))
  if (missing.length > 0) {
    try {
      const { data, error } = await requireSupabase()
        .from('profiles')
        .select('id, avatar_path')
        .in('id', missing)
      if (!error && Array.isArray(data)) {
        for (const row of data as Array<{ id: string; avatar_path: string | null }>) {
          pathCache.set(row.id, row.avatar_path ?? null)
        }
      }
    } catch {
      // ignore: people simply show without a photo
    }
  }
  for (const id of userIds) {
    const url = avatarUrl(pathCache.get(id))
    if (url) result[id] = url
  }
  return result
}

/** Forget what we know about one person (after they change or remove their photo). */
export function forgetAvatar(userId: string): void {
  pathCache.delete(userId)
}
