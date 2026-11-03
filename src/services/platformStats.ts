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

export async function fetchPlatformStats(): Promise<PlatformStats | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase.rpc('get_platform_stats')
    if (!error && data) {
      return data as PlatformStats
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

    return {
      total_machines: machineCount ?? 0,
      available_machines: machineCount ?? 0,
      total_farmers: 0,
      total_users: 0,
      confirmed_bookings: 0,
    }
  } catch {
    return null
  }
}

export async function fetchLatestMachineActivity(): Promise<LatestActivity | null> {
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
      return (active as LatestActivity) ?? null
    }
  } catch {
    // ignore
  }

  return null
}
