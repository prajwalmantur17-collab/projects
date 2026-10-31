import { NavLink } from 'react-router-dom'
import { CalendarDays, ClipboardList, House, PlusCircle, Search, Settings, Tractor, User } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/AuthProvider'

export function BottomNav() {
  const { t } = useI18n()
  const { profile, session } = useAuth()
  const isOwner = profile?.role === 'owner'

  const items = isOwner
    ? [
        { to: '/owner', label: t('nav.home'), icon: House, end: true },
        { to: '/owner/machines', label: t('nav.machines'), icon: Tractor, end: false },
        { to: '/owner/bookings', label: t('nav.requests'), icon: ClipboardList, end: false },
        { to: '/settings', label: t('nav.settings'), icon: Settings, end: false },
      ]
    : session
    ? [
        { to: '/', label: t('nav.find'), icon: Search, end: true },
        { to: '/farmer/bookings', label: t('nav.bookings'), icon: CalendarDays, end: false },
        { to: '/settings', label: t('nav.settings'), icon: Settings, end: false },
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
      <div
        className={`mx-auto grid max-w-md ${
          isOwner ? 'grid-cols-4' : 'grid-cols-3'
        }`}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-xs font-semibold ${
                isActive ? 'text-leaf-800 font-bold' : 'text-ink-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex size-8 items-center justify-center rounded-xl ${
                    isActive ? 'bg-leaf-100' : ''
                  }`}
                >
                  <item.icon className="size-5" aria-hidden="true" />
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
