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
    <header className="sticky top-0 z-30 border-b border-white/20 bg-white/40 backdrop-blur-md transition-all">
      <div className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        {/* Left: Sidebar Toggles & Search */}
        <div className="flex flex-1 items-center gap-2 sm:gap-3 max-w-xl">
          {/* Mobile Hamburger Menu Toggle */}
          <button
            type="button"
            onClick={toggleMobile}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/80 text-gray-700 shadow-xs backdrop-blur-md hover:bg-white lg:hidden"
            aria-label="Open sidebar menu"
          >
            <Menu className="size-5" />
          </button>

          {/* Desktop Sidebar Toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden size-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/80 text-gray-700 shadow-xs backdrop-blur-md hover:bg-white lg:flex transition-colors"
            title={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
            aria-label={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
          >
            <PanelLeft className="size-4.5" />
          </button>

          {/* Top Bar Quick Search Input (Mockup Pill Style) */}
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('ui.searchPlaceholder')}
              className="h-10 w-full rounded-full border border-white/70 bg-white/80 backdrop-blur-md pl-10 pr-9 text-xs sm:text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </form>
        </div>

        {/* Right: Actions (Language, Notifications, User) */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSelector compact />

          {session ? <NotificationBell /> : null}

          {session && profile ? (
            <Link
              to="/settings"
              className="flex size-10 items-center justify-center rounded-full ring-2 ring-white/90 shadow-xs overflow-hidden hover:opacity-90 transition-opacity"
              aria-label={t('nav.profile')}
              title={profile.full_name}
            >
              <Avatar url={avatarUrl(profile?.avatar_path)} name={profile?.full_name} size="sm" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/60 bg-white/85 px-4 py-1.5 text-xs sm:text-sm font-bold text-gray-800 shadow-xs backdrop-blur-md hover:bg-white"
            >
              <User className="size-4 text-emerald-700" />
              <span>{t('ui.login')}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
