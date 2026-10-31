import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../i18n'
import { LoginPage } from './LoginPage'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  refreshProfile: vi.fn(),
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    signInWithPassword: mocks.signInWithPassword,
    signUpWithPassword: mocks.signUpWithPassword,
    refreshProfile: mocks.refreshProfile,
    profile: null,
  }),
}))

function renderLogin() {
  return render(
    <I18nProvider>
      <LoginPage />
    </I18nProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    mocks.signInWithPassword.mockReset()
    mocks.signUpWithPassword.mockReset()
  })

  it('starts with the simple email/password sign-in form', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email address/)).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute('type', 'password')
    expect(screen.queryByLabelText(/^Your name/)).not.toBeInTheDocument()
  })

  it('switches to account creation and validates empty fields', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Your name/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Enter your name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 6 characters.')).toBeInTheDocument()
    expect(mocks.signUpWithPassword).not.toHaveBeenCalled()
  })

  it('creates an account and shows the check-email screen when needed', async () => {
    const user = userEvent.setup()
    mocks.signUpWithPassword.mockResolvedValue({ needsEmailConfirmation: true })
    renderLogin()

    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    await user.type(screen.getByLabelText(/^Your name/), 'Lakshmi')
    await user.type(screen.getByLabelText(/^Email address/), 'lakshmi@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(mocks.signUpWithPassword).toHaveBeenCalledWith(
      'lakshmi@example.com',
      'secret123',
      'Lakshmi',
    )
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByText(/lakshmi@example.com/)).toBeInTheDocument()
  })

  it('shows a clear message for wrong credentials', async () => {
    const user = userEvent.setup()
    mocks.signInWithPassword.mockRejectedValue({
      code: 'invalid_credentials',
      message: 'Invalid login credentials',
    })
    renderLogin()

    await user.type(screen.getByLabelText(/^Email address/), 'farmer@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'wrongpass')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument()
  })
})

