import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Menu,
  PanelLeft,
  Search,
  User,
  X,
} from 'lucide-react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/AuthProvider'
import { LanguageSelector } from '../ui/LanguageSelector'
import { NotificationBell } from './NotificationBell'
import { Avatar } from '../ui/Avatar'
import { avatarUrl } from '../../services/avatars'
import { useSidebar } from './SidebarContext'

export function AppHeader() {
  const { t } = useI18n()
  const { profile, session } = useAuth()
  const { toggleMobile, toggleCollapsed, collapsed } = useSidebar()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return

    // If on home, focus or scroll to search input
    if (window.location.pathname === '/' || window.location.pathname === '/farmer') {
      const input = document.querySelector('input[placeholder*="village"]') as HTMLInputElement | null
      if (input) {
        input.value = q
        input.focus()
        input.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
    }
    navigate(`/?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-cream-200 bg-cream-50/95 backdrop-blur">
      <div className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        {/* Left: Sidebar Toggles & Search */}
        <div className="flex flex-1 items-center gap-2 sm:gap-3 max-w-xl">
          {/* Mobile Hamburger Menu Toggle */}
          <button
            type="button"
            onClick={toggleMobile}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cream-300 bg-white text-ink-muted hover:bg-cream-100 hover:text-ink lg:hidden"
            aria-label="Open sidebar menu"
          >
            <Menu className="size-5" />
          </button>

          {/* Desktop Sidebar Toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-cream-300 bg-white text-ink-muted hover:bg-cream-100 hover:text-ink lg:flex"
            title={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
            aria-label={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
          >
            <PanelLeft className="size-5" />
          </button>

          {/* Top Bar Quick Search Input */}
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-muted pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('ui.searchPlaceholder')}
              className="h-10 w-full rounded-xl border border-cream-300 bg-white pl-9 pr-8 text-sm font-medium text-ink placeholder:text-ink-muted/70 focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-400/20"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </form>
        </div>

        {/* Right: Actions (Language, Notifications, User) */}
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSelector compact />

          {session ? <NotificationBell /> : null}

          {session && profile ? (
            <Link
              to="/settings"
              className="flex size-10 items-center justify-center rounded-xl hover:bg-cream-100"
              aria-label={t('nav.profile')}
              title={profile.full_name}
            >
              <Avatar url={avatarUrl(profile?.avatar_path)} name={profile?.full_name} size="sm" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-cream-300 bg-white px-3.5 py-1.5 text-sm font-bold text-ink hover:bg-cream-100"
            >
              <User className="size-4 text-ink-muted" />
              <span>{t('ui.login')}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
