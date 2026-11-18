import { NavLink, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/AuthProvider'
import { usePendingRequests } from '../../hooks/usePendingRequests'
import { NavBadge } from './NavBadge'
import { FARMER_BOTTOM_NAV, GUEST_BOTTOM_NAV, OWNER_BOTTOM_NAV } from './navConfig'

export function BottomNav() {
  const { t } = useI18n()
  const { profile, session } = useAuth()
  const location = useLocation()
  const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('hr_user_role') : null
  const isOwner =
    Boolean(session) &&
    (profile?.role === 'owner' || (!profile && cachedRole === 'owner') || location.pathname.startsWith('/owner'))
  const pending = usePendingRequests(isOwner ? profile?.id : undefined)

  const defs = isOwner ? OWNER_BOTTOM_NAV : session ? FARMER_BOTTOM_NAV : GUEST_BOTTOM_NAV

  return (
    <nav
      aria-label={t('a11y.primaryNav')}
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 backdrop-blur lg:hidden"
    >
      <div className={`mx-auto grid max-w-md ${isOwner ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {defs.map((item) => {
          const badgeCount = item.badgeType === 'pending_requests' ? pending : undefined
          return (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) =>
                `relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-xs font-semibold ${
                  isActive ? 'font-bold text-leaf-800' : 'text-ink-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-leaf-600"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className={`relative flex size-9 items-center justify-center rounded-xl ${
                      isActive ? 'bg-leaf-100' : ''
                    }`}
                  >
                    <item.icon className="size-6" aria-hidden="true" />
                    {badgeCount ? (
                      <NavBadge count={badgeCount} className="absolute -right-2 -top-1.5" />
                    ) : null}
                  </span>
                  <span className="max-w-full truncate">{t(item.labelKey)}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
