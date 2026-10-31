import { IMAGE_BUCKET } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { todayIsoInIndia, validateImageFile } from '../lib/validation'
import type { MachineCard, MachineInput } from '../types'
import {
  addLocalMachine,
  deduplicateMachines,
  getLocalMachines,
  updateLocalMachine,
} from './store'

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
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
}): Promise<MachineCard[]> {
  const cleanVillage = (params.village || '').trim()
  const cleanDistrict = (params.district || '').trim()
  const cleanCrop = (params.crop || '').trim().toLowerCase()
  const cleanType = (params.machineType || '').trim().toLowerCase()

  // 1. Try Supabase if available
  if (supabase) {
    try {
      if (cleanVillage || cleanDistrict) {
        // Find machines in the specified village or district
        const { data: primaryData, error } = await supabase.rpc('search_machines', {
          p_village: cleanVillage || null,
          p_district: cleanDistrict || null,
          p_state: null,
          p_crop: params.crop || null,
          p_machine_type: params.machineType || null,
          p_limit: params.limit ?? 48,
          p_offset: params.offset ?? 0,
        })

        if (!error && Array.isArray(primaryData)) {
          let list = deduplicateMachines(primaryData as MachineCard[])

          // If village was searched without district, see if any machine has a district we can broaden to (same district machines)
          if (cleanVillage && !cleanDistrict && list.length > 0) {
            const resolvedDistrict = list[0]?.district
            if (resolvedDistrict) {
              const { data: districtData, error: distErr } = await supabase.rpc('search_machines', {
                p_village: null,
                p_district: resolvedDistrict,
                p_state: null,
                p_crop: params.crop || null,
                p_machine_type: params.machineType || null,
                p_limit: params.limit ?? 48,
                p_offset: 0,
              })
              if (!distErr && Array.isArray(districtData)) {
                list = deduplicateMachines([...list, ...(districtData as MachineCard[])])
              }
            }
          }

          if (list.length > 0) {
            return list
          }
        }
      }
    } catch {
      // Fall through to local fallback
    }
  }

  // 2. Local Resilient Store Search
  const all = getLocalMachines()

  // Filter by crop & machine type first
  const baseCandidates = all.filter((m) => {
    if (!m || !m.is_active) return false
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

  return deduplicateMachines(filtered)
}

export async function getMachineCard(machineId: string): Promise<MachineCard | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('machine_cards')
        .select('*')
        .eq('id', machineId)
        .maybeSingle()
      if (!error && data) return data as MachineCard
    } catch {
      // Fall through
    }
  }

  const local = getLocalMachines().find((m) => m.id === machineId)
  return local ?? null
}

export async function listOwnerMachines(ownerId: string): Promise<MachineCard[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('machine_cards')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
      if (!error && Array.isArray(data)) return data as MachineCard[]
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
    try {
      await supabase
        .from('machine_blackout_dates')
        .insert({ machine_id: machineId, unavailable_on: date })
    } catch {
      // Fall through
    }
  }
}

export async function removeBlackoutDate(id: string): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('machine_blackout_dates').delete().eq('id', id)
    } catch {
      // Fall through
    }
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

  const newId = `m-${crypto.randomUUID()}`
  const now = new Date().toISOString()

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

  // 1. Always save to local reactive store for instant UI response and demo persistence
  addLocalMachine(card)

  // 2. Also try Supabase if connected
  if (supabase) {
    try {
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

      let { data, error } = await supabase
        .from('machines')
        .insert(payload)
        .select('id')
        .single()

      if (error && error.message?.includes('pricing_unit')) {
        delete payload.pricing_unit
        const fallback = await supabase
          .from('machines')
          .insert(payload)
          .select('id')
          .single()
        data = fallback.data
        error = fallback.error
      }

      if (!error && data?.id) {
        await setMachineLocations(data.id, input.locations)
      }
    } catch (err) {
      console.warn('Could not save to Supabase, saved locally:', err)
    }
  }

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

  updateLocalMachine(machineId, patch)

  if (supabase) {
    try {
      await setMachineLocations(machineId, input.locations)
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

      const { error } = await supabase.from('machines').update(dbPatch).eq('id', machineId)
      if (error && error.message?.includes('pricing_unit')) {
        delete dbPatch.pricing_unit
        await supabase.from('machines').update(dbPatch).eq('id', machineId)
      }
    } catch {
      // Fall through
    }
  }
}

export async function setMachineLocations(
  machineId: string,
  locations: Array<{ village: string; district: string; state: string; is_primary: boolean }>,
): Promise<void> {
  if (supabase) {
    try {
      await supabase.rpc('set_machine_locations', {
        p_machine_id: machineId,
        p_locations: locations,
      })
    } catch {
      // Fall through
    }
  }
}

export async function setMachineImagePath(
  machineId: string,
  imagePath: string | null,
): Promise<void> {
  updateLocalMachine(machineId, { image_path: imagePath })
  if (supabase) {
    try {
      await supabase.from('machines').update({ image_path: imagePath }).eq('id', machineId)
    } catch {
      // Fall through
    }
  }
}

export async function setMachineActive(machineId: string, isActive: boolean): Promise<void> {
  updateLocalMachine(machineId, { is_active: isActive })
  if (supabase) {
    try {
      await supabase.from('machines').update({ is_active: isActive }).eq('id', machineId)
    } catch {
      // Fall through
    }
  }
}
