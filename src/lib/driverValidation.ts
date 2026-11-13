import { CROP_KEYS, MACHINE_TYPES, isCropKey, isMachineType } from './constants'
import type { FieldErrors } from './validation'
import {
  isValidPhone,
  normalizePhone,
  normalizeWhitespace,
  parsePositiveNumber,
  validateServiceDate,
} from './validation'
import type { CreateDriverRequestInput, DriverProfileInput, DriverRateUnit } from '../types'

export interface DriverFormValues {
  experienceYears: string
  machineTypes: string[]
  crops: string[]
  village: string
  district: string
  state: string
  phone: string
  rateAmount: string
  rateUnit: string
  bio: string
  isActive: boolean
  isAvailable: boolean
  phonePublic: boolean
}

function isRateUnit(value: string): value is DriverRateUnit {
  return value === 'per_acre' || value === 'per_hour' || value === 'per_day'
}

export function validateDriverForm(
  values: DriverFormValues,
): { errors: FieldErrors; parsed: DriverProfileInput | null } {
  const errors: FieldErrors = {}
  const village = normalizeWhitespace(values.village)
  const district = normalizeWhitespace(values.district)
  const state = normalizeWhitespace(values.state)
  const phone = normalizePhone(values.phone)
  const bio = values.bio.trim()

  const experienceRaw = values.experienceYears.trim()
  const experience = /^\d{1,2}$/.test(experienceRaw) ? Number(experienceRaw) : null
  if (experience === null || experience > 60) errors.experienceYears = 'drivers.error.experience'

  const machineTypes = values.machineTypes.filter(isMachineType)
  if (machineTypes.length < 1 || machineTypes.length > MACHINE_TYPES.length) {
    errors.machineTypes = 'drivers.error.machines'
  }

  const crops = values.crops.filter(isCropKey)
  if (crops.length > CROP_KEYS.length) errors.crops = 'validation.crops'

  if (village.length < 2 || village.length > 80) errors.village = 'validation.village'
  if (district.length < 2 || district.length > 80) errors.district = 'validation.district'
  if (state.length < 2 || state.length > 80) errors.state = 'validation.state'
  if (!isValidPhone(phone)) errors.phone = 'validation.phone'
  if (bio.length > 300) errors.bio = 'drivers.error.bio'

  const rateRaw = values.rateAmount.trim()
  let rateAmount: number | null = null
  let rateUnit: DriverRateUnit | null = null
  if (rateRaw) {
    const parsed = parsePositiveNumber(rateRaw)
    if (parsed === null || parsed < 1 || parsed > 1_000_000) {
      errors.rateAmount = 'drivers.error.rate'
    } else if (!isRateUnit(values.rateUnit)) {
      errors.rateUnit = 'drivers.error.rateUnit'
    } else {
      rateAmount = parsed
      rateUnit = values.rateUnit
    }
  }

  if (Object.keys(errors).length > 0) return { errors, parsed: null }

  return {
    errors,
    parsed: {
      experienceYears: experience as number,
      machineTypes,
      crops,
      village,
      district,
      state,
      phone,
      rateAmount,
      rateUnit,
      bio: bio || null,
      isActive: values.isActive,
      isAvailable: values.isAvailable,
      phonePublic: values.phonePublic,
    },
  }
}

export interface HireFormValues {
  machineType: string
  serviceDate: string
  days: string
  village: string
  crop: string
  phone: string
  notes: string
}

export function validateHireForm(
  driverId: string,
  values: HireFormValues,
  options: { allowedMachines?: string[]; today?: string } = {},
): { errors: FieldErrors; parsed: CreateDriverRequestInput | null } {
  const errors: FieldErrors = {}
  const village = normalizeWhitespace(values.village)
  const phone = normalizePhone(values.phone)
  const notes = normalizeWhitespace(values.notes)

  if (!isMachineType(values.machineType)) {
    errors.machineType = 'validation.machineType'
  } else if (options.allowedMachines && !options.allowedMachines.includes(values.machineType)) {
    errors.machineType = 'drivers.error.machineNotSkilled'
  }

  const dateError = validateServiceDate(values.serviceDate, options.today)
  if (dateError) errors.serviceDate = dateError

  const daysRaw = values.days.trim()
  const days = /^\d{1,2}$/.test(daysRaw) ? Number(daysRaw) : null
  if (days === null || days < 1 || days > 60) errors.days = 'drivers.error.days'

  if (village.length < 2 || village.length > 80) errors.village = 'validation.village'
  if (values.crop && !isCropKey(values.crop)) errors.crop = 'validation.cropRequired'
  if (!isValidPhone(phone)) errors.phone = 'validation.phone'
  if (notes.length > 500) errors.notes = 'validation.notes'

  if (Object.keys(errors).length > 0) return { errors, parsed: null }

  return {
    errors,
    parsed: {
      driverId,
      machineType: values.machineType as CreateDriverRequestInput['machineType'],
      serviceDate: values.serviceDate,
      days: days as number,
      village,
      crop: values.crop ? (values.crop as CreateDriverRequestInput['crop']) : null,
      contactPhone: phone,
      notes: notes || null,
    },
  }
}
