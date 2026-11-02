import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  MapPin,
  Menu,
  PanelLeft,
  Search,
  Sparkles,
  Tractor,
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
import { executeSmartSearch } from '../../services/smartSearch'
import type { SmartSearchResult } from '../../services/smartSearch'
import { getMachineImageUrl } from '../../services/machines'
import { machineTypeLabelKey } from '../../lib/labels'
import { formatPrice } from '../../lib/format'
import { Spinner } from '../ui/Feedback'

export function AppHeader() {
  const { t } = useI18n()
  const { profile, session } = useAuth()
  const { toggleMobile, toggleCollapsed, collapsed } = useSidebar()
  const navigate = useNavigate()
  const location = useLocation()
  const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('hr_user_role') : null
  const isOwnerUser = profile?.role === 'owner' || (!profile && cachedRole === 'owner')
  const isOwnerRoute = location.pathname.startsWith('/owner') || (isOwnerUser && location.pathname !== '/farmer' && location.pathname !== '/')
  const [searchQuery, setSearchQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [smartResult, setSmartResult] = useState<SmartSearchResult | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // Debounced live smart query execution as user types
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) {
      setSmartResult(null)
      setSearching(false)
      return
    }

    setSearching(true)
    const timer = setTimeout(() => {
      void executeSmartSearch(q).then((res) => {
        setSmartResult(res)
        setSearching(false)
      })
    }, 200)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const triggerSearch = (queryStr: string) => {
    setDropdownOpen(false)
    const q = queryStr.trim()
    if (!q) return

    if (isOwnerRoute) {
      navigate(`/owner/machines?q=${encodeURIComponent(q)}`)
      return
    }

    navigate(`/?q=${encodeURIComponent(q)}`)
    window.dispatchEvent(new CustomEvent('harvest-smart-search', { detail: { query: q } }))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    triggerSearch(searchQuery)
  }

  return (
    <header className="sticky top-0 z-30 transition-all border-b border-white/20 bg-white/45 backdrop-blur-md">
      <div className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        {/* Left: Sidebar Toggles & Search */}
        <div className="flex flex-1 items-center gap-2 sm:gap-3 max-w-xl">
          {/* Mobile Hamburger Menu Toggle */}
          <button
            type="button"
            onClick={toggleMobile}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-xs transition-colors lg:hidden border border-white/60 bg-white/80 text-gray-700 backdrop-blur-md hover:bg-white cursor-pointer"
            aria-label="Open sidebar menu"
          >
            <Menu className="size-5" />
          </button>

          {/* Desktop Sidebar Toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden size-10 shrink-0 items-center justify-center rounded-xl shadow-xs transition-colors lg:flex border border-white/60 bg-white/80 text-gray-700 backdrop-blur-md hover:bg-white cursor-pointer"
            title={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
            aria-label={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
          >
            <PanelLeft className="size-4.5" />
          </button>

          {/* Top Bar Quick Search Input with Live Dropdown */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-md">
            <form onSubmit={handleSearch} className="relative w-full">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none text-gray-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onFocus={() => setDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setDropdownOpen(true)
                }}
                placeholder={isOwnerRoute ? 'Search machines, bookings…' : 'Search machines, crops, or village...'}
                className="h-10 w-full pl-10 pr-9 text-xs sm:text-sm font-medium focus:outline-none transition-all rounded-full border border-white/70 bg-white/85 backdrop-blur-md text-gray-800 placeholder:text-gray-500 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setSmartResult(null)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </form>

            {/* Smart Interactive Search Dropdown */}
            {dropdownOpen ? (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-[460px] overflow-y-auto rounded-2xl border border-gray-200 bg-white/98 backdrop-blur-xl p-3 shadow-2xl space-y-3">
                {/* 1. When search bar is empty: Show Suggested Queries */}
                {!searchQuery.trim() ? (
                  <div className="space-y-2">
                    <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Suggested Searches
                    </p>
                    <div className="flex flex-col gap-1">
                      {[
                        { label: '✨ What are the new machines added', q: 'what are the new machine added' },
                        { label: '🌾 How many harvesters in Vijayapura', q: 'how many harvestor machines are there in vijaypura' },
                        { label: '📍 Harvester machines in Vijayapura', q: 'harvester in vijaypura' },
                        { label: '🚜 Combine harvesters in Bengaluru', q: 'bengaluru' },
                        { label: '🌱 Paddy harvesters', q: 'paddy harvester' },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSearchQuery(item.q)
                            triggerSearch(item.q)
                          }}
                          className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-950 transition-colors cursor-pointer group"
                        >
                          <span>{item.label}</span>
                          <ArrowRight className="size-3.5 text-gray-400 group-hover:text-emerald-700 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : searching ? (
                  /* 2. Searching state */
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-500 font-medium">
                    <Spinner className="size-4 text-emerald-600" />
                    <span>Searching machines & locations…</span>
                  </div>
                ) : smartResult ? (
                  /* 3. Search Results & Smart AI Answer */
                  <div className="space-y-3">
                    {/* Smart Natural Language Answer Card */}
                    <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 p-2.5 text-emerald-950">
                      <span className="flex size-7.5 items-center justify-center rounded-lg bg-emerald-700 text-white shrink-0 shadow-2xs">
                        <Sparkles className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black truncate">{smartResult.summary}</p>
                        <p className="text-[10px] text-emerald-700 font-semibold">
                          {smartResult.count > 0 ? `${smartResult.count} machines available right now` : 'Try checking another location'}
                        </p>
                      </div>
                    </div>

                    {/* Machine Previews List */}
                    {smartResult.machines.length > 0 ? (
                      <div className="space-y-1">
                        <p className="px-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          Matching Machines ({smartResult.count})
                        </p>
                        {smartResult.machines.slice(0, 4).map((m) => {
                          const imgUrl = getMachineImageUrl(m.image_path)
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setDropdownOpen(false)
                                navigate(`/farmer/machines/${m.id}`)
                              }}
                              className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-gray-50 transition-colors cursor-pointer group border border-transparent hover:border-gray-200"
                            >
                              <div className="size-10 rounded-lg bg-emerald-50 border border-emerald-100 shrink-0 overflow-hidden flex items-center justify-center text-emerald-700">
                                {imgUrl ? (
                                  <img src={imgUrl} alt={m.model || 'Machine'} className="size-full object-cover" />
                                ) : (
                                  <Tractor className="size-5" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-gray-900 group-hover:text-emerald-700">
                                  {m.model || t(machineTypeLabelKey(m.machine_type))}
                                </p>
                                <p className="truncate text-[11px] text-gray-500 flex items-center gap-1">
                                  <MapPin className="size-3 text-emerald-600 shrink-0" />
                                  <span>{m.village || m.district || 'Karnataka'}</span>
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-black text-emerald-700">
                                  {formatPrice(m.price_per_acre)}
                                </p>
                                <span className="text-[10px] text-gray-400 font-medium">
                                  /{m.pricing_unit === 'per_hour' ? 'hr' : 'acre'}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}

                    {/* Button to View All Results */}
                    <button
                      type="button"
                      onClick={() => triggerSearch(searchQuery)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer"
                    >
                      <span>View all {smartResult.count} results</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Actions (Language, Notifications, User) */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSelector compact />

          {session ? <NotificationBell /> : null}

          {session && profile ? (
            <Link
              to="/settings"
              className="flex size-10 items-center justify-center rounded-full shadow-xs overflow-hidden hover:opacity-90 transition-opacity ring-2 ring-white/90"
              aria-label={t('nav.profile')}
              title={profile.full_name}
            >
              <Avatar url={avatarUrl(profile?.avatar_path)} name={profile?.full_name} size="sm" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex min-h-10 items-center gap-1.5 px-4 py-1.5 text-xs sm:text-sm font-bold shadow-xs transition-colors rounded-full border border-white/60 bg-white/85 text-gray-800 backdrop-blur-md hover:bg-white"
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
