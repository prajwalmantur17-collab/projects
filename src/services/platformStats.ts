import { supabase } from '../lib/supabase'
import { isMachineDeleted } from './store'

export interface PlatformStats {
  total_machines: number
  available_machines: number
  total_farmers: number
  total_users: number
  confirmed_bookings: number
}

export interface LatestActivity {
  id: string
  model: string | null
  machine_type: string
  village: string | null
  district: string | null
  image_path: string | null
  created_at: string
}

const STATS_TTL_MS = 60_000 // 60 seconds
let cachedStats: { data: PlatformStats; timestamp: number } | null = null
let inflightStats: Promise<PlatformStats | null> | null = null

let cachedActivity: { data: LatestActivity | null; timestamp: number } | null = null
let inflightActivity: Promise<LatestActivity | null> | null = null

export function clearPlatformStatsCache(): void {
  cachedStats = null
  inflightStats = null
  cachedActivity = null
  inflightActivity = null
}

export async function fetchPlatformStats(): Promise<PlatformStats | null> {
  const now = Date.now()
  if (cachedStats && now - cachedStats.timestamp < STATS_TTL_MS) {
    return cachedStats.data
  }

  if (inflightStats) {
    return inflightStats
  }

  inflightStats = (async () => {
    if (!supabase) return null

    try {
      const { data, error } = await supabase.rpc('get_platform_stats')
      if (!error && data) {
        const stats = data as PlatformStats
        cachedStats = { data: stats, timestamp: Date.now() }
        return stats
      }
    } catch {
      // Fallback to table count if rpc fails
    }

    try {
      const { count: machineCount, error: countErr } = await supabase
        .from('machines')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_available', true)

      if (countErr) return null

      const fallback: PlatformStats = {
        total_machines: machineCount ?? 0,
        available_machines: machineCount ?? 0,
        total_farmers: 0,
        total_users: 0,
        confirmed_bookings: 0,
      }
      cachedStats = { data: fallback, timestamp: Date.now() }
      return fallback
    } catch {
      return null
    }
  })().finally(() => {
    inflightStats = null
  })

  return inflightStats
}

export async function fetchLatestMachineActivity(): Promise<LatestActivity | null> {
  const now = Date.now()
  if (cachedActivity && now - cachedActivity.timestamp < STATS_TTL_MS) {
    return cachedActivity.data
  }

  if (inflightActivity) {
    return inflightActivity
  }

  inflightActivity = (async () => {
    if (!supabase) return null

    try {
      const { data, error } = await supabase
        .from('machine_cards')
        .select('id, model, machine_type, village, district, image_path, created_at, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && Array.isArray(data) && data.length > 0) {
        const active = data.find((d) => d && d.is_active !== false && !isMachineDeleted(d.id))
        const res = (active as LatestActivity) ?? null
        cachedActivity = { data: res, timestamp: Date.now() }
        return res
      }
    } catch {
      // ignore
    }

    return null
  })().finally(() => {
    inflightActivity = null
  })

  return inflightActivity
}
