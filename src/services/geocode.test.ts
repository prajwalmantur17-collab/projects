import { describe, expect, it, vi, beforeEach } from 'vitest'
import { normalizePlaceName, reverseGeocode, clearReverseGeocodeCache } from './geocode'

describe('normalizePlaceName', () => {
  it('normalizes Kannada place names to English when target language is en', () => {
    expect(normalizePlaceName('ಕೋಗಿಲು', 'en')).toBe('Kogilu')
    expect(normalizePlaceName('ಬೆಂಗಳೂರು ನಗರ', 'en')).toBe('Bengaluru Urban')
    expect(normalizePlaceName('ಬೆಂಗಳೂರು', 'en')).toBe('Bengaluru')
    expect(normalizePlaceName('ವಿಜಯಪುರ', 'en')).toBe('Vijayapura')
    expect(normalizePlaceName('ಮಂಡ್ಯ', 'en')).toBe('Mandya')
  })

  it('translates English place names to Kannada when target language is kn', () => {
    expect(normalizePlaceName('Kogilu', 'kn')).toBe('ಕೋಗಿಲು')
    expect(normalizePlaceName('Bengaluru Urban', 'kn')).toBe('ಬೆಂಗಳೂರು ನಗರ')
    expect(normalizePlaceName('Vijayapura', 'kn')).toBe('ವಿಜಯಪುರ')
    expect(normalizePlaceName('Mandya', 'kn')).toBe('ಮಂಡ್ಯ')
  })

  it('translates place names to Hindi when target language is hi', () => {
    expect(normalizePlaceName('Kogilu', 'hi')).toBe('कोगिलु')
    expect(normalizePlaceName('Bengaluru Urban', 'hi')).toBe('बेंगलुरु शहरी')
    expect(normalizePlaceName('Vijayapura', 'hi')).toBe('विजयपुर')
    expect(normalizePlaceName('Mandya', 'hi')).toBe('मांड्या')
  })

  it('preserves English names when target language is en', () => {
    expect(normalizePlaceName('Kogilu', 'en')).toBe('Kogilu')
    expect(normalizePlaceName('Mandya', 'en')).toBe('Mandya')
    expect(normalizePlaceName('Vijayapura', 'en')).toBe('Vijayapura')
  })
})

describe('reverseGeocode caching, deduplication, and resilience', () => {
  beforeEach(() => {
    clearReverseGeocodeCache()
    vi.restoreAllMocks()
  })

  it('returns null immediately for invalid coordinates or aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    const abortedResult = await reverseGeocode({ latitude: 13.1, longitude: 77.6 }, 'en', controller.signal)
    expect(abortedResult).toBeNull()

    const invalidResult = await reverseGeocode({ latitude: NaN, longitude: 77.6 }, 'en')
    expect(invalidResult).toBeNull()
  })

  it('uses in-memory cache for repeated lookups', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        address: { village: 'Kogilu', state_district: 'Bengaluru Urban', state: 'Karnataka' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = await reverseGeocode({ latitude: 13.1067, longitude: 77.6174 }, 'en')
    expect(first?.village).toBe('Kogilu')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Second call with slightly different precision (~within ~110m rounding)
    const second = await reverseGeocode({ latitude: 13.1069, longitude: 77.6172 }, 'en')
    expect(second?.village).toBe('Kogilu')
    // Cached: fetch should not have been called a second time
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to BigDataCloud when Nominatim returns an error', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('nominatim')) {
        return Promise.resolve({ ok: false, status: 500 })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          locality: 'Tikota',
          localityInfo: { administrative: [{ adminLevel: 5, name: 'Vijayapura District' }] },
          principalSubdivision: 'Karnataka',
        }),
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await reverseGeocode({ latitude: 16.8286, longitude: 75.5412 }, 'en')
    expect(res).not.toBeNull()
    expect(res?.village).toBe('Tikota')
    expect(res?.district).toBe('Vijayapura')
  })

  it('prioritizes neighbourhood (e.g. Bhartiya City) over broader suburb (e.g. Kogilu)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        address: {
          office: 'DigiKey',
          road: 'Nikoo Homes Road',
          neighbourhood: 'Bhartiya City',
          suburb: 'Kogilu',
          state_district: 'Bengaluru Urban',
          state: 'Karnataka',
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await reverseGeocode({ latitude: 13.0845, longitude: 77.6410 }, 'en')
    expect(res?.village).toBe('Bhartiya City')
    expect(res?.district).toBe('Bengaluru')
    expect(res?.state).toBe('Karnataka')
  })
})
