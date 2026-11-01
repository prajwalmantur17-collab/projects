import { describe, expect, it } from 'vitest'
import {
  ALL_CROPS,
  CROP_CONFIGS,
  CROP_DISPLAY_ORDER,
  POPULAR_CROP_KEYS,
  cropFallbackImageUrl,
  cropImageUrl,
  getCropConfig,
} from './cropConfig'
import { CROP_KEYS } from './constants'

describe('cropConfig', () => {
  it('defines configuration for every supported CropKey', () => {
    expect(CROP_KEYS.length).toBe(20)
    for (const key of CROP_KEYS) {
      const config = CROP_CONFIGS[key]
      expect(config).toBeDefined()
      expect(config.id).toBe(key)
      expect(config.englishName.length).toBeGreaterThan(0)
      expect(config.image).toBe(`/crops/${key}.webp`)
      expect(config.fallbackImage).toBe(`/crops/${key}.jpg`)
      expect(config.alt.length).toBeGreaterThan(5)
      expect(config.emoji.length).toBeGreaterThan(0)
      expect(config.category).toBeDefined()
    }
  })

  it('provides helpers with correct URLs', () => {
    expect(cropImageUrl('rice')).toBe('/crops/rice.webp')
    expect(cropFallbackImageUrl('rice')).toBe('/crops/rice.jpg')
    expect(getCropConfig('wheat').englishName).toBe('Wheat')
  })

  it('contains all 20 crops in CROP_DISPLAY_ORDER and ALL_CROPS', () => {
    expect(CROP_DISPLAY_ORDER.length).toBe(20)
    expect(ALL_CROPS.length).toBe(20)
    expect(new Set(CROP_DISPLAY_ORDER).size).toBe(20)
  })

  it('popular crops are a subset of all crops', () => {
    expect(POPULAR_CROP_KEYS.length).toBeGreaterThan(0)
    for (const key of POPULAR_CROP_KEYS) {
      expect(CROP_KEYS).toContain(key)
    }
  })
})
