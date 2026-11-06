/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  deleteMachine,
  getMachineCard,
  searchMachines,
} from './machines'
import {
  getLocalMachines,
  markMachineDeleted,
  saveMachinesToStorage,
  isMachineDeleted,
} from './store'
import type { MachineCard } from '../types'

// Mock Supabase module to simulate various server scenarios
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn(),
    },
    requireSupabase: vi.fn(),
  }
})

import { supabase } from '../lib/supabase'

describe('Supabase Database Consistency and Machine Deletion Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // TEST 1: Owner deletes a machine -> Farmer on another device searches -> Deleted machine must not appear
  it('TEST 1: ensures deleted machine does not appear in server search results on other devices', async () => {
    const deletedMachineId = '00000000-0000-0000-0000-000000000001'
    const activeMachineId = '00000000-0000-0000-0000-000000000002'

    // Simulate Supabase search_machines RPC returning only active machine (excluding deleted)
    const mockRpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: activeMachineId,
          owner_id: 'owner-2',
          machine_type: 'combine_harvester',
          model: 'Active Harvester',
          price_per_acre: 2000,
          pricing_unit: 'per_acre',
          crops: ['wheat'],
          phone: '9876543210',
          latitude: 13.0,
          longitude: 77.0,
          image_path: null,
          is_active: true,
          is_available: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          owner_name: 'Owner 2',
          village: 'Koppal',
          district: 'Koppal',
          state: 'Karnataka',
          service_villages: [],
        },
      ],
      error: null,
    })
    ;(supabase!.rpc as any).mockImplementation(mockRpc)

    const results = await searchMachines({ village: 'Koppal' })
    expect(results.some((m) => m.id === deletedMachineId)).toBe(false)
    expect(results.some((m) => m.id === activeMachineId)).toBe(true)
  })

  // TEST 2: Owner deletes a machine -> Farmer has an old localStorage cache -> After successful server synchronization, deleted machine disappears
  it('TEST 2: farmer with old localStorage cache purges deleted machine on server sync or deletion event', async () => {
    const deletedId = 'del-cache-001'
    const oldCachedMachine: MachineCard = {
      id: deletedId,
      owner_id: 'owner-1',
      machine_type: 'combine_harvester',
      model: 'Old Cached Machine',
      price_per_acre: 1800,
      pricing_unit: 'per_acre',
      crops: ['rice'],
      phone: '9876543211',
      latitude: 13.1,
      longitude: 77.1,
      image_path: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_name: 'Owner 1',
      village: 'Mandya',
      district: 'Mandya',
      state: 'Karnataka',
      service_villages: [],
    }

    saveMachinesToStorage([oldCachedMachine])
    expect(getLocalMachines().some((m) => m.id === deletedId)).toBe(true)

    // Mark deleted via server event / sync
    markMachineDeleted(deletedId)
    expect(isMachineDeleted(deletedId)).toBe(true)
    expect(getLocalMachines().some((m) => m.id === deletedId)).toBe(false)
  })

  // TEST 3: Supabase returns zero results -> Application must not display stale local machines as current server results
  it('TEST 3: does not fall back to stale local machines when Supabase returns zero results', async () => {
    // Populate old local machine
    const staleId = 'stale-local-999'
    const staleMachine: MachineCard = {
      id: staleId,
      owner_id: 'owner-stale',
      machine_type: 'tractor_harvester',
      model: 'Stale Local Machine',
      price_per_acre: 1500,
      pricing_unit: 'per_acre',
      crops: ['wheat'],
      phone: '9876543212',
      latitude: 13.2,
      longitude: 77.2,
      image_path: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_name: 'Owner Stale',
      village: 'Bagalkot',
      district: 'Bagalkot',
      state: 'Karnataka',
      service_villages: [],
    }
    saveMachinesToStorage([staleMachine])

    // Supabase RPC returns empty list (0 machines found)
    ;(supabase!.rpc as any).mockReturnValue({
      abortSignal: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: [], error: null }),
    })

    const results = await searchMachines({ village: 'Bagalkot' })
    // Must return 0 machines, NOT stale local machines!
    expect(results).toEqual([])
  })

  // TEST 4: Supabase is unavailable (offline) -> Rejects server queries so UI displays offline indicator rather than pretending live
  it('TEST 4: throws on online database error and only allows local store in offline mode', async () => {
    ;(supabase!.rpc as any).mockReturnValue({
      abortSignal: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: null, error: { code: 'PGRST500', message: 'Database connection down' } }),
    })

    // Online database error throws error instead of quietly serving fake data
    await expect(searchMachines({ village: 'Mysuru' })).rejects.toBeDefined()
  })

  // TEST 5: Owner tries deleting another owner machine -> Operation rejected by server
  it('TEST 5: rejects deletion if server reports not owner', async () => {
    const machineId = '00000000-0000-0000-0000-000000000005'
    ;(supabase!.rpc as any).mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'HR_NOT_OWNER: not your machine' },
    })
    ;(supabase!.from as any).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { code: '42501', message: 'permission denied for table machines' },
        }),
      }),
    })

    await expect(deleteMachine(machineId, 'attacker-id')).rejects.toBeDefined()
  })

  // TEST 6: Machine has historical bookings -> Deletion deactivates machine and removes locations while keeping row for history
  it('TEST 6: successfully invokes delete_machine RPC which deactivates machine without destroying booking history', async () => {
    const machineId = '00000000-0000-0000-0000-000000000006'
    ;(supabase!.rpc as any).mockResolvedValue({
      data: true,
      error: null,
    })

    await deleteMachine(machineId, 'owner-6')
    expect(supabase!.rpc).toHaveBeenCalledWith('delete_machine', { p_machine_id: machineId })
    expect(isMachineDeleted(machineId)).toBe(true)
  })

  // TEST 7: Farmer attempts booking a deleted machine -> getMachineCard returns null
  it('TEST 7: getMachineCard returns null for deleted or inactive machines', async () => {
    const deletedId = '00000000-0000-0000-0000-000000000007'
    ;(supabase!.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: deletedId, is_active: false },
            error: null,
          }),
        }),
      }),
    })

    const card = await getMachineCard(deletedId)
    expect(card).toBeNull()
  })

  // TEST 8: Supabase returns an RLS error during deletion -> Application must throw and not claim deletion succeeded
  it('TEST 8: throws on RLS deletion error without claiming success', async () => {
    const machineId = '00000000-0000-0000-0000-000000000008'
    ;(supabase!.rpc as any).mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'new row violates row-level security policy' },
    })
    ;(supabase!.from as any).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { code: '42501', message: 'new row violates row-level security policy' },
        }),
      }),
    })

    await expect(deleteMachine(machineId, 'owner-8')).rejects.toBeDefined()
  })

  // TEST 9: In-memory & client state removes deleted machine when Realtime deletion event is received
  it('TEST 9: marks machine deleted immediately upon receiving sync', () => {
    const id = 'realtime-del-9'
    expect(isMachineDeleted(id)).toBe(false)
    markMachineDeleted(id)
    expect(isMachineDeleted(id)).toBe(true)
  })
})
