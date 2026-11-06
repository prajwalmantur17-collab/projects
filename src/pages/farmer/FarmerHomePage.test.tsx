import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthModule from '../../auth/AuthProvider'
import { I18nProvider } from '../../i18n'
import * as MachinesService from '../../services/machines'
import type { MachineCard } from '../../types'
import { FarmerHomePage } from './FarmerHomePage'

vi.mock('../../components/map/LiveMap', () => ({
  LiveMap: () => <div data-testid="live-map-mock" />,
}))

vi.mock('../../components/voice/KisanVoiceAssistant', () => ({
  KisanVoiceAssistant: () => <div data-testid="voice-assistant-mock" />,
}))

vi.mock('../../components/voice/VoiceSearchButton', () => ({
  VoiceSearchButton: () => <div data-testid="voice-btn-mock" />,
}))

vi.mock('../../services/placeSearch', () => ({
  searchPlaces: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../services/platformStats', () => ({
  fetchPlatformStats: vi.fn().mockResolvedValue(null),
  fetchLatestMachineActivity: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../services/workStatus', () => ({
  getBusyMachines: vi.fn().mockResolvedValue(new Map()),
}))

type AuthReturn = ReturnType<typeof AuthModule.useAuth>
type MockSession = AuthReturn['session']
type MockProfile = AuthReturn['profile']

describe('FarmerHomePage search sequencing and race-condition prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      configured: true,
      initializing: false,
      session: null as unknown as MockSession,
      profile: null as unknown as MockProfile,
      profileLoading: false,
      profileError: null,
      recovering: false,
      refreshProfile: vi.fn(),
      signInWithPassword: vi.fn(),
      signUpWithPassword: vi.fn(),
      requestPasswordReset: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
    })
  })

  it('ensures rapid consecutive searches show results from the latest query, ignoring late out-of-order responses', async () => {
    const machineOld: MachineCard = {
      id: 'm-old-1',
      owner_id: 'o-1',
      machine_type: 'combine_harvester',
      model: 'SlowOldMachine',
      price_per_acre: 1500,
      crops: ['wheat'],
      phone: '9876543210',
      latitude: 13.0,
      longitude: 77.0,
      image_path: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_name: 'Owner 1',
      village: 'OldVillage',
      district: 'District 1',
      state: 'Karnataka',
      service_villages: [],
    }

    const machineNew: MachineCard = {
      id: 'm-new-2',
      owner_id: 'o-2',
      machine_type: 'combine_harvester',
      model: 'FastNewMachine',
      price_per_acre: 1200,
      crops: ['wheat'],
      phone: '9876543211',
      latitude: 13.0,
      longitude: 77.0,
      image_path: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_name: 'Owner 2',
      village: 'NewVillage',
      district: 'District 2',
      state: 'Karnataka',
      service_villages: [],
    }

    let _searchCount = 0
    vi.spyOn(MachinesService, 'searchMachines').mockImplementation(async (params) => {
      _searchCount++
      if (params.village === 'Vijayapura') {
        // Slow resolution (200ms)
        await new Promise((resolve) => setTimeout(resolve, 200))
        return [machineOld]
      }
      if (params.village === 'Hubballi') {
        // Fast resolution (30ms)
        await new Promise((resolve) => setTimeout(resolve, 30))
        return [machineNew]
      }
      return []
    })

    render(
      <MemoryRouter>
        <I18nProvider>
          <FarmerHomePage />
        </I18nProvider>
      </MemoryRouter>,
    )

    // 1. User taps Vijayapura (slow resolution 200ms)
    const vijayapuraBtn = screen.getByRole('button', { name: 'Vijayapura' })
    fireEvent.click(vijayapuraBtn)

    // 2. User immediately taps Hubballi (fast resolution 30ms)
    const hubballiBtn = screen.getByRole('button', { name: 'Hubballi' })
    fireEvent.click(hubballiBtn)

    // Wait for the fast second search (Hubballi) to complete
    await waitFor(() => {
      expect(screen.getByText('FastNewMachine')).toBeInTheDocument()
    })

    // Wait 250ms for the slower first search to finish in the background
    await new Promise((resolve) => setTimeout(resolve, 250))

    // Verify FastNewMachine is STILL displayed, and SlowOldMachine was IGNORED
    expect(screen.getByText('FastNewMachine')).toBeInTheDocument()
    expect(screen.queryByText('SlowOldMachine')).not.toBeInTheDocument()
  })

  it('prevents a late search response from resurrecting results after clearSearch is clicked', async () => {
    const machineInit: MachineCard = {
      id: 'm-init-0',
      owner_id: 'o-0',
      machine_type: 'combine_harvester',
      model: 'InitialMachine',
      price_per_acre: 1000,
      crops: ['rice'],
      phone: '9876543200',
      latitude: 13.0,
      longitude: 77.0,
      image_path: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_name: 'Owner 0',
      village: 'Vijayapura',
      district: 'vijaypura',
      state: 'Karnataka',
      service_villages: [],
    }

    const machineLate: MachineCard = {
      id: 'm-late-3',
      owner_id: 'o-3',
      machine_type: 'combine_harvester',
      model: 'LateArrivingMachine',
      price_per_acre: 1400,
      crops: ['rice'],
      phone: '9876543212',
      latitude: 13.0,
      longitude: 77.0,
      image_path: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_name: 'Owner 3',
      village: 'Toravi',
      district: 'vijaypura',
      state: 'Karnataka',
      service_villages: [],
    }

    vi.spyOn(MachinesService, 'searchMachines').mockImplementation(async (params) => {
      if (params.village === 'Vijayapura') {
        return [machineInit]
      }
      if (params.village === 'Toravi') {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return [machineLate]
      }
      return []
    })

    render(
      <MemoryRouter>
        <I18nProvider>
          <FarmerHomePage />
        </I18nProvider>
      </MemoryRouter>,
    )

    // 1. Initial search so results and Clear Search button are active
    const vijayapuraBtn = screen.getByRole('button', { name: 'Vijayapura' })
    fireEvent.click(vijayapuraBtn)

    await waitFor(() => {
      expect(screen.getByText('InitialMachine')).toBeInTheDocument()
    })

    // 2. Start slow search for Toravi
    const toraviBtn = screen.getByRole('button', { name: 'Toravi' })
    fireEvent.click(toraviBtn)

    // 3. Click the live Clear button while Toravi search is in flight
    const clearButton = await screen.findByRole('button', { name: /clear search/i })
    fireEvent.click(clearButton)

    // Verify initial machine is gone immediately
    expect(screen.queryByText('InitialMachine')).not.toBeInTheDocument()

    // 4. Wait 250ms for the delayed Toravi promise to complete
    await new Promise((resolve) => setTimeout(resolve, 250))

    // Late arriving machine must NOT appear or resurrect results
    expect(screen.queryByText('LateArrivingMachine')).not.toBeInTheDocument()
  })
})
