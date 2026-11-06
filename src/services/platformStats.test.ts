import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPlatformStatsCache,
  fetchLatestMachineActivity,
  fetchPlatformStats,
} from './platformStats'

// Mock supabase client
vi.mock('../lib/supabase', () => {
  const mockRpc = vi.fn()
  const mockFrom = vi.fn()
  return {
    supabase: {
      rpc: mockRpc,
      from: mockFrom,
    },
  }
})

import { supabase } from '../lib/supabase'

describe('platformStats service', () => {
  beforeEach(() => {
    clearPlatformStatsCache()
    vi.clearAllMocks()
  })

  it('fetches platform stats and reuses cached value within TTL', async () => {
    const mockRpc = supabase!.rpc as unknown as ReturnType<typeof vi.fn>
    mockRpc.mockResolvedValueOnce({
      data: {
        total_machines: 10,
        available_machines: 8,
        total_farmers: 25,
        total_users: 30,
        confirmed_bookings: 15,
      },
      error: null,
    })

    const first = await fetchPlatformStats()
    expect(first).not.toBeNull()
    expect(first?.total_machines).toBe(10)
    expect(mockRpc).toHaveBeenCalledTimes(1)

    // Second call should return cached stats immediately without second RPC call
    const second = await fetchPlatformStats()
    expect(second).toEqual(first)
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('deduplicates simultaneous in-flight platform stats requests', async () => {
    const mockRpc = supabase!.rpc as unknown as ReturnType<typeof vi.fn>
    mockRpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: {
                total_machines: 5,
                available_machines: 5,
                total_farmers: 10,
                total_users: 12,
                confirmed_bookings: 3,
              },
              error: null,
            })
          }, 20)
        }),
    )

    const [req1, req2] = await Promise.all([fetchPlatformStats(), fetchPlatformStats()])
    expect(req1).toEqual(req2)
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('fetches latest machine activity and caches the result', async () => {
    const mockFrom = supabase!.from as unknown as ReturnType<typeof vi.fn>
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({
                data: [
                  {
                    id: 'act-1',
                    model: 'GreenHarvester',
                    machine_type: 'combine_harvester',
                    village: 'Sampigehalli',
                    district: 'Bengaluru Urban',
                    image_path: null,
                    created_at: new Date().toISOString(),
                    is_active: true,
                  },
                ],
                error: null,
              }),
          }),
        }),
      }),
    })

    const first = await fetchLatestMachineActivity()
    expect(first).not.toBeNull()
    expect(first?.id).toBe('act-1')
    expect(mockFrom).toHaveBeenCalledTimes(1)

    // Second call should be served from memory cache
    const second = await fetchLatestMachineActivity()
    expect(second?.id).toBe('act-1')
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('handles database errors gracefully and returns null without throwing', async () => {
    const mockRpc = supabase!.rpc as unknown as ReturnType<typeof vi.fn>
    mockRpc.mockRejectedValueOnce(new Error('Network offline'))

    const mockFrom = supabase!.from as unknown as ReturnType<typeof vi.fn>
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => Promise.reject(new Error('Network offline')),
        }),
      }),
    })

    const result = await fetchPlatformStats()
    expect(result).toBeNull()
  })
})

