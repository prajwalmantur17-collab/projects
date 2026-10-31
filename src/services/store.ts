import type { MachineCard } from '../types'

const STORAGE_KEY = 'harvest-rentals-custom-machines'
const BROADCAST_CHANNEL = 'harvest-rentals-sync'

const FAKE_IDS = new Set([
  'm1-kubota-mandya',
  'm2-preet-khanna',
  'm3-claas-belagavi',
  'm4-johndeere-karnal',
  'm5-mahindra-reaper-meerut',
  'm6-kartar-shimoga',
  'm7-newholland-baler-moga',
  'm8-bcs-reaper-kolhapur',
])

let memoryMachines: MachineCard[] = []

export function deduplicateMachines(list: MachineCard[]): MachineCard[] {
  if (!Array.isArray(list)) return []
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()
  const unique: MachineCard[] = []

  for (const raw of list) {
    if (!raw || typeof raw !== 'object' || !raw.id) continue

    // Strip out any legacy fake mock machines
    if (FAKE_IDS.has(raw.id)) continue

    // 1. Deduplicate by unique ID
    if (seenIds.has(raw.id)) continue

    const village = String(raw.village || '').trim()
    const district = String(raw.district || '').trim()
    const state = String(raw.state || '').trim()
    const model = raw.model ? String(raw.model).trim() : null
    const phone = String(raw.phone || '').trim()

    // 2. Deduplicate by unique phone + model + village
    const compositeKey = `${phone}-${(model || '').toLowerCase()}-${village.toLowerCase()}`
    if (compositeKey && seenKeys.has(compositeKey)) continue

    seenIds.add(raw.id)
    if (compositeKey) seenKeys.add(compositeKey)

    // Ensure all array and string fields are 100% resilient against null/undefined
    const sanitized: MachineCard = {
      ...raw,
      village: village || district || 'Local',
      district: district || village || 'Local',
      state: state || 'India',
      model,
      phone,
      crops: Array.isArray(raw.crops) ? raw.crops.filter(Boolean) : [],
      service_villages: Array.isArray(raw.service_villages)
        ? raw.service_villages.filter((v): v is string => typeof v === 'string' && Boolean(v.trim()))
        : [],
      price_per_acre:
        typeof raw.price_per_acre === 'number'
          ? raw.price_per_acre
          : Number(raw.price_per_acre) || 0,
      pricing_unit:
        raw.pricing_unit === 'per_hour' || raw.pricing_unit === 'per_day'
          ? raw.pricing_unit
          : 'per_acre',
      is_active: raw.is_active !== false,
      owner_name: raw.owner_name ? String(raw.owner_name) : 'Machine Owner',
    }

    unique.push(sanitized)
  }

  return unique
}

function loadFromStorage(): MachineCard[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MachineCard[]
    // Filter out any fake machines
    const clean = deduplicateMachines(parsed)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
    return clean
  } catch {
    return []
  }
}

export function saveMachinesToStorage(machines: MachineCard[]) {
  if (typeof window === 'undefined') return
  try {
    const unique = deduplicateMachines(machines)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique))
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL)
      channel.postMessage({ type: 'MACHINES_UPDATED', timestamp: Date.now() })
      channel.close()
    }
  } catch (err) {
    console.warn('Could not persist machines to localStorage:', err)
  }
}

export function getLocalMachines(): MachineCard[] {
  if (memoryMachines.length === 0) {
    memoryMachines = loadFromStorage()
  }
  return deduplicateMachines(memoryMachines)
}

export function addLocalMachine(machine: MachineCard) {
  const current = getLocalMachines()
  const updated = deduplicateMachines([machine, ...current.filter((m) => m.id !== machine.id)])
  memoryMachines = updated
  saveMachinesToStorage(updated)
  return machine
}

export function updateLocalMachine(machineId: string, patch: Partial<MachineCard>) {
  const current = getLocalMachines()
  const updated = deduplicateMachines(
    current.map((m) =>
      m.id === machineId ? { ...m, ...patch, updated_at: new Date().toISOString() } : m,
    ),
  )
  memoryMachines = updated
  saveMachinesToStorage(updated)
}

export function deleteLocalMachine(machineId: string) {
  const current = getLocalMachines()
  const updated = current.filter((m) => m.id !== machineId)
  memoryMachines = updated
  saveMachinesToStorage(updated)
}

// Clean up any fake machines stored in localStorage on initial script execution
if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MachineCard[]
      const cleaned = parsed.filter((m) => !FAKE_IDS.has(m.id))
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
      memoryMachines = cleaned
    }
  } catch {
    // ignore
  }

  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL)
      channel.onmessage = (event) => {
        if (event.data?.type === 'MACHINES_UPDATED') {
          memoryMachines = loadFromStorage()
        }
      }
    } catch {
      // ignore
    }
  }
}
