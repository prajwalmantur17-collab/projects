import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: null,
}))

import {
  createMachine,
  deleteMachine,
  listOwnerMachines,
  searchMachines,
} from './machines'
import { getLocalMachines } from './store'

describe('deleteMachine', () => {
  it('permanently deletes a machine so it never appears in search or owner listings', async () => {
    const ownerId = 'test-owner-del-1'
    const newMachine = await createMachine(
      ownerId,
      {
        machine_type: 'combine_harvester',
        model: 'TestDeleteHarvester',
        price_per_acre: 1500,
        pricing_unit: 'per_acre',
        crops: ['wheat', 'rice'],
        phone: '9876543210',
        latitude: 13.08,
        longitude: 77.58,
        locations: [
          {
            village: 'DeleteVillage',
            district: 'DeleteDistrict',
            state: 'Karnataka',
            is_primary: true,
          },
        ],
      },
      null,
    )

    // 1. Verify it was created and is searchable
    const initialOwnerList = await listOwnerMachines(ownerId)
    expect(initialOwnerList.some((m) => m.id === newMachine.id)).toBe(true)

    const initialSearchResults = await searchMachines({ village: 'DeleteVillage' })
    expect(initialSearchResults.some((m) => m.id === newMachine.id)).toBe(true)

    // 2. Delete the machine
    await deleteMachine(newMachine.id, ownerId)

    // 3. Verify it is completely removed from local store
    const localAfter = getLocalMachines()
    expect(localAfter.some((m) => m.id === newMachine.id)).toBe(false)

    // 4. Verify it does not appear in owner listings
    const ownerListAfter = await listOwnerMachines(ownerId)
    expect(ownerListAfter.some((m) => m.id === newMachine.id)).toBe(false)

    // 5. Verify it does not appear when any farmer searches for it
    const searchAfter = await searchMachines({ village: 'DeleteVillage' })
    expect(searchAfter.some((m) => m.id === newMachine.id)).toBe(false)
  })
})
