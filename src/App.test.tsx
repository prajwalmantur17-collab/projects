import { render } from '@testing-library/react'
import { describe, it, vi } from 'vitest'
import { App } from './App'
import { I18nProvider } from './i18n'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import * as AuthModule from './auth/AuthProvider'

type AuthReturn = ReturnType<typeof AuthModule.useAuth>
type MockSession = AuthReturn['session']
type MockProfile = AuthReturn['profile']

describe('Full App Mount Test with Authenticated State', () => {
  it('renders with logged in farmer', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      configured: true,
      initializing: false,
      session: { user: { id: 'user-123' } } as unknown as MockSession,
      profile: {
        id: 'user-123',
        role: 'farmer',
        full_name: 'Prajwal Mantur',
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

    const { container } = render(
      <I18nProvider>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </I18nProvider>
    )

    if (container.innerHTML.includes('Something went wrong')) {
      throw new Error('Crashed when logged in as farmer: ' + container.innerHTML)
    }
  })

  it('renders with logged in owner', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      configured: true,
      initializing: false,
      session: { user: { id: 'owner-123' } } as unknown as MockSession,
      profile: {
        id: 'owner-123',
        role: 'owner',
        full_name: 'Owner Name',
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

    const { container } = render(
      <I18nProvider>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </I18nProvider>
    )

    if (container.innerHTML.includes('Something went wrong')) {
      throw new Error('Crashed when logged in as owner: ' + container.innerHTML)
    }
  })
})
