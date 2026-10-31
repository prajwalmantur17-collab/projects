import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAuth } from './AuthProvider'
import { homeForProfile } from './routing'
import { LoadingScreen } from '../components/ui/Feedback'

export function RequireAuth() {
  const { session, initializing } = useAuth()
  const location = useLocation()
  const { t } = useI18n()

  if (initializing) return <LoadingScreen message={t('app.loading')} />
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function RequireRole({ role }: { role: 'farmer' | 'owner' }) {
  const { profile, profileLoading, profileError, session } = useAuth()
  const { t } = useI18n()

  if (!session) return <Navigate to="/login" replace />
  if (!profile) {
    if (profileLoading) return <LoadingScreen message={t('app.loading')} />
    if (profileError) return <Navigate to="/select-role" replace />
    return <Navigate to="/select-role" replace />
  }
  if (profile.role !== role) {
    return <Navigate to={homeForProfile(profile)} replace />
  }
  return <Outlet />
}
