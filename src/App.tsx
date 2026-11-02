import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { RequireAuth, RequireRole } from './auth/Guards'
import { homeForProfile } from './auth/routing'
import { AppShell } from './components/layout/AppShell'
import { LoadingScreen } from './components/ui/Feedback'
import { useI18n } from './i18n'
import { ProfileErrorPage } from './pages/ProfileErrorPage'

const FarmerHomePage = lazy(() => import('./pages/farmer/FarmerHomePage').then((m) => ({ default: m.FarmerHomePage })))
const MachineDetailsPage = lazy(() => import('./pages/farmer/MachineDetailsPage').then((m) => ({ default: m.MachineDetailsPage })))
const FarmerBookingsPage = lazy(() => import('./pages/farmer/FarmerBookingsPage').then((m) => ({ default: m.FarmerBookingsPage })))
const OwnerHomePage = lazy(() => import('./pages/owner/OwnerHomePage').then((m) => ({ default: m.OwnerHomePage })))
const OwnerMachinesPage = lazy(() => import('./pages/owner/OwnerMachinesPage').then((m) => ({ default: m.OwnerMachinesPage })))
const MachineFormPage = lazy(() => import('./pages/owner/MachineFormPage').then((m) => ({ default: m.MachineFormPage })))
const AvailabilityPage = lazy(() => import('./pages/owner/AvailabilityPage').then((m) => ({ default: m.AvailabilityPage })))
const OwnerBookingsPage = lazy(() => import('./pages/owner/OwnerBookingsPage').then((m) => ({ default: m.OwnerBookingsPage })))
const RecordPage = lazy(() => import('./pages/RecordPage').then((m) => ({ default: m.RecordPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const RoleSelectionPage = lazy(() => import('./pages/RoleSelectionPage').then((m) => ({ default: m.RoleSelectionPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const SetupRequiredPage = lazy(() => import('./pages/SetupRequiredPage').then((m) => ({ default: m.SetupRequiredPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

export function App() {
  return (
    <BrowserRouter>
      <RecoveryRedirect />
      <Suspense fallback={<LoadingScreen message="Loading..." />}>
        <Routes>
          <Route element={<AppShell />}>
            {/* Public Farmer & Machine Discovery (Zero Login Required) */}
            <Route path="/" element={<HomeRouteGate />} />
            <Route path="/farmer" element={<FarmerHomePage />} />
            <Route path="/farmer/machines/:machineId" element={<MachineDetailsPage />} />
            <Route path="/machines/:machineId" element={<MachineDetailsPage />} />

            {/* Setup Guide (Accessible whenever needed) */}
            <Route path="/setup" element={<SetupRequiredPage />} />

            {/* Authentication & Profile Setup */}
            <Route element={<PublicOnly />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route path="/select-role" element={<RoleSelectionGate />} />
              <Route path="/settings" element={<SettingsGate />} />
              <Route path="/record" element={<RecordGate />} />

              <Route element={<RequireRole role="farmer" />}>
                <Route path="/farmer/bookings" element={<FarmerBookingsPage />} />
              </Route>

              <Route element={<RequireRole role="owner" />}>
                <Route path="/owner" element={<OwnerHomePage />} />
                <Route path="/owner/machines" element={<OwnerMachinesPage />} />
                <Route path="/owner/machines/new" element={<MachineFormPage />} />
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
      </Suspense>
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

/**
 * Role-aware root router:
 * - If signed in as machine owner -> seamlessly routes to /owner (Harvester Owner Dashboard)
 * - If guest or farmer -> renders FarmerHomePage for instant machine discovery
 * - Direct navigation to /farmer is always available for farmers or owners wishing to view the farmer catalog
 */
function HomeRouteGate() {
  const { session, profile } = useAuth()
  const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('hr_user_role') : null
  const effectiveRole = profile?.role || (session ? cachedRole : null)

  if (session && effectiveRole === 'owner') {
    return <Navigate to="/owner" replace />
  }

  return <FarmerHomePage />
}

function RoleSelectionGate() {
  const { profileLoading, profileError, profile } = useAuth()
  const { t } = useI18n()

  if (profileLoading || (!profile && !profileError)) return <LoadingScreen message={t('app.loading')} />
  if (profileError && !profile) return <ProfileErrorPage />
  if (profile?.role) return <Navigate to={homeForProfile(profile)} replace />
  return <RoleSelectionPage />
}

function SettingsGate() {
  const { profileLoading, profileError, profile } = useAuth()
  const { t } = useI18n()

  if (!profile) {
    if (profileLoading || !profileError) return <LoadingScreen message={t('app.loading')} />
    if (profileError) return <ProfileErrorPage />
    return <Navigate to="/select-role" replace />
  }
  return <SettingsPage />
}

function RecordGate() {
  const { profileLoading, profileError, profile } = useAuth()
  const { t } = useI18n()

  if (!profile) {
    if (profileLoading || !profileError) return <LoadingScreen message={t('app.loading')} />
    if (profileError) return <ProfileErrorPage />
    return <Navigate to="/select-role" replace />
  }
  return <RecordPage />
}
