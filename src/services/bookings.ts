import { requireSupabase } from '../lib/supabase'
import type { Booking, BookingStatus, BookingWithRelations, CreateBookingInput } from '../types'

const BOOKING_SELECT = `
  *,
  machine:machines!bookings_machine_id_fkey(
    id, owner_id, machine_type, model, image_path, phone, is_active, crops, latitude, longitude
  ),
  farmer:profiles!bookings_farmer_id_fkey(full_name),
  owner:profiles!bookings_owner_id_fkey(full_name)
`

// The hidden list is saved per browser in localStorage, so removing a booking only hides it for that user on that device.
const HIDDEN_BOOKINGS_KEY = 'harvest-rentals-hidden-bookings'

export function getHiddenBookingIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(HIDDEN_BOOKINGS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function hideBookingLocally(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const hidden = getHiddenBookingIds()
    hidden.add(id)
    window.localStorage.setItem(HIDDEN_BOOKINGS_KEY, JSON.stringify(Array.from(hidden)))
  } catch {
    // Ignore quota errors
  }
}

export function hideMultipleBookingsLocally(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    const hidden = getHiddenBookingIds()
    for (const id of ids) hidden.add(id)
    window.localStorage.setItem(HIDDEN_BOOKINGS_KEY, JSON.stringify(Array.from(hidden)))
  } catch {
    // Ignore quota errors
  }
}

export async function removeBookingFromHistory(bookingId: string): Promise<void> {
  hideBookingLocally(bookingId)
  try {
    await requireSupabase().from('bookings').delete().eq('id', bookingId)
  } catch {
    // Fallback if RLS restricts table delete
  }
}

export async function clearClosedBookingsFromHistory(bookingIds: string[]): Promise<void> {
  hideMultipleBookingsLocally(bookingIds)
  try {
    for (const id of bookingIds) {
      await requireSupabase().from('bookings').delete().eq('id', id)
    }
  } catch {
    // Fallback if RLS restricts table delete
  }
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const { data, error } = await requireSupabase().rpc('create_booking', {
    p_machine_id: input.machineId,
    p_service_date: input.serviceDate,
    p_village: input.village,
    p_acreage: input.acreage,
    p_crop: input.crop,
    p_contact_phone: input.contactPhone,
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  if (!data) throw new Error('HR_NOT_FOUND: booking was not created')
  return data as Booking
}

export async function getFarmerBookings(farmerId: string): Promise<BookingWithRelations[]> {
  const { data, error } = await requireSupabase()
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('farmer_id', farmerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const hidden = getHiddenBookingIds()
  return ((data ?? []) as BookingWithRelations[]).filter((b) => !hidden.has(b.id))
}

export async function getOwnerBookings(ownerId: string): Promise<BookingWithRelations[]> {
  const { data, error } = await requireSupabase()
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const hidden = getHiddenBookingIds()
  return ((data ?? []) as BookingWithRelations[]).filter((b) => !hidden.has(b.id))
}

export async function getBooking(
  bookingId: string,
): Promise<BookingWithRelations | null> {
  const { data, error } = await requireSupabase()
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('id', bookingId)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as BookingWithRelations | null
}

export async function respondToBooking(
  bookingId: string,
  decision: Extract<BookingStatus, 'confirmed' | 'rejected'>,
  note?: string,
): Promise<Booking> {
  const { data, error } = await requireSupabase().rpc('respond_to_booking', {
    p_booking_id: bookingId,
    p_decision: decision,
    p_note: note?.trim() || null,
  })
  if (error) throw error
  if (!data) throw new Error('HR_NOT_FOUND: booking was not updated')
  return data as Booking
}

export async function cancelBooking(bookingId: string): Promise<Booking> {
  const { data, error } = await requireSupabase().rpc('cancel_booking', {
    p_booking_id: bookingId,
  })
  if (error) throw error
  if (!data) throw new Error('HR_NOT_FOUND: booking was not updated')
  return data as Booking
}

export function subscribeToBookings(
  userId: string,
  role: 'farmer' | 'owner',
  onChange: () => void,
  /** Distinct scopes get distinct realtime channels; a channel cannot be shared once subscribed. */
  scope = 'list',
): () => void {
  try {
    const client = requireSupabase()
    const column = role === 'farmer' ? 'farmer_id' : 'owner_id'
    const channelId = `bookings-${role}-${userId}-${scope}-${Math.random().toString(36).slice(2, 7)}`
    const channel = client
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `${column}=eq.${userId}`,
        },
        onChange,
      )
      .subscribe()
    return () => {
      try {
        void client.removeChannel(channel)
      } catch {
        // cleanup safety
      }
    }
  } catch (err) {
    console.warn('Realtime bookings subscription skipped:', err)
    return () => {}
  }
}
