import { requireSupabase } from '../lib/supabase'
import type { Coordinates, LiveLocation } from '../types'

export type LiveLocationChange =
  | { type: 'upsert'; location: LiveLocation }
  | { type: 'delete'; role: LiveLocation['role'] }

/** Sends the caller's position. The server decides whether they are the owner or the farmer. */
export async function pushLiveLocation(
  bookingId: string,
  position: Coordinates,
  heading?: number | null,
): Promise<void> {
  const { error } = await requireSupabase().rpc('share_live_location', {
    p_booking_id: bookingId,
    p_latitude: position.latitude,
    p_longitude: position.longitude,
    p_heading: heading ?? null,
  })
  if (error) throw error
}

export async function stopLiveLocation(bookingId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('stop_live_location', {
    p_booking_id: bookingId,
  })
  if (error) throw error
}

/** Both parties' latest positions for the booking (0, 1 or 2 rows). */
export async function getLiveLocations(bookingId: string): Promise<LiveLocation[]> {
  const { data, error } = await requireSupabase()
    .from('booking_live_locations')
    .select('*')
    .eq('booking_id', bookingId)
  if (error) throw error
  return (data ?? []) as LiveLocation[]
}

export function subscribeToLiveLocations(
  bookingId: string,
  onChange: (change: LiveLocationChange) => void,
): () => void {
  const client = requireSupabase()
  const channel = client
    .channel(`live-location-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_live_locations',
        filter: `booking_id=eq.${bookingId}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as Partial<LiveLocation>
          if (old.role) onChange({ type: 'delete', role: old.role })
        } else {
          onChange({ type: 'upsert', location: payload.new as LiveLocation })
        }
      },
    )
    .subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}
