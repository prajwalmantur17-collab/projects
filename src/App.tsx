import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { RequireAuth, RequireRole } from './auth/Guards'
import { homeForProfile } from './auth/routing'
import { AppShell } from './components/layout/AppShell'
import { LoadingScreen } from './components/ui/Feedback'
import { useI18n } from './i18n'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfileErrorPage } from './pages/ProfileErrorPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { RoleSelectionPage } from './pages/RoleSelectionPage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupRequiredPage } from './pages/SetupRequiredPage'
import { FarmerBookingsPage } from './pages/farmer/FarmerBookingsPage'
import { FarmerHomePage } from './pages/farmer/FarmerHomePage'
import { MachineDetailsPage } from './pages/farmer/MachineDetailsPage'
import { AvailabilityPage } from './pages/owner/AvailabilityPage'
import { MachineFormPage } from './pages/owner/MachineFormPage'
import { OwnerBookingsPage } from './pages/owner/OwnerBookingsPage'
import { OwnerHomePage } from './pages/owner/OwnerHomePage'
import { OwnerMachinesPage } from './pages/owner/OwnerMachinesPage'

export function App() {
  return (
    <BrowserRouter>
      <RecoveryRedirect />
      <Routes>
        <Route element={<AppShell />}>
          {/* Public Farmer & Machine Discovery (Zero Login Required) */}
          <Route path="/" element={<FarmerHomePage />} />
          <Route path="/farmer" element={<FarmerHomePage />} />
          <Route path="/farmer/machines/:machineId" element={<MachineDetailsPage />} />
          <Route path="/machines/:machineId" element={<MachineDetailsPage />} />

          {/* Quick Machine Listing (Public / Demo / Owner) */}
          <Route path="/owner/machines/new" element={<MachineFormPage />} />

          {/* Setup Guide (Accessible whenever needed) */}
          <Route path="/setup" element={<SetupRequiredPage />} />

          {/* Authentication & Profile Setup */}
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="/select-role" element={<RoleSelectionGate />} />
            <Route path="/settings" element={<SettingsGate />} />

            <Route element={<RequireRole role="farmer" />}>
              <Route path="/farmer/bookings" element={<FarmerBookingsPage />} />
            </Route>

            <Route element={<RequireRole role="owner" />}>
              <Route path="/owner" element={<OwnerHomePage />} />
              <Route path="/owner/machines" element={<OwnerMachinesPage />} />
              <Route path="/owner/machines/:machineId/edit" element={<MachineFormPage />} />
              <Route path="/owner/machines/:machineId/availability" element={<AvailabilityPage />} />
              <Route path="/owner/bookings" element={<OwnerBookingsPage />} />
            </Route>
          </Route>
        </Route>

        {/* Opened from the password-reset email link */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

/** Keeps a user who opened a reset-password email on the reset page until they finish. */
function RecoveryRedirect() {
  const { recovering } = useAuth()
  const location = useLocation()
  if (recovering && location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />
  }
  return null
}

function PublicOnly() {
  const { initializing, profileLoading, session, profile } = useAuth()
  const { t } = useI18n()

  if (initializing || (session && profileLoading)) {
    return <LoadingScreen message={t('app.loading')} />
  }
  if (session) {
    return <Navigate to={profile ? homeForProfile(profile) : '/select-role'} replace />
  }
  return <Outlet />
}

function RoleSelectionGate() {
  const { profileLoading, profileError, profile } = useAuth()
  const { t } = useI18n()

  if (profileLoading) return <LoadingScreen message={t('app.loading')} />
  if (profileError && !profile) return <ProfileErrorPage />
  if (profile?.role) return <Navigate to={homeForProfile(profile)} replace />
  return <RoleSelectionPage />
}

function SettingsGate() {
  const { profileLoading, profileError, profile } = useAuth()
  const { t } = useI18n()

  if (!profile) {
    if (profileLoading) return <LoadingScreen message={t('app.loading')} />
    if (profileError) return <ProfileErrorPage />
    return <Navigate to="/select-role" replace />
  }
  return <SettingsPage />
}
