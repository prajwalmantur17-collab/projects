import { requireSupabase } from '../lib/supabase'
import type { Booking, MachineStatus, PaymentMethod, WorkPhase } from '../types'

/** Where an accepted booking is: not started, working now, or finished. */
export function workPhase(
  booking: Pick<Booking, 'status' | 'work_started_at' | 'completed_at'>,
): WorkPhase | null {
  if (booking.status !== 'confirmed') return null
  if (booking.completed_at) return 'completed'
  if (booking.work_started_at) return 'working'
  return 'accepted'
}

export async function startWork(
  bookingId: string,
  expectedFreeAt?: string | null,
): Promise<Booking> {
  const { data, error } = await requireSupabase().rpc('start_work', {
    p_booking_id: bookingId,
    p_expected_free_at: expectedFreeAt ?? null,
  })
  if (error) throw error
  if (!data) throw new Error('HR_NOT_FOUND: booking was not updated')
  return data as Booking
}

export async function completeWork(
  bookingId: string,
  payment?: { amount: number; method: PaymentMethod } | null,
): Promise<Booking> {
  const { data, error } = await requireSupabase().rpc('complete_work', {
    p_booking_id: bookingId,
    p_amount: payment ? payment.amount : null,
    p_payment_method: payment ? payment.method : null,
  })
  if (error) throw error
  if (!data) throw new Error('HR_NOT_FOUND: booking was not updated')
  return data as Booking
}

export async function recordPayment(
  bookingId: string,
  amount: number,
  method: PaymentMethod,
): Promise<Booking> {
  const { data, error } = await requireSupabase().rpc('record_payment', {
    p_booking_id: bookingId,
    p_amount: amount,
    p_payment_method: method,
  })
  if (error) throw error
  if (!data) throw new Error('HR_NOT_FOUND: booking was not updated')
  return data as Booking
}

export async function joinWaitlist(machineId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('join_waitlist', { p_machine_id: machineId })
  if (error) throw error
}

export async function leaveWaitlist(machineId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('leave_waitlist', { p_machine_id: machineId })
  if (error) throw error
}

const FREE: MachineStatus = { busy: false, expected_free_at: null, booked_dates: [], on_waitlist: false }

/**
 * Busy flag, booked dates and the caller's waiting state for one machine.
 * Never throws: if the database function is not installed yet the machine simply
 * looks free, so the page keeps working.
 */
export async function getMachineStatus(machineId: string): Promise<MachineStatus> {
  try {
    const { data, error } = await requireSupabase().rpc('get_machine_status', {
      p_machine_id: machineId,
    })
    if (error || !data) return FREE
    const raw = data as Partial<MachineStatus>
    return {
      busy: Boolean(raw.busy),
      expected_free_at: raw.expected_free_at ?? null,
      booked_dates: Array.isArray(raw.booked_dates) ? raw.booked_dates : [],
      on_waitlist: Boolean(raw.on_waitlist),
    }
  } catch {
    return FREE
  }
}

/** Machines that are working right now, keyed by machine id. Never throws. */
export async function getBusyMachines(): Promise<Map<string, string | null>> {
  const busy = new Map<string, string | null>()
  try {
    const { data, error } = await requireSupabase().rpc('busy_machine_ids')
    if (error || !Array.isArray(data)) return busy
    for (const row of data as Array<{ machine_id: string; expected_free_at: string | null }>) {
      busy.set(row.machine_id, row.expected_free_at ?? null)
    }
  } catch {
    // ignore: machines simply look free
  }
  return busy
}
