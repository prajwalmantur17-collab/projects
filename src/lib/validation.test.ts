import { describe, expect, it } from 'vitest'
import {
  addYearsIso,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  parsePositiveNumber,
  todayIsoInIndia,
  validateBookingForm,
  validateImageFile,
  validateMachineForm,
  validateProfileForm,
  validateServiceDate,
} from './validation'

describe('phone helpers', () => {
  it('normalises Indian prefixes and separators', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210')
    expect(normalizePhone('098765-43210')).toBe('9876543210')
    expect(normalizePhone('9876543210')).toBe('9876543210')
  })

  it('accepts only valid 10 digit mobile numbers', () => {
    expect(isValidPhone('9876543210')).toBe(true)
    expect(isValidPhone('+91 91234 56789')).toBe(true)
    expect(isValidPhone('5876543210')).toBe(false)
    expect(isValidPhone('98765')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepts normal email addresses', () => {
    expect(isValidEmail('farmer@example.com')).toBe(true)
    expect(isValidEmail('  name.tag+tag@example.co.in  ')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(isValidEmail('farmer')).toBe(false)
    expect(isValidEmail('farmer@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('farmer@example')).toBe(false)
    expect(isValidEmail('farmer @example.com')).toBe(false)
  })
})

describe('date helpers', () => {
  it('uses the India calendar day rather than UTC', () => {
    expect(todayIsoInIndia(new Date('2026-03-31T20:00:00Z'))).toBe('2026-04-01')
    expect(todayIsoInIndia(new Date('2026-06-01T18:29:00Z'))).toBe('2026-06-01')
    expect(todayIsoInIndia(new Date('2026-06-01T18:31:00Z'))).toBe('2026-06-02')
  })

  it('adds years without losing the calendar date', () => {
    expect(addYearsIso('2026-02-28', 1)).toBe('2027-02-28')
    expect(addYearsIso('2028-02-29', 1)).toBe('2029-03-01')
  })

  it('rejects past, malformed, and far-future service dates', () => {
    expect(validateServiceDate('2026-10-24', '2026-10-25')).toBe('validation.date')
    expect(validateServiceDate('not-a-date', '2026-10-25')).toBe('validation.date')
    expect(validateServiceDate('2028-01-01', '2026-10-25')).toBe('validation.dateTooFar')
    expect(validateServiceDate('2026-10-25', '2026-10-25')).toBeNull()
  })
})

describe('parsePositiveNumber', () => {
  it('parses decimals and thousands separators', () => {
    expect(parsePositiveNumber('2.5')).toBe(2.5)
    expect(parsePositiveNumber('1,200')).toBe(1200)
    expect(parsePositiveNumber('0')).toBe(0)
  })

  it('rejects malformed input', () => {
    expect(parsePositiveNumber('-1')).toBeNull()
    expect(parsePositiveNumber('2.555')).toBeNull()
    expect(parsePositiveNumber('abc')).toBeNull()
  })
})

describe('validateBookingForm', () => {
  const valid = {
    serviceDate: '2026-11-01',
    village: '  Hubballi  ',
    acreage: '2.5',
    crop: 'wheat',
    phone: '+91 98765 43210',
    notes: '  Near the temple  ',
  }

  it('normalises valid values', () => {
    const result = validateBookingForm(valid, { today: '2026-10-25', allowedCrops: ['wheat'] })
    expect(result.errors).toEqual({})
    expect(result.parsed).toMatchObject({
      serviceDate: '2026-11-01',
      village: 'Hubballi',
      acreage: 2.5,
      crop: 'wheat',
      phone: '9876543210',
      notes: 'Near the temple',
    })
  })

  it('reports all required field problems', () => {
    const result = validateBookingForm(
      { ...valid, serviceDate: '', village: 'A', acreage: '0', crop: '', phone: '123' },
      { today: '2026-10-25' },
    )
    expect(result.parsed).toBeNull()
    expect(result.errors.serviceDate).toBe('validation.required')
    expect(result.errors.village).toBe('validation.village')
    expect(result.errors.acreage).toBe('validation.acreage')
    expect(result.errors.crop).toBe('validation.cropRequired')
    expect(result.errors.phone).toBe('validation.phone')
  })

  it('rejects a crop the machine does not support', () => {
    const result = validateBookingForm(valid, {
      today: '2026-10-25',
      allowedCrops: ['rice'],
    })
    expect(result.errors.crop).toBe('booking.error.crop')
  })
})

describe('validateMachineForm', () => {
  const valid = {
    machineType: 'combine_harvester',
    model: 'John Deere W70',
    pricePerAcre: '2500',
    crops: ['wheat', 'rice'],
    primaryVillage: 'Hubballi',
    district: 'Dharwad',
    state: 'Karnataka',
    phone: '9876543210',
    extraVillages: ['Ranebennur'],
  }

  it('creates one primary and additional service locations', () => {
    const result = validateMachineForm(valid)
    expect(result.errors).toEqual({})
    expect(result.parsed?.locations).toEqual([
      { village: 'Hubballi', district: 'Dharwad', state: 'Karnataka', is_primary: true },
      { village: 'Ranebennur', district: 'Dharwad', state: 'Karnataka', is_primary: false },
    ])
  })

  it('requires at least one crop and a valid price', () => {
    const result = validateMachineForm({ ...valid, crops: [], pricePerAcre: '0' })
    expect(result.errors.crops).toBe('validation.crops')
    expect(result.errors.pricePerAcre).toBe('validation.price')
  })

  it('rejects duplicate villages and more than eight villages', () => {
    const duplicate = validateMachineForm({
      ...valid,
      extraVillages: ['hubballi'],
    })
    expect(duplicate.errors.extraVillages).toBe('machine.villageDuplicate')

    const tooMany = validateMachineForm({
      ...valid,
      extraVillages: ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1'],
    })
    expect(tooMany.errors.extraVillages).toBe('validation.tooManyVillages')
  })
})

describe('profile and image validation', () => {
  it('allows optional location fields on a profile', () => {
    const result = validateProfileForm({
      fullName: '  Lakshmi  ',
      village: '',
      district: '',
      state: '',
    })
    expect(result.parsed).toEqual({
      fullName: 'Lakshmi',
      village: null,
      district: null,
      state: null,
    })
  })

  it('rejects unsupported image types and oversized files', () => {
    const pdf = new File(['x'], 'machine.pdf', { type: 'application/pdf' })
    expect(validateImageFile(pdf)).toBe('machine.photoTypeError')

    const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'machine.jpg', {
      type: 'image/jpeg',
    })
    expect(validateImageFile(huge)).toBe('machine.photoSizeError')

    const good = new File(['x'], 'machine.jpg', { type: 'image/jpeg' })
    expect(validateImageFile(good)).toBeNull()
  })
})
