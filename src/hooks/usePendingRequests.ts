import { useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabase'
import { subscribeToBookings } from '../services/bookings'

/** How many booking requests are waiting for this owner. Updates live. Never throws. */
export function usePendingRequests(ownerId: string | undefined): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!ownerId) return
    let alive = true

    const load = async () => {
      try {
        const { count: total, error } = await requireSupabase()
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', ownerId)
          .eq('status', 'pending')
        if (alive && !error) setCount(total ?? 0)
      } catch {
        // The badge is a convenience: ignore failures.
      }
    }

    void load()
    let stop: (() => void) | null = null
    try {
      stop = subscribeToBookings(ownerId, 'owner', () => void load(), 'nav-badge')
    } catch {
      stop = null
    }
    return () => {
      alive = false
      stop?.()
    }
  }, [ownerId])

  return ownerId ? count : 0
}
