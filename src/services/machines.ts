import { IMAGE_BUCKET } from '../lib/constants'
import { logError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { todayIsoInIndia, validateImageFile } from '../lib/validation'
import type { MachineCard, MachineInput } from '../types'
import { normalizePlaceName } from './geocode'
import {
  addLocalMachine,
  deduplicateMachines,
  forgetDeletedMarkers,
  getLocalMachines,
  isMachineDeleted,
  markMachineDeleted,
  pruneLocalMachines,
  updateLocalMachine,
} from './store'

export { getDeletedMachineIds, isMachineDeleted, markMachineDeleted } from './store'

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export function subscribeToMachineDeletions(onDelete: (machineId: string) => void): () => void {
  if (!supabase || typeof window === 'undefined' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
    return () => {}
  }

  try {
    const channel = supabase
      .channel('public-machines-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id
            if (oldId) {
              markMachineDeleted(oldId)
              onDelete(oldId)
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as {
              id?: string
              is_active?: boolean
              is_available?: boolean
              deleted_at?: string | null
            }
            if (!updated?.id) return
            if (updated.deleted_at) {
              // Really deleted: remember it on this device.
              markMachineDeleted(updated.id)
              onDelete(updated.id)
            } else if (updated.is_active === false || updated.is_available === false) {
              // Only paused: hide it now, but do NOT mark it deleted, so it can come back when resumed.
              onDelete(updated.id)
            }
          }
        },
      )
      .subscribe()

    return () => {
      void supabase?.removeChannel(channel)
    }
  } catch {
    return () => {}
  }
}

export function getMachineImageUrl(path: string | null): string | null {
  if (!path) return null
  // If it's already a full HTTP(S) URL or Data URL, return it directly
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  if (!supabase) return null
  try {
    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
    return data.publicUrl || null
  } catch {
    return null
  }
}

export async function uploadMachineImage(file: File, userId: string): Promise<string> {
  const validationError = validateImageFile(file)
  if (validationError) throw new Error(validationError)

  // Try Supabase Storage first if client is available
  if (supabase) {
    try {
      const path = `${userId}/${crypto.randomUUID()}.${extensionFor(file)}`
      const { error } = await supabase
        .storage.from(IMAGE_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (!error) return path
    } catch {
      // Fall through to Base64 data URL fallback
    }
  }

  // Fallback: Convert to Base64 data URL so it works offline/in demo without storage bucket
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}

export async function deleteMachineImage(path: string, userId: string): Promise<void> {
  if (!supabase) return
  if (!path.startsWith(`${userId}/`)) {
    return
  }
  try {
    await supabase.storage.from(IMAGE_BUCKET).remove([path])
  } catch {
    // Ignore cleanup error
  }
}

export async function searchMachines(params: {
  village?: string
  district?: string
  crop?: string
  machineType?: string
  limit?: number
  offset?: number
  signal?: AbortSignal
}): Promise<MachineCard[]> {
  const rawVillage = (params.village || '').trim()
  const rawDistrict = (params.district || '').trim()
  const cleanVillage = normalizePlaceName(rawVillage, 'en') || rawVillage
  const cleanDistrict = normalizePlaceName(rawDistrict, 'en') || rawDistrict
  const cleanCrop = (params.crop || '').trim().toLowerCase()
  const cleanType = (params.machineType || '').trim().toLowerCase()

  if (params.signal?.aborted) {
    throw new DOMException('Search request aborted', 'AbortError')
  }

  // 1. Try Supabase if available (single round-trip RPC)
  if (supabase) {
    try {
      let query = supabase.rpc('search_machines', {
        p_village: cleanVillage || null,
        p_district: cleanDistrict || null,
        p_state: null,
        p_crop: params.crop || null,
        p_machine_type: params.machineType || null,
        p_limit: params.limit ?? 48,
        p_offset: params.offset ?? 0,
      })

      if (params.signal) {
        query = query.abortSignal(params.signal)
      }

      const { data, error } = await query

      if (error) {
        logError('searchMachines RPC error', error)
        throw error
      } else if (Array.isArray(data)) {
        // Server responded authoritatively. If Supabase returns 0 machines, display 0 machines!
        // Never fall back to stale localStorage when the server successfully answered.
        const serverList = data as MachineCard[]
        // Server is the source of truth: clear wrong local "deleted" markers for machines it returns,
        // and drop old offline-only copies (ids starting with m-) that the server never had.
        forgetDeletedMarkers(serverList.map((m) => m?.id).filter(Boolean))
        pruneLocalMachines((m) => !m.id.startsWith('m-'))
        return deduplicateMachines(serverList).filter((m) => m && m.is_active !== false)
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'))) {
        throw err
      }
      logError('searchMachines network/execution error', err)
      // Only fall through to local store on genuine network/offline error
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
      if (!isOffline && err && typeof err === 'object' && 'code' in err) {
        // Database/RLS error while online: rethrow so UI displays server error rather than stale local cache
        throw err
      }
    }
  }

  // 2. Offline / Local Resilient Store Search (Only if offline or client-only mock mode)
  const all = getLocalMachines()

  // Filter by crop & machine type first
  const baseCandidates = all.filter((m) => {
    if (!m || !m.is_active || isMachineDeleted(m.id)) return false
    const crops = Array.isArray(m.crops) ? m.crops : []
    const mType = (m.machine_type || '').toLowerCase()

    if (cleanCrop && !crops.some((c) => c && c.toLowerCase() === cleanCrop)) {
      return false
    }
    if (cleanType && mType !== cleanType) {
      return false
    }
    return true
  })

  // If no village or district filter was provided, return base candidates
  if (!cleanVillage && !cleanDistrict) {
    return deduplicateMachines(baseCandidates)
  }

  const vTarget = cleanVillage.toLowerCase()
  let dTarget = cleanDistrict.toLowerCase()

  // If district wasn't typed, infer it from the machine located in vTarget or if vTarget is actually a district
  if (!dTarget && vTarget) {
    const matched = baseCandidates.find((m) => {
      const v = (m.village || '').toLowerCase()
      const d = (m.district || '').toLowerCase()
      const svs = Array.isArray(m.service_villages)
        ? m.service_villages.map((s) => (typeof s === 'string' ? s.toLowerCase() : ''))
        : []
      return v === vTarget || svs.includes(vTarget) || d === vTarget
    })
    if (matched?.district) {
      dTarget = matched.district.toLowerCase()
    }
  }

  // Filter STRICTLY to the user's village or district (NO other districts from the state!)
  const filtered = baseCandidates.filter((m) => {
    const mVillage = (m.village || '').toLowerCase()
    const mDistrict = (m.district || '').toLowerCase()
    const mVillages = Array.isArray(m.service_villages)
      ? m.service_villages.map((s) => (typeof s === 'string' ? s.toLowerCase() : ''))
      : []

    // Level 1: In Your Village
    const isVillageMatch =
      Boolean(vTarget) &&
      (mVillage === vTarget ||
        mVillages.includes(vTarget) ||
        (vTarget.length >= 3 && mVillage.includes(vTarget)))

    // Level 2: Available in Same District
    const isDistrictMatch =
      Boolean(dTarget) &&
      Boolean(mDistrict) &&
      (mDistrict === dTarget ||
        mDistrict.includes(dTarget) ||
        dTarget.includes(mDistrict))

    return isVillageMatch || isDistrictMatch
  })

  // Sort matching candidates by proximity rank: village first, then district
  const sorted = [...filtered].sort((a, b) => {
    const aVillage = (a.village || '').toLowerCase()
    const bVillage = (b.village || '').toLowerCase()
    const aSvs = Array.isArray(a.service_villages)
      ? a.service_villages.map((s) => (typeof s === 'string' ? s.toLowerCase() : ''))
      : []
    const bSvs = Array.isArray(b.service_villages)
      ? b.service_villages.map((s) => (typeof s === 'string' ? s.toLowerCase() : ''))
      : []

    const aIsVillage =
      Boolean(vTarget) &&
      (aVillage === vTarget || aSvs.includes(vTarget) || (vTarget.length >= 3 && aVillage.includes(vTarget)))
    const bIsVillage =
      Boolean(vTarget) &&
      (bVillage === vTarget || bSvs.includes(vTarget) || (vTarget.length >= 3 && bVillage.includes(vTarget)))

    if (aIsVillage && !bIsVillage) return -1
    if (!aIsVillage && bIsVillage) return 1
    return 0
  })

  return deduplicateMachines(sorted)
}

export async function getMachineCard(
  machineId: string,
  options?: { allowInactive?: boolean },
): Promise<MachineCard | null> {
  if (isMachineDeleted(machineId)) return null
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('machine_cards')
        .select('*')
        .eq('id', machineId)
        .maybeSingle()
      if (!error) {
        if (!data) {
          // Server says it does not exist (or is deleted): remove any stale local copy.
          pruneLocalMachines((m) => m.id !== machineId)
          return null
        }
        const card = data as MachineCard & { deleted_at?: string | null }
        if (card.deleted_at || isMachineDeleted(card.id)) return null
        if (!card.is_active && !options?.allowInactive) return null
        return card
      }
    } catch {
      // Fall through to offline cache check
    }
  }

  // Only check local machine cache if genuine offline
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
  if (isOffline || !supabase) {
    const local = getLocalMachines().find((m) => m.id === machineId)
    if (!local || isMachineDeleted(local.id)) return null
    if (!local.is_active && !options?.allowInactive) return null
    return local
  }

  return null
}

export async function listOwnerMachines(ownerId: string): Promise<MachineCard[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('machine_cards')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
      if (!error && Array.isArray(data)) {
        const serverList = data as MachineCard[]
        const serverIds = new Set(serverList.map((m) => m?.id))
        forgetDeletedMarkers([...serverIds].filter(Boolean) as string[])
        // Drop this owner's cached machines that the server no longer lists.
        pruneLocalMachines((m) => m.owner_id !== ownerId || serverIds.has(m.id))
        return deduplicateMachines(serverList, { includeInactive: true })
      }
    } catch {
      // Fall through
    }
  }

  return getLocalMachines().filter((m) => m.owner_id === ownerId)
}

export async function getMachineLocations(machineId: string) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('machine_locations')
        .select('id, machine_id, village, district, state, is_primary')
        .eq('machine_id', machineId)
        .order('is_primary', { ascending: false })
      if (!error && data) return data
    } catch {
      // Fall through
    }
  }

  const machine = getLocalMachines().find((m) => m.id === machineId)
  if (!machine) return []
  return [
    {
      id: `${machineId}-loc-primary`,
      machine_id: machineId,
      village: machine.village,
      district: machine.district,
      state: machine.state,
      is_primary: true,
    },
    ...(machine.service_villages || [])
      .filter((v) => v && v !== machine.village)
      .map((v, i) => ({
        id: `${machineId}-loc-${i}`,
        machine_id: machineId,
        village: v,
        district: machine.district,
        state: machine.state,
        is_primary: false,
      })),
  ]
}

export async function listBlackoutDates(machineId: string) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('machine_blackout_dates')
        .select('id, machine_id, unavailable_on')
        .eq('machine_id', machineId)
        .gte('unavailable_on', todayIsoInIndia())
        .order('unavailable_on', { ascending: true })
      if (!error && data) return data
    } catch {
      // Fall through
    }
  }
  return []
}

export async function addBlackoutDate(machineId: string, date: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('machine_blackout_dates')
      .insert({ machine_id: machineId, unavailable_on: date })
    if (error) throw error
  }
}

export async function removeBlackoutDate(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('machine_blackout_dates').delete().eq('id', id)
    if (error) throw error
  }
}

export async function createMachine(
  ownerId: string,
  input: MachineInput,
  imagePath: string | null = null,
): Promise<MachineCard> {
  const primaryLoc = input.locations.find((l) => l.is_primary) || input.locations[0] || {
    village: 'Mandya',
    district: 'Mandya',
    state: 'Karnataka',
  }

  let newId = `m-${crypto.randomUUID()}`
  const now = new Date().toISOString()

  // With a database connection the machine is saved there FIRST. If that fails the error reaches
  // the form, so an owner never sees a machine that farmers cannot find.
  if (supabase) {
    const payload: Record<string, unknown> = {
      owner_id: ownerId,
      machine_type: input.machine_type,
      model: input.model,
      price_per_acre: input.price_per_acre,
      pricing_unit: input.pricing_unit || 'per_acre',
      crops: input.crops,
      phone: input.phone,
      latitude: input.latitude,
      longitude: input.longitude,
      image_path: imagePath,
    }

    let { data, error } = await supabase.from('machines').insert(payload).select('id').single()

    if (error && error.message?.includes('pricing_unit')) {
      delete payload.pricing_unit
      const fallback = await supabase.from('machines').insert(payload).select('id').single()
      data = fallback.data
      error = fallback.error
    }

    if (error || !data?.id) {
      throw error ?? new Error('The machine could not be saved.')
    }

    newId = data.id as string
    await setMachineLocations(newId, input.locations)
  }

  const card: MachineCard = {
    id: newId,
    owner_id: ownerId,
    machine_type: input.machine_type,
    model: input.model,
    price_per_acre: input.price_per_acre,
    pricing_unit: input.pricing_unit || 'per_acre',
    crops: input.crops,
    phone: input.phone,
    latitude: input.latitude,
    longitude: input.longitude,
    image_path: imagePath,
    is_active: true,
    created_at: now,
    updated_at: now,
    owner_name: 'Machine Owner',
    village: primaryLoc.village,
    district: primaryLoc.district,
    state: primaryLoc.state,
    service_villages: input.locations.map((l) => l.village),
  }

  // Local copy: used for instant UI and as the only store when no database is configured.
  addLocalMachine(card)

  return card
}

export async function updateMachine(
  machineId: string,
  input: MachineInput,
  imagePath?: string | null,
): Promise<void> {
  const patch: Partial<MachineCard> = {
    machine_type: input.machine_type,
    model: input.model,
    price_per_acre: input.price_per_acre,
    pricing_unit: input.pricing_unit || 'per_acre',
    crops: input.crops,
    phone: input.phone,
    latitude: input.latitude,
    longitude: input.longitude,
    service_villages: input.locations.map((l) => l.village),
  }
  if (imagePath !== undefined) patch.image_path = imagePath

  if (supabase) {
    const dbPatch: Record<string, unknown> = {
      machine_type: input.machine_type,
      model: input.model,
      price_per_acre: input.price_per_acre,
      pricing_unit: input.pricing_unit || 'per_acre',
      crops: input.crops,
      phone: input.phone,
      latitude: input.latitude,
      longitude: input.longitude,
    }
    if (imagePath !== undefined) dbPatch.image_path = imagePath

    let { error } = await supabase.from('machines').update(dbPatch).eq('id', machineId)
    if (error && error.message?.includes('pricing_unit')) {
      delete dbPatch.pricing_unit
      const retry = await supabase.from('machines').update(dbPatch).eq('id', machineId)
      error = retry.error
    }
    if (error) throw error

    await setMachineLocations(machineId, input.locations)
  }

  updateLocalMachine(machineId, patch)
}

export async function setMachineLocations(
  machineId: string,
  locations: Array<{ village: string; district: string; state: string; is_primary: boolean }>,
): Promise<void> {
  if (supabase) {
    const { error } = await supabase.rpc('set_machine_locations', {
      p_machine_id: machineId,
      p_locations: locations,
    })
    if (error) throw error
  }
}

export async function setMachineImagePath(
  machineId: string,
  imagePath: string | null,
): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('machines').update({ image_path: imagePath }).eq('id', machineId)
    if (error) throw error
  }
  updateLocalMachine(machineId, { image_path: imagePath })
}

export async function setMachineActive(machineId: string, isActive: boolean): Promise<void> {
  if (supabase) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(machineId)
    if (isUuid) {
      // select() returns the changed rows, so a silently blocked update (0 rows) is detected.
      const { data, error } = await supabase
        .from('machines')
        .update({ is_active: isActive })
        .eq('id', machineId)
        .select('id')
      if (error) {
        logError('machine.setMachineActive', error)
        throw error
      }
      if (!data || data.length === 0) {
        throw new Error('HR_NOT_FOUND: machine was not updated')
      }
    }
  }
  updateLocalMachine(machineId, { is_active: isActive })
}

export async function deleteMachine(machineId: string, ownerId?: string): Promise<void> {
  const local = getLocalMachines().find((m) => m.id === machineId)
  const effectiveOwner = ownerId || local?.owner_id
  const imagePath = local?.image_path

  // 1. If backend database is configured, perform and verify server-side deletion FIRST
  if (supabase) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(machineId)
    if (isUuid) {
      // The delete_machine function checks the owner, cancels pending requests, marks the machine
      // deleted (hidden and not bookable) and keeps booking history. Any error stops here:
      // there is NO fallback, so we never report success when the server refused.
      const { data: result, error: rpcError } = await supabase.rpc('delete_machine', {
        p_machine_id: machineId,
      })

      if (rpcError) {
        logError('machine.delete.rpc', rpcError)
        throw rpcError
      }
      const confirmed = result as { ok?: boolean } | boolean | null
      const isConfirmed =
        confirmed === true ||
        (typeof confirmed === 'object' && confirmed !== null && confirmed.ok === true)
      if (!isConfirmed) {
        throw new Error('HR_DELETE_FAILED: Server could not confirm the machine was deleted')
      }

      // Double check with the server: the public list must no longer contain this machine.
      try {
        const verifyQuery = supabase.from('machine_cards')
        if (verifyQuery && typeof verifyQuery.select === 'function') {
          const { data: stillVisible, error: verifyError } = await verifyQuery
            .select('id')
            .eq('id', machineId)
            .maybeSingle()
          if (verifyError) {
            logError('machine.delete.verify', verifyError)
            throw verifyError
          }
          if (stillVisible) {
            throw new Error('HR_DELETE_FAILED: Machine is still listed on the server')
          }
        }
      } catch (verifyErr) {
        if (verifyErr instanceof Error && verifyErr.message.includes('HR_DELETE_FAILED')) {
          throw verifyErr
        }
      }
    }
  }

  // 2. Server confirmed state change: now purge from client storage & broadcast
  markMachineDeleted(machineId)

  // 3. Clean up storage image separately without blocking deletion
  if (imagePath && effectiveOwner) {
    void deleteMachineImage(imagePath, effectiveOwner).catch((err) => {
      console.warn('Storage image cleanup non-fatal failure:', err)
    })
  }
}
