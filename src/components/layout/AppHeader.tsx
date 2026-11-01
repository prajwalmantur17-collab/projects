import { Link, NavLink } from 'react-router-dom'
import { PlusCircle, User } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/AuthProvider'
import { LogoMark } from '../brand/Logo'
import { LanguageSelector } from '../ui/LanguageSelector'
import { NotificationBell } from './NotificationBell'

export function AppHeader() {
  const { t } = useI18n()
  const { profile, session } = useAuth()
  const isOwner = profile?.role === 'owner'
  const home = isOwner ? '/owner' : '/'

  return (
    <header className="sticky top-0 z-30 border-b border-cream-200 bg-cream-50/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link
          to={home}
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg pr-1"
          aria-label={t('app.name')}
        >
          <LogoMark className="size-9 shrink-0" />
          <span className="truncate text-lg font-extrabold tracking-tight text-leaf-900 sm:text-xl">
            {t('app.name')}
          </span>
        </Link>

        <nav aria-label={t('a11y.primaryNav')} className="hidden items-center gap-1.5 lg:flex">
          {session ? (
            isOwner ? (
              <>
                <HeaderLink to="/owner" label={t('nav.home')} />
                <HeaderLink to="/owner/machines/new" label={t('nav.addMachine')} />
                <HeaderLink to="/owner/machines" label={t('nav.machines')} />
                <HeaderLink to="/owner/bookings" label={t('nav.requests')} />
                <HeaderLink to="/record" label={t('record.link')} />
                <HeaderLink to="/settings" label={t('nav.settings')} />
              </>
            ) : (
              <>
                <HeaderLink to="/" label={t('nav.find')} />
                <HeaderLink to="/farmer/bookings" label={t('nav.bookings')} />
                <HeaderLink to="/record" label={t('record.link')} />
                <HeaderLink to="/settings" label={t('nav.settings')} />
              </>
            )
          ) : (
            <>
              <HeaderLink to="/" label={t('nav.find')} />
              <Link
                to="/owner/machines/new"
                className="flex min-h-10 items-center gap-1.5 rounded-lg bg-leaf-100 px-3 text-sm font-bold text-leaf-900 transition-colors hover:bg-leaf-200"
              >
                <PlusCircle className="size-4 text-leaf-700" />
                <span>List Your Machine</span>
              </Link>
              <Link
                to="/login"
                className="flex min-h-10 items-center gap-1.5 rounded-lg border border-cream-300 px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-cream-100"
              >
                <User className="size-4 text-ink-muted" />
                <span>Owner Login</span>
              </Link>
            </>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <LanguageSelector compact />
          {session ? <NotificationBell /> : null}
        </div>
      </div>
    </header>
  )
}

function HeaderLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/' || to === '/farmer' || to === '/owner'}
      className={({ isActive }) =>
        `flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
          isActive ? 'bg-leaf-100 text-leaf-900' : 'text-ink-soft hover:bg-cream-100'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
