import { describe, expect, it } from 'vitest'
import { parseNaturalSearchQuery } from './smartSearch'

describe('parseNaturalSearchQuery', () => {
  it('detects new machines intent', () => {
    const res = parseNaturalSearchQuery('what are the new machine added')
    expect(res.isNewQuery).toBe(true)
    expect(res.isCountQuery).toBe(false)
  })

  it('detects count query for harvesters in vijaypura', () => {
    const res = parseNaturalSearchQuery('how many harvestor machines are there in vijaypura')
    expect(res.isCountQuery).toBe(true)
    expect(res.machineType).toBe('combine_harvester')
    expect(res.location).toBe('vijaypura')
  })

  it('detects location search for vijaypura', () => {
    const res = parseNaturalSearchQuery('vijaypura')
    expect(res.location).toBe('vijaypura')
  })

  it('detects crop search for paddy', () => {
    const res = parseNaturalSearchQuery('paddy harvester')
    expect(res.crop).toBe('rice')
    expect(res.machineType).toBe('combine_harvester')
  })

  it('detects model search for swaraj', () => {
    const res = parseNaturalSearchQuery('swaraj combine')
    expect(res.model).toBe('swaraj')
    expect(res.machineType).toBe('combine_harvester')
  })
})
