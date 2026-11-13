import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { SidebarProvider } from './SidebarContext'
import { I18nProvider } from '../../i18n'
import * as AuthModule from '../../auth/AuthProvider'

type AuthReturn = ReturnType<typeof AuthModule.useAuth>
type MockSession = AuthReturn['session']
type MockProfile = AuthReturn['profile']

describe('Redesigned Sidebar Navigation', () => {
  it('renders farmer sidebar with all required sections and items', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      configured: true,
      initializing: false,
      session: { user: { id: 'farmer-1' } } as unknown as MockSession,
      profile: {
        id: 'farmer-1',
        role: 'farmer',
        full_name: 'Farmer Ramesh',
        village: 'Hubballi',
        district: 'Dharwad',
        avatar_path: null,
      } as unknown as MockProfile,
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

    render(
      <I18nProvider>
        <SidebarProvider>
          <MemoryRouter initialEntries={['/']}>
            <Sidebar />
          </MemoryRouter>
        </SidebarProvider>
      </I18nProvider>,
    )

    // Brand
    expect(screen.getByText('HarvestRent')).toBeDefined()

    // Workspace & Mode (appears in workspace card and in bottom profile)
    expect(screen.getByText('Workspace')).toBeDefined()
    expect(screen.getAllByText('Farmer').length).toBeGreaterThanOrEqual(1)

    // Section headers
    expect(screen.getByText('Main Menu')).toBeDefined()
    expect(screen.getByText('Account')).toBeDefined()
    expect(screen.getByText('Support')).toBeDefined()

    // Farmer Main Menu items
    expect(screen.getByText('Find Machines')).toBeDefined()
    expect(screen.getByText('My Bookings')).toBeDefined()
    expect(screen.getByText('My Records')).toBeDefined()
    expect(screen.getByText('My Crops')).toBeDefined()

    // Account & Support items
    expect(screen.getByText('My Profile')).toBeDefined()
    expect(screen.getByText('Notifications')).toBeDefined()
    expect(screen.getByText('Settings')).toBeDefined()
    expect(screen.getByText('Help & Support')).toBeDefined()

    // Fixed Bottom Profile
    expect(screen.getByText('Farmer Ramesh')).toBeDefined()
  })

  it('renders machine owner sidebar with all required sections and items', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      configured: true,
      initializing: false,
      session: { user: { id: 'owner-1' } } as unknown as MockSession,
      profile: {
        id: 'owner-1',
        role: 'owner',
        full_name: 'Owner Suresh',
        village: 'Toravi',
        district: 'Vijayapura',
        avatar_path: null,
      } as unknown as MockProfile,
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

    render(
      <I18nProvider>
        <SidebarProvider>
          <MemoryRouter initialEntries={['/owner']}>
            <Sidebar />
          </MemoryRouter>
        </SidebarProvider>
      </I18nProvider>,
    )

    // Brand
    expect(screen.getByText('HarvestRent')).toBeDefined()

    // Workspace & Mode (appears in workspace card and in bottom profile)
    expect(screen.getByText('Workspace')).toBeDefined()
    expect(screen.getAllByText('Machine Owner').length).toBeGreaterThanOrEqual(1)

    // Owner Main Menu items
    expect(screen.getByText('Owner Dashboard')).toBeDefined()
    expect(screen.getByText('My Machines')).toBeDefined()
    expect(screen.getByText('Booking Requests')).toBeDefined()
    expect(screen.getByText('My Rentals')).toBeDefined()
    expect(screen.getByText('Rental History')).toBeDefined()

    // Fixed Bottom Profile
    expect(screen.getByText('Owner Suresh')).toBeDefined()
  })

  it('renders guest sidebar without private account routes but with login button', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      configured: true,
      initializing: false,
      session: null,
      profile: null,
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

    render(
      <I18nProvider>
        <SidebarProvider>
          <MemoryRouter initialEntries={['/']}>
            <Sidebar />
          </MemoryRouter>
        </SidebarProvider>
      </I18nProvider>,
    )

    expect(screen.getByText('HarvestRent')).toBeDefined()
    expect(screen.getByText('Find Machines')).toBeDefined()
    expect(screen.getByText('Help & Support')).toBeDefined()
    expect(screen.getByText('Login')).toBeDefined()

    // Private routes should be hidden from guest
    expect(screen.queryByText('My Bookings')).toBeNull()
    expect(screen.queryByText('My Records')).toBeNull()
  })
})
