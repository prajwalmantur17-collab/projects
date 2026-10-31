import type { TranslationKey } from '../i18n/en'
import { CROP_KEYS, MAX_IMAGE_BYTES, MAX_VILLAGES, ACCEPTED_IMAGE_TYPES, isCropKey, isMachineType } from './constants'

export type FieldErrors = Record<string, TranslationKey>

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Keeps the last 10 digits, dropping +91 / 0 prefixes and separators. */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export function isValidPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(value))
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function telHref(value: string): string {
  return `tel:+91${normalizePhone(value)}`
}

export function whatsappHref(value: string, message?: string): string {
  const base = `https://wa.me/91${normalizePhone(value)}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export function todayIsoInIndia(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

export function addYearsIso(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year + years, month - 1, day))
  return date.toISOString().slice(0, 10)
}

export function validateServiceDate(
  value: string,
  today: string = todayIsoInIndia(),
): TranslationKey | null {
  if (!value) return 'validation.required'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'validation.date'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'validation.date'
  if (value < today) return 'validation.date'
  if (value > addYearsIso(today, 1)) return 'validation.dateTooFar'
  return null
}

export function parsePositiveNumber(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '')
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export interface MachineFormValues {
  machineType: string
  model: string
  pricePerAcre: string
  pricingUnit?: 'per_acre' | 'per_hour' | 'per_day'
  crops: string[]
  primaryVillage: string
  district: string
  state: string
  phone: string
  extraVillages: string[]
}

export interface MachineFormParsed {
  machineType: string
  model: string | null
  pricePerAcre: number
  pricingUnit: 'per_acre' | 'per_hour' | 'per_day'
  crops: string[]
  locations: { village: string; district: string; state: string; is_primary: boolean }[]
  phone: string
}

export function parseVillageList(raw: string): string[] {
  return raw
    .split(',')
    .map(normalizeWhitespace)
    .filter(Boolean)
}

export function validateMachineForm(
  values: MachineFormValues,
): { errors: FieldErrors; parsed: MachineFormParsed | null } {
  const errors: FieldErrors = {}
  const primaryVillage = normalizeWhitespace(values.primaryVillage)
  const district = normalizeWhitespace(values.district)
  const state = normalizeWhitespace(values.state)
  const phone = normalizePhone(values.phone)
  const model = normalizeWhitespace(values.model)

  if (!values.machineType) {
    errors.machineType = 'validation.machineType'
  } else if (!isMachineType(values.machineType)) {
    errors.machineType = 'validation.machineType'
  }

  if (model.length > 80) errors.model = 'validation.model'

  const price = parsePositiveNumber(values.pricePerAcre)
  if (price === null || price < 1 || price > 1_000_000) {
    errors.pricePerAcre = 'validation.price'
  }

  const crops = values.crops.filter(isCropKey)
  if (crops.length === 0) errors.crops = 'validation.crops'
  if (crops.length > CROP_KEYS.length) errors.crops = 'validation.crops'

  if (primaryVillage.length < 2 || primaryVillage.length > 80) {
    errors.primaryVillage = 'validation.village'
  }
  if (district.length < 2 || district.length > 80) {
    errors.district = 'validation.district'
  }
  if (state.length < 2 || state.length > 80) {
    errors.state = 'validation.state'
  }
  if (!isValidPhone(phone)) {
    errors.phone = 'validation.phone'
  }

  const extras = values.extraVillages
    .map(normalizeWhitespace)
    .filter(Boolean)
  if (extras.some((village) => village.length < 2 || village.length > 80)) {
    errors.extraVillages = 'validation.village'
  }
  if (extras.length + 1 > MAX_VILLAGES) {
    errors.extraVillages = 'validation.tooManyVillages'
  }

  const seen = new Set<string>()
  const duplicates = extras.some((village) => {
    const key = village.toLowerCase()
    if (key === primaryVillage.toLowerCase() || seen.has(key)) return true
    seen.add(key)
    return false
  })
  if (duplicates && !errors.extraVillages) {
    errors.extraVillages = 'machine.villageDuplicate'
  }

  if (Object.keys(errors).length > 0) {
    return { errors, parsed: null }
  }

  const locations = [
    { village: primaryVillage, district, state, is_primary: true },
    ...extras.map((village) => ({ village, district, state, is_primary: false })),
  ]

  const pricingUnit =
    values.pricingUnit === 'per_hour' || values.pricingUnit === 'per_day'
      ? values.pricingUnit
      : 'per_acre'

  return {
    errors,
    parsed: {
      machineType: values.machineType,
      model: model || null,
      pricePerAcre: price as number,
      pricingUnit,
      crops,
      locations,
      phone,
    },
  }
}

export interface BookingFormValues {
  serviceDate: string
  village: string
  acreage: string
  crop: string
  phone: string
  notes: string
}

export interface BookingFormParsed {
  serviceDate: string
  village: string
  acreage: number
  crop: string
  phone: string
  notes: string | null
}

export function validateBookingForm(
  values: BookingFormValues,
  options: { allowedCrops?: string[]; today?: string } = {},
): { errors: FieldErrors; parsed: BookingFormParsed | null } {
  const errors: FieldErrors = {}
  const village = normalizeWhitespace(values.village)
  const phone = normalizePhone(values.phone)
  const acreage = parsePositiveNumber(values.acreage)
  const notes = normalizeWhitespace(values.notes)
  const crop = values.crop

  const dateError = validateServiceDate(values.serviceDate, options.today)
  if (dateError) errors.serviceDate = dateError

  if (village.length < 2 || village.length > 80) errors.village = 'validation.village'
  if (acreage === null || acreage < 0.1 || acreage > 500) errors.acreage = 'validation.acreage'
  if (!isValidPhone(phone)) errors.phone = 'validation.phone'
  if (notes.length > 500) errors.notes = 'validation.notes'
  if (!crop) {
    errors.crop = 'validation.cropRequired'
  } else if (options.allowedCrops && !options.allowedCrops.includes(crop)) {
    errors.crop = 'booking.error.crop'
  }

  if (Object.keys(errors).length > 0) {
    return { errors, parsed: null }
  }

  return {
    errors,
    parsed: {
      serviceDate: values.serviceDate,
      village,
      acreage: acreage as number,
      crop,
      phone,
      notes: notes || null,
    },
  }
}

export interface ProfileFormValues {
  fullName: string
  village: string
  district: string
  state: string
}

export function validateProfileForm(values: ProfileFormValues): {
  errors: FieldErrors
  parsed: { fullName: string; village: string | null; district: string | null; state: string | null } | null
} {
  const errors: FieldErrors = {}
  const fullName = normalizeWhitespace(values.fullName)
  const village = normalizeWhitespace(values.village)
  const district = normalizeWhitespace(values.district)
  const state = normalizeWhitespace(values.state)

  if (fullName.length < 2 || fullName.length > 120) errors.fullName = 'validation.name'
  if (village && (village.length < 2 || village.length > 80)) errors.village = 'validation.village'
  if (district && (district.length < 2 || district.length > 80)) {
    errors.district = 'validation.district'
  }
  if (state && (state.length < 2 || state.length > 80)) errors.state = 'validation.state'

  if (Object.keys(errors).length > 0) return { errors, parsed: null }

  return {
    errors,
    parsed: {
      fullName,
      village: village || null,
      district: district || null,
      state: state || null,
    },
  }
}

export function validateVillageSearch(value: string): TranslationKey | null {
  const village = normalizeWhitespace(value)
  if (!village) return 'validation.required'
  if (village.length < 2 || village.length > 80) return 'validation.village'
  return null
}

export function validateImageFile(file: File): TranslationKey | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'machine.photoTypeError'
  }
  if (file.size > MAX_IMAGE_BYTES) return 'machine.photoSizeError'
  return null
}
