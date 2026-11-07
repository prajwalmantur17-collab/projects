import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MachineCard } from '../types'

type RpcResult = { data: unknown; error: unknown }

const mocks = vi.hoisted(() => {
  const state = {
    rpc: (() => Promise.resolve({ data: null, error: null })) as (name: string) => Promise<RpcResult>,
    cardRow: null as unknown,
  }
  const client = {
    rpc: (name: string) => {
      const promise = state.rpc(name) as Promise<RpcResult> & { abortSignal?: () => unknown }
      promise.abortSignal = () => promise
      return promise
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: state.cardRow, error: null }),
        }),
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => undefined,
    storage: { from: () => ({ remove: () => Promise.resolve({}) }) },
  }
  return { state, client }
})

vi.mock('../lib/supabase', () => ({ supabase: mocks.client }))

import { deleteMachine, getMachineCard, searchMachines } from './machines'
import { addLocalMachine, getLocalMachines, isMachineDeleted } from './store'

const UUID = '11111111-1111-4111-8111-111111111111'

function card(id: string, over: Partial<MachineCard> = {}): MachineCard {
  return {
    id,
    owner_id: 'owner-1',
    machine_type: 'tractor',
    model: 'Test',
    price_per_acre: 500,
    pricing_unit: 'per_acre',
    crops: ['paddy'],
    phone: '9876543210',
    latitude: null,
    longitude: null,
    image_path: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    owner_name: 'Owner',
    village: 'Mandya',
    district: 'Mandya',
    state: 'Karnataka',
    service_villages: ['Mandya'],
    ...over,
  } as MachineCard
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true })
}

describe('machine deletion and stale cache handling', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setOnline(true)
    mocks.state.cardRow = null
    mocks.state.rpc = () => Promise.resolve({ data: null, error: null })
  })

  it('T3: server returns zero results -> no stale local machines are shown', async () => {
    addLocalMachine(card(UUID))
    mocks.state.rpc = () => Promise.resolve({ data: [], error: null })
    const found = await searchMachines({ village: 'Mandya' })
    expect(found).toEqual([])
  })

  it('T1/T2: a machine the server no longer returns is not shown, and old offline copies are cleared', async () => {
    addLocalMachine(card('m-legacy-offline-copy'))
    mocks.state.rpc = () => Promise.resolve({ data: [card('22222222-2222-4222-8222-222222222222')], error: null })
    const found = await searchMachines({ village: 'Mandya' })
    expect(found.map((m) => m.id)).toEqual(['22222222-2222-4222-8222-222222222222'])
    expect(getLocalMachines().some((m) => m.id === 'm-legacy-offline-copy')).toBe(false)
  })

  it('T4: network failure while offline uses the local copy instead of failing', async () => {
    addLocalMachine(card(UUID))
    setOnline(false)
    mocks.state.rpc = () => Promise.reject(new TypeError('Failed to fetch'))
    const found = await searchMachines({})
    // The page labels these as possibly outdated because navigator.onLine is false.
    expect(found.map((m) => m.id)).toEqual([UUID])
  })

  it('T8: an RLS error on delete is thrown and the machine is NOT marked deleted', async () => {
    mocks.state.rpc = () => Promise.resolve({ data: null, error: { code: '42501', message: 'rls' } })
    await expect(deleteMachine(UUID, 'owner-1')).rejects.toBeTruthy()
    expect(isMachineDeleted(UUID)).toBe(false)
  })

  it('T5: deleting another owner’s machine is rejected and not marked deleted', async () => {
    mocks.state.rpc = () =>
      Promise.resolve({ data: null, error: { code: 'P0001', message: 'HR_NOT_OWNER: not your machine' } })
    await expect(deleteMachine(UUID, 'someone-else')).rejects.toBeTruthy()
    expect(isMachineDeleted(UUID)).toBe(false)
  })

  it('delete is not reported as success if the server does not confirm', async () => {
    mocks.state.rpc = () => Promise.resolve({ data: { ok: false }, error: null })
    await expect(deleteMachine(UUID, 'owner-1')).rejects.toBeTruthy()
    expect(isMachineDeleted(UUID)).toBe(false)
  })

  it('delete is not reported as success if the machine is still listed on the server', async () => {
    mocks.state.rpc = () => Promise.resolve({ data: { ok: true }, error: null })
    mocks.state.cardRow = { id: UUID }
    await expect(deleteMachine(UUID, 'owner-1')).rejects.toBeTruthy()
    expect(isMachineDeleted(UUID)).toBe(false)
  })

  it('a confirmed delete removes the machine from the local cache and remembers it', async () => {
    addLocalMachine(card(UUID))
    mocks.state.rpc = () => Promise.resolve({ data: { ok: true, hard_deleted: false }, error: null })
    mocks.state.cardRow = null
    await deleteMachine(UUID, 'owner-1')
    expect(isMachineDeleted(UUID)).toBe(true)
    expect(getLocalMachines().some((m) => m.id === UUID)).toBe(false)
  })

  it('a machine the server does not return is removed from the local cache', async () => {
    addLocalMachine(card(UUID))
    mocks.state.cardRow = null
    expect(await getMachineCard(UUID)).toBeNull()
    expect(getLocalMachines().some((m) => m.id === UUID)).toBe(false)
  })
})
