import { requireSupabase } from '../lib/supabase'
import type {
  CreateDriverRequestInput,
  DriverCard,
  DriverProfile,
  DriverProfileInput,
  DriverRequestRow,
  DriverSearchFilters,
} from '../types'

const DEFAULT_LIMIT = 30

function asList<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : []
}

/** The signed-in person's own driver profile, or null if they never made one. */
export async function getMyDriverProfile(userId: string): Promise<DriverProfile | null> {
  const { data, error } = await requireSupabase()
    .from('driver_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as DriverProfile | null) ?? null
}

export async function saveDriverProfile(input: DriverProfileInput): Promise<void> {
  const { error } = await requireSupabase().rpc('save_driver_profile', {
    p_experience_years: input.experienceYears,
    p_machine_types: input.machineTypes,
    p_crops: input.crops,
    p_village: input.village,
    p_district: input.district,
    p_state: input.state,
    p_phone: input.phone,
    p_rate_amount: input.rateAmount,
    p_rate_unit: input.rateUnit,
    p_bio: input.bio,
    p_is_active: input.isActive,
    p_is_available: input.isAvailable,
    p_phone_public: input.phonePublic,
  })
  if (error) throw error
}

export async function setDriverStatus(isActive: boolean, isAvailable: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('set_driver_status', {
    p_is_active: isActive,
    p_is_available: isAvailable,
  })
  if (error) throw error
}

export async function searchDrivers(filters: DriverSearchFilters = {}): Promise<DriverCard[]> {
  const { data, error } = await requireSupabase().rpc('search_drivers', {
    p_village: filters.village?.trim() || null,
    p_district: filters.district?.trim() || null,
    p_state: filters.state?.trim() || null,
    p_machine_type: filters.machineType || null,
    p_crop: filters.crop || null,
    p_min_experience: filters.minExperience && filters.minExperience > 0 ? filters.minExperience : null,
    p_limit: filters.limit ?? DEFAULT_LIMIT,
    p_offset: filters.offset ?? 0,
  })
  if (error) throw error
  return asList<DriverCard>(data)
}

export async function getDriver(driverId: string): Promise<DriverCard | null> {
  const { data, error } = await requireSupabase().rpc('get_driver', { p_driver_id: driverId })
  if (error) throw error
  const rows = asList<DriverCard>(data)
  if (rows.length > 0) return rows[0]
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const single = data as DriverCard
    return single.user_id ? single : null
  }
  return null
}

export async function createDriverRequest(input: CreateDriverRequestInput): Promise<void> {
  const { error } = await requireSupabase().rpc('create_driver_request', {
    p_driver_id: input.driverId,
    p_machine_type: input.machineType,
    p_service_date: input.serviceDate,
    p_days: input.days,
    p_village: input.village,
    p_crop: input.crop,
    p_contact_phone: input.contactPhone,
    p_notes: input.notes,
  })
  if (error) throw error
}

export async function respondToDriverRequest(
  requestId: string,
  decision: 'accepted' | 'declined',
  note: string | null,
): Promise<void> {
  const { error } = await requireSupabase().rpc('respond_to_driver_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note,
  })
  if (error) throw error
}

export async function cancelDriverRequest(requestId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('cancel_driver_request', {
    p_request_id: requestId,
  })
  if (error) throw error
}

export async function rateDriver(
  requestId: string,
  stars: number,
  comment: string | null,
): Promise<void> {
  const { error } = await requireSupabase().rpc('rate_driver', {
    p_request_id: requestId,
    p_stars: stars,
    p_comment: comment,
  })
  if (error) throw error
}

/** 'requester' = hires I sent; 'driver' = requests people sent to me. */
export async function listDriverRequests(
  as: 'requester' | 'driver',
): Promise<DriverRequestRow[]> {
  const { data, error } = await requireSupabase().rpc('list_driver_requests', { p_as: as })
  if (error) throw error
  return asList<DriverRequestRow>(data)
}
