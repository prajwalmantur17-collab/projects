import { describe, expect, it, vi, beforeEach } from 'vitest'
import { searchPlaces, localMatches, clearPlaceCache } from './placeSearch'

describe('placeSearch service', () => {
  beforeEach(() => {
    clearPlaceCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns empty array when query is less than MIN_QUERY_LENGTH (2)', async () => {
    const res = await searchPlaces('a')
    expect(res).toEqual([])
  })

  it('finds local matches offline for common Karnataka places', () => {
    const matches = localMatches('kogi', 'en')
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].village).toBe('Kogilu')
    expect(matches[0].district).toBe('Bengaluru')
  })

  it('localizes local matches when language is Kannada or Hindi', () => {
    const knMatches = localMatches('Kogilu', 'kn')
    expect(knMatches[0].village).toBe('ಕೋಗಿಲು')

    const hiMatches = localMatches('Kogilu', 'hi')
    expect(hiMatches[0].village).toBe('कोगिलु')
  })

  it('caches remote search results and reuses them on subsequent calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { coordinates: [77.6174, 13.1067] },
            properties: {
              osm_id: 101,
              osm_type: 'N',
              name: 'Kogilu Cross',
              district: 'Bengaluru',
              countrycode: 'IN',
              type: 'village',
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = await searchPlaces('Kogilu', 'en')
    expect(first.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Repeat identical search
    const second = await searchPlaces('Kogilu', 'en')
    expect(second.length).toBeGreaterThan(0)
    // Fetch count should still be 1 due to in-memory caching
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('respects abort signal and cancels lookup immediately', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(searchPlaces('Bengaluru', 'en', controller.signal)).rejects.toThrow()
  })
})
