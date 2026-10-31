export type Language = 'en' | 'kn' | 'hi'

export type UserRole = 'farmer' | 'owner'

export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled'

export type NotificationKind =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_rejected'
  | 'booking_cancelled'

export type MachineType =
  | 'combine_harvester'
  | 'tractor_harvester'
  | 'reaper'
  | 'thresher'
  | 'baler'
  | 'other'

export type CropKey =
  | 'wheat'
  | 'rice'
  | 'maize'
  | 'sugarcane'
  | 'cotton'
  | 'soybean'
  | 'groundnut'
  | 'millet'
  | 'barley'
  | 'mustard'
  | 'chickpea'
  | 'pigeon_pea'

export interface Profile {
  id: string
  full_name: string
  role: UserRole | null
  preferred_language: Language
  village: string | null
  district: string | null
  state: string | null
  created_at: string
  updated_at: string
}

export type PricingUnit = 'per_acre' | 'per_hour' | 'per_day'

/** A machine row joined with its owner name and service villages (DB view). */
export interface MachineCard {
  id: string
  owner_id: string
  machine_type: MachineType
  model: string | null
  price_per_acre: number
  pricing_unit?: PricingUnit
  crops: CropKey[]
  phone: string
  latitude: number | null
  longitude: number | null
  image_path: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  owner_name: string
  village: string
  district: string
  state: string
  service_villages: string[]
}

export interface MachineLocation {
  id: string
  machine_id: string
  village: string
  district: string
  state: string
  is_primary: boolean
}

export interface MachineBlackoutDate {
  id: string
  machine_id: string
  unavailable_on: string
}

export interface Booking {
  id: string
  machine_id: string
  farmer_id: string
  owner_id: string
  service_date: string
  village: string
  acreage: number
  crop: string
  contact_phone: string
  notes: string | null
  price_per_acre: number
  status: BookingStatus
  owner_note: string | null
  created_at: string
  updated_at: string
  responded_at: string | null
  cancelled_at: string | null
}

export interface BookingMachineSummary {
  id: string
  owner_id: string
  machine_type: MachineType
  model: string | null
  image_path: string | null
  phone: string
  is_active: boolean
  crops: CropKey[]
}

export interface BookingPerson {
  full_name: string
}

export interface BookingWithRelations extends Booking {
  machine: BookingMachineSummary | null
  farmer: BookingPerson | null
  owner: BookingPerson | null
}

export interface NotificationPayload {
  machine_type?: MachineType
  village?: string
  service_date?: string
  farmer_name?: string
  acreage?: number
}

export interface AppNotification {
  id: string
  user_id: string
  booking_id: string | null
  kind: NotificationKind
  payload: NotificationPayload
  is_read: boolean
  created_at: string
}

export interface ServiceLocationInput {
  village: string
  district: string
  state: string
  is_primary: boolean
}

export interface MachineInput {
  machine_type: MachineType
  model: string | null
  price_per_acre: number
  pricing_unit?: PricingUnit
  crops: CropKey[]
  phone: string
  latitude: number | null
  longitude: number | null
  locations: ServiceLocationInput[]
}

export interface MachineSearchFilters {
  village?: string
  district?: string
  state?: string
  crop?: CropKey | ''
  machineType?: MachineType | ''
  limit?: number
}

export interface CreateBookingInput {
  machineId: string
  serviceDate: string
  village: string
  acreage: number
  crop: CropKey
  contactPhone: string
  notes?: string
}

export interface Coordinates {
  latitude: number
  longitude: number
}

/** Latest position one party (owner or farmer) shared for a confirmed booking. */
export interface LiveLocation {
  booking_id: string
  role: 'owner' | 'farmer'
  owner_id: string
  farmer_id: string
  latitude: number
  longitude: number
  heading: number | null
  updated_at: string
}
