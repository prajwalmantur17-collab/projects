import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
  const location = useLocation()
  const isOwnerRoute = location.pathname.startsWith('/owner')
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return

    if (isOwnerRoute) {
      navigate(`/owner/machines?q=${encodeURIComponent(q)}`)
      return
    }

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
    <header
      className={`sticky top-0 z-30 transition-all ${
        isOwnerRoute
          ? 'border-b border-[#E8E6DA] bg-white/95 backdrop-blur-md shadow-2xs'
          : 'border-b border-white/20 bg-white/40 backdrop-blur-md'
      }`}
    >
      <div className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        {/* Left: Sidebar Toggles & Search */}
        <div className="flex flex-1 items-center gap-2 sm:gap-3 max-w-xl">
          {/* Mobile Hamburger Menu Toggle */}
          <button
            type="button"
            onClick={toggleMobile}
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl shadow-xs transition-colors lg:hidden ${
              isOwnerRoute
                ? 'border border-[#E8E6DA] bg-[#F8F8F2] text-[#1C2B20] hover:bg-white'
                : 'border border-white/60 bg-white/80 text-gray-700 backdrop-blur-md hover:bg-white'
            }`}
            aria-label="Open sidebar menu"
          >
            <Menu className="size-5" />
          </button>

          {/* Desktop Sidebar Toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`hidden size-10 shrink-0 items-center justify-center rounded-xl shadow-xs transition-colors lg:flex ${
              isOwnerRoute
                ? 'border border-[#E8E6DA] bg-[#F8F8F2] text-[#1C2B20] hover:bg-white'
                : 'border border-white/60 bg-white/80 text-gray-700 backdrop-blur-md hover:bg-white'
            }`}
            title={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
            aria-label={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
          >
            <PanelLeft className="size-4.5" />
          </button>

          {/* Top Bar Quick Search Input */}
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
            <Search
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none ${
                isOwnerRoute ? 'text-[#718073]' : 'text-gray-400'
              }`}
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isOwnerRoute ? 'Search machines, bookings…' : t('ui.searchPlaceholder')}
              className={`h-10 w-full pl-10 pr-9 text-xs sm:text-sm font-medium focus:outline-none transition-all ${
                isOwnerRoute
                  ? 'rounded-xl border border-[#E8E6DA] bg-[#F8F8F2] text-[#1C2B20] placeholder:text-[#718073] focus:bg-white focus:border-[#31572C] focus:ring-2 focus:ring-[#31572C]/10 shadow-2xs'
                  : 'rounded-full border border-white/70 bg-white/80 backdrop-blur-md text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-xs'
              }`}
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
              className={`flex size-10 items-center justify-center rounded-full shadow-xs overflow-hidden hover:opacity-90 transition-opacity ${
                isOwnerRoute ? 'ring-2 ring-[#E8E6DA]' : 'ring-2 ring-white/90'
              }`}
              aria-label={t('nav.profile')}
              title={profile.full_name}
            >
              <Avatar url={avatarUrl(profile?.avatar_path)} name={profile?.full_name} size="sm" />
            </Link>
          ) : (
            <Link
              to="/login"
              className={`inline-flex min-h-10 items-center gap-1.5 px-4 py-1.5 text-xs sm:text-sm font-bold shadow-xs transition-colors ${
                isOwnerRoute
                  ? 'rounded-xl border border-[#E8E6DA] bg-[#F8F8F2] text-[#1C2B20] hover:bg-white'
                  : 'rounded-full border border-white/60 bg-white/85 text-gray-800 backdrop-blur-md hover:bg-white'
              }`}
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
