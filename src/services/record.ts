import { requireSupabase } from '../lib/supabase'
import type { Booking, MyRecord } from '../types'

/** Loads the signed-in user's work/spending record (all-time or for a specific year). */
export async function getMyRecord(year?: number): Promise<MyRecord> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_my_record', {
    p_year: year ?? null,
  })
  if (error) throw error
  return data as MyRecord
}

/** Updates the hours worked on a completed booking (owner only). */
export async function setWorkHours(bookingId: string, hours: number): Promise<Booking> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('set_work_hours', {
    p_booking_id: bookingId,
    p_hours: hours,
  })
  if (error) throw error
  return data as Booking
}
