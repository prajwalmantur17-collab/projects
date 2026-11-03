import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sprout,
  Tractor,
  User,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import { LogoMark } from '../brand/Logo'
import { Avatar } from '../ui/Avatar'
import { avatarUrl } from '../../services/avatars'
import { usePendingRequests } from '../../hooks/usePendingRequests'
import { useNotifications } from '../../hooks/useNotifications'
import { useSidebar } from './SidebarContext'
import { OWNER_SIDEBAR_NAV, FARMER_SIDEBAR_NAV, type NavItemDef } from './navConfig'

function SidebarNavSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-2xl bg-white/5" />
      ))}
    </div>
  )
}

/** Menu entries that need an account; guests never see them. */
const GUEST_HIDDEN_IDS = new Set([
  'farmer-bookings',
  'farmer-records',
  'farmer-notifications',
  'farmer-profile',
  'farmer-settings',
])

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen, setHelpModalOpen } = useSidebar()
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    setIsDesktop(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const { profile, session, signOut, initializing } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('hr_user_role') : null
  // Only a signed-in user can be an owner; a stale cached role must never show owner menus to a guest.
  const isOwner =
    Boolean(session) &&
    (profile?.role === 'owner' || (!profile && cachedRole === 'owner') || location.pathname.startsWith('/owner'))
  const homePath = isOwner ? '/owner' : '/'
  const pendingRequests = usePendingRequests(isOwner ? profile?.id : undefined)
  const { unreadCount } = useNotifications(profile?.id, 'sidebar')

  // Real unread notification count directly from database; hide badge when 0
  const displayNotifBadge = unreadCount > 0 ? unreadCount : undefined

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileMenuOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [profileMenuOpen])

  // Lock page scroll while the mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileOpen])

  // Close drawer on path change on mobile
  useEffect(() => {
    setMobileOpen(false)
    setProfileMenuOpen(false)
  }, [location.pathname, location.search, setMobileOpen])

  const handleNavClick = (action?: () => void) => {
    setMobileOpen(false)
    setProfileMenuOpen(false)
    action?.()
  }

  const handleMyCropsClick = (e: React.MouseEvent) => {
    e.preventDefault()
    handleNavClick()
    if (location.pathname === '/' || location.pathname === '/farmer') {
      const el = document.getElementById('crop-selection-section')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    navigate('/?section=crops')
  }

  const handleFindMachineClick = (e: React.MouseEvent) => {
    e.preventDefault()
    handleNavClick()
    if (location.pathname === '/' || location.pathname === '/farmer') {
      const el = document.getElementById('search-heading')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    navigate('/')
  }

  const baseNav: NavItemDef[] = isOwner ? OWNER_SIDEBAR_NAV : FARMER_SIDEBAR_NAV
  const navDefs: NavItemDef[] = session ? baseNav : baseNav.filter((def) => !GUEST_HIDDEN_IDS.has(def.id))

  const navItems = navDefs.map((def) => {
    let isActive = false
    if (def.isCropAction) {
      isActive = location.search.includes('section=crops')
    } else if (def.end) {
      isActive = location.pathname === def.to
    } else if (def.to.startsWith('/')) {
      isActive = location.pathname === def.to || (def.to !== '/' && location.pathname.startsWith(def.to))
    }

    let badge: number | undefined
    let badgeColor: string | undefined
    if (def.badgeType === 'pending_requests' && pendingRequests > 0) {
      badge = pendingRequests
      badgeColor = 'bg-amber-500 text-white font-bold'
    } else if (def.badgeType === 'notifications' && displayNotifBadge) {
      badge = displayNotifBadge
      badgeColor = 'bg-red-500 text-white font-bold'
    }

    let onClick: ((e: React.MouseEvent) => void) | undefined
    if (def.isHelpAction) {
      onClick = (e: React.MouseEvent) => {
        e.preventDefault()
        handleNavClick()
        setHelpModalOpen(true)
      }
    } else if (def.isCropAction) {
      onClick = handleMyCropsClick
    } else if (def.id === 'find') {
      onClick = handleFindMachineClick
    }

    return {
      id: def.id,
      label: t(def.labelKey),
      to: def.to,
      icon: def.icon,
      badge,
      badgeColor,
      isActive,
      onClick,
    }
  })

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Main Sidebar Element */}
      <aside
        aria-label={t('a11y.primaryNav')}
        inert={!isDesktop && !mobileOpen ? true : undefined}
        aria-hidden={!isDesktop && !mobileOpen ? 'true' : undefined}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0e2114]/98 backdrop-blur-md border-r border-[#1a4128] text-white transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          /* Mobile Drawer */
          mobileOpen ? 'translate-x-0 w-[280px] shadow-2xl' : '-translate-x-full lg:translate-x-0'
        } ${
          /* Desktop Widths */
          collapsed ? 'lg:w-[76px]' : 'lg:w-[260px]'
        }`}
      >
        {/* A. Branding Section */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#183b23] px-4">
          <Link
            to={homePath}
            onClick={() => handleNavClick()}
            className="flex items-center gap-2.5 overflow-hidden group focus-visible:outline-none"
            aria-label={t('app.name')}
          >
            <LogoMark className="size-8 shrink-0 transition-transform group-hover:scale-105" />
            <span
              className={`font-bold text-lg tracking-tight text-white whitespace-nowrap transition-opacity duration-200 ${
                collapsed ? 'lg:hidden opacity-0' : 'opacity-100'
              }`}
            >
              Harvest Rentals
            </span>
          </Link>

          {/* Desktop Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`hidden lg:flex size-8 items-center justify-center rounded-lg text-[#8BCB73] hover:bg-[#163823] transition-colors ${
              collapsed ? 'mx-auto' : ''
            }`}
            title={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
            aria-label={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex lg:hidden size-8 items-center justify-center rounded-lg text-[#8BCB73] hover:bg-[#163823]"
            aria-label={t('ui.closeSidebar')}
          >
            <PanelLeftClose className="size-5" />
          </button>
        </div>

        {/* B. Main Navigation List */}
        <nav
          aria-label={t('a11y.primaryNav')}
          className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-4 space-y-1.5"
        >
          {initializing ? <SidebarNavSkeleton /> : null}
          {(initializing ? [] : navItems).map((item) => {
            const Icon = item.icon
            const isItemActive = item.isActive

            return (
              <div key={item.id} className="relative group">
                <Link
                  to={item.to}
                  onClick={item.onClick ? item.onClick : () => handleNavClick()}
                  className={`flex min-h-11 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 ${
                    isItemActive
                      ? 'bg-[#294C32] text-white font-bold shadow-inner'
                      : 'text-[#a3bfa3] hover:bg-[#163823] hover:text-white'
                  } ${collapsed ? 'lg:justify-center lg:gap-0 lg:px-0' : ''}`}
                  aria-current={isItemActive ? 'page' : undefined}
                >
                  <Icon
                    className={`size-5 shrink-0 transition-colors ${
                      isItemActive ? 'text-[#4ade80]' : 'text-[#8BCB73]/70 group-hover:text-[#4ade80]'
                    }`}
                    aria-hidden="true"
                  />

                  {/* Label (hidden when collapsed on desktop) */}
                  <span
                    className={`block truncate whitespace-nowrap transition-[opacity,max-width] duration-200 ease-out ${
                      collapsed ? 'lg:max-w-0 lg:opacity-0' : 'max-w-[200px] opacity-100'
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Badge */}
                  {item.badge ? (
                    <span
                      className={`ml-auto flex size-5 min-w-5 items-center justify-center rounded-full text-[11px] font-black leading-none ${
                        item.badgeColor || 'bg-harvest-500 text-ink'
                      } ${collapsed ? 'lg:absolute lg:top-1.5 lg:right-1.5' : ''}`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>

                {/* Floating Tooltip when collapsed on desktop */}
                {collapsed ? (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden rounded-md bg-[#0a180f] px-2.5 py-1 text-xs font-semibold text-white shadow-xl ring-1 ring-[#234D2C] whitespace-nowrap group-hover:lg:block"
                  >
                    {item.label}
                    {item.badge ? ` (${item.badge})` : ''}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>

        {/* C & D. User Profile, Promo Card & Bottom Actions Section */}
        <div className="shrink-0 border-t border-[#183b23] p-3 space-y-2.5">
          {initializing ? (
            <div className="h-12 animate-pulse rounded-2xl bg-white/5" aria-hidden="true" />
          ) : session && profile ? (
            <div ref={profileMenuRef} className="relative">
              {/* Profile Card Button */}
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className={`flex w-full items-center gap-2.5 rounded-2xl bg-black/30 border border-white/10 p-2 text-left transition-colors hover:bg-white/5 hover:border-white/20 ${
                  collapsed ? 'lg:justify-center lg:p-2' : ''
                }`}
                title={collapsed ? `${profile.full_name} (${profile.role})` : undefined}
                aria-expanded={profileMenuOpen}
                aria-haspopup="true"
              >
                <div className="relative shrink-0">
                  <Avatar
                    url={avatarUrl(profile.avatar_path)}
                    name={profile.full_name}
                    size="sm"
                    className="ring-1 ring-[#4ade80]/50"
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[#4ade80] ring-2 ring-[#0e2114]"
                    aria-hidden="true"
                  />
                </div>

                <div
                  className={`min-w-0 flex-1 transition-opacity duration-200 ${
                    collapsed ? 'lg:hidden' : 'block'
                  }`}
                >
                  <p className="truncate text-xs font-bold text-white">
                    {profile.full_name || t('nav.profile')}
                  </p>
                  <p className="truncate text-[11px] font-medium text-[#8BCB73] capitalize">
                    {profile.role === 'owner' ? t('role.owner') : t('role.farmer')}
                  </p>
                </div>

                <ChevronDown
                  className={`size-4 text-[#8BCB73] transition-transform duration-200 ${
                    profileMenuOpen ? 'rotate-180' : ''
                  } ${collapsed ? 'lg:hidden' : 'block'}`}
                  aria-hidden="true"
                />
              </button>

              {/* Floating Tooltip when collapsed */}
              {collapsed ? (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden rounded-md bg-[#0a180f] px-2.5 py-1 text-xs font-semibold text-white shadow-xl ring-1 ring-[#234D2C] whitespace-nowrap group-hover:lg:block"
                >
                  {profile.full_name} · {profile.role}
                </div>
              ) : null}

              {/* Profile Dropdown Popup Menu */}
              {profileMenuOpen ? (
                <div className="hr-tab-content absolute bottom-full left-0 mb-2 w-full min-w-[200px] rounded-2xl border border-[#234D2C] bg-[#0c1f14] p-1.5 shadow-2xl z-50">
                  <Link
                    to="/settings"
                    onClick={() => handleNavClick()}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#c5d5c5] hover:bg-[#1c3f25] hover:text-white"
                  >
                    <User className="size-3.5 text-[#8BCB73]" />
                    <span>{t('ui.viewProfile')}</span>
                  </Link>

                  <Link
                    to="/settings"
                    onClick={() => handleNavClick()}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#c5d5c5] hover:bg-[#1c3f25] hover:text-white"
                  >
                    <Settings className="size-3.5 text-[#8BCB73]" />
                    <span>{t('nav.settings')}</span>
                  </Link>

                  <div className="my-1 border-t border-[#1e4128]" />

                  <button
                    type="button"
                    onClick={() => {
                      handleNavClick()
                      void signOut()
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300"
                  >
                    <LogOut className="size-3.5" />
                    <span>{t('ui.logout')}</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            /* Guest / Login prompt */
            <Link
              to="/login"
              onClick={() => handleNavClick()}
              className={`flex w-full items-center gap-2 rounded-2xl border border-[#1e4128] bg-[#163823] p-2.5 text-xs font-bold text-white transition-colors hover:bg-[#1c3f25] hover:border-[#8BCB73] ${
                collapsed ? 'lg:justify-center' : ''
              }`}
            >
              <LogIn className="size-4 text-[#8BCB73] shrink-0" />
              <span className={collapsed ? 'lg:hidden' : 'block'}>{t('ui.login')}</span>
            </Link>
          )}

          {/* Promotional Mini Card matching reference mockup */}
          <div
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#163823] to-[#0c1f14] p-3 shadow-md transition-all ${
              collapsed ? 'lg:hidden' : 'block'
            }`}
          >
            {isOwner ? (
              <Link
                to="/owner/machines/new"
                onClick={() => handleNavClick()}
                className="block group cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-[#4ade80] mb-1">
                  <Tractor className="size-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8BCB73]">{t('ui.partnerFleet')}</span>
                </div>
                <p className="text-xs font-bold text-white leading-tight group-hover:text-[#4ade80] transition-colors">{t('ui.listMoreMachines')}</p>
                <p className="text-[10px] text-emerald-300/80 font-medium mt-1">{t('ui.directFarmerBookings')}</p>
              </Link>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-[#4ade80] mb-1">
                  <Sprout className="size-3.5" />
                </div>
                <p className="text-xs font-bold text-white leading-tight">{t('ui.growBetter')}</p>
                <p className="text-xs font-bold text-white leading-tight">{t('ui.withHarvestRentals')}</p>
                <p className="text-[10px] text-emerald-300/80 font-medium mt-1">{t('ui.rentGrowProsper')}</p>
              </>
            )}
          </div>

          {/* Quick Logout Button (anchored at bottom) */}
          {session ? (
            <button
              type="button"
              onClick={() => {
                handleNavClick()
                void signOut()
              }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-red-950/40 hover:text-red-300 transition-colors ${
                collapsed ? 'lg:justify-center' : ''
              }`}
              title={t('ui.logout')}
            >
              <LogOut className="size-4 shrink-0" />
              <span className={collapsed ? 'lg:hidden' : 'block'}>{t('ui.logout')}</span>
            </button>
          ) : null}
        </div>
      </aside>
    </>
  )
}
