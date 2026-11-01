import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { CalendarDays, House, Inbox, PlusCircle, Search, Tractor, User } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/AuthProvider'
import { usePendingRequests } from '../../hooks/usePendingRequests'
import { NavBadge } from './NavBadge'

interface Item {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
  badge?: number
}

export function BottomNav() {
  const { t } = useI18n()
  const { profile, session } = useAuth()
  const isOwner = profile?.role === 'owner'
  const pending = usePendingRequests(isOwner ? profile?.id : undefined)

  const items: Item[] = isOwner
    ? [
        { to: '/owner', label: t('nav.home'), icon: House, end: true },
        { to: '/owner/bookings', label: t('nav.requestsShort'), icon: Inbox, end: false, badge: pending },
        { to: '/owner/machines', label: t('nav.machinesShort'), icon: Tractor, end: false },
        { to: '/settings', label: t('nav.profile'), icon: User, end: false },
      ]
    : session
      ? [
          { to: '/', label: t('nav.find'), icon: Search, end: true },
          { to: '/farmer/bookings', label: t('nav.bookingsShort'), icon: CalendarDays, end: false },
          { to: '/settings', label: t('nav.profile'), icon: User, end: false },
        ]
      : [
          { to: '/', label: t('nav.find'), icon: Search, end: true },
          { to: '/owner/machines/new', label: 'List Machine', icon: PlusCircle, end: false },
          { to: '/login', label: 'Owner Login', icon: User, end: false },
        ]

  return (
    <nav
      aria-label={t('a11y.primaryNav')}
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 backdrop-blur lg:hidden"
    >
      <div className={`mx-auto grid max-w-md ${isOwner ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
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
                  {item.badge ? (
                    <NavBadge count={item.badge} className="absolute -right-2 -top-1.5" />
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
