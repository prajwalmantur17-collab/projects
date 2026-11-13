import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import { LogoMark } from '../brand/Logo'
import { Avatar } from '../ui/Avatar'
import { ModeSwitchButton } from '../account/ModeSwitchButton'
import { avatarUrl } from '../../services/avatars'
import { usePendingRequests } from '../../hooks/usePendingRequests'
import { useNotifications } from '../../hooks/useNotifications'
import { useSidebar } from './SidebarContext'
import {
  FARMER_SIDEBAR_SECTIONS,
  OWNER_SIDEBAR_SECTIONS,
  type NavItemDef,
  type NavSectionDef,
} from './navConfig'

function SidebarNavSkeleton() {
  return (
    <div className="space-y-3 px-1" aria-hidden="true">
      <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
      <div className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="h-3 w-14 animate-pulse rounded bg-white/10 pt-2" />
      <div className="space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  )
}

/** Menu items that require authentication; unauthenticated guests never see them. */
const GUEST_HIDDEN_IDS = new Set([
  'farmer-bookings',
  'farmer-records',
  'farmer-crops',
  'farmer-profile',
  'farmer-notifications',
  'farmer-settings',
  'owner-machines',
  'owner-requests',
  'owner-rentals',
  'owner-history',
  'owner-profile',
  'owner-notifications',
  'owner-settings',
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
  const isOwner =
    Boolean(session) &&
    (profile?.role === 'owner' || (!profile && cachedRole === 'owner') || location.pathname.startsWith('/owner'))
  const homePath = isOwner ? '/owner' : '/'

  const pendingRequests = usePendingRequests(isOwner ? profile?.id : undefined)
  const { unreadCount } = useNotifications(profile?.id, 'sidebar')
  const displayNotifBadge = unreadCount > 0 ? unreadCount : undefined

  // Close profile dropdown on outside click or escape
  useEffect(() => {
    if (!profileMenuOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [profileMenuOpen])

  // Lock page scroll while mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
    setProfileMenuOpen(false)
  }, [location.pathname, location.search, setMobileOpen])

  const handleNavClick = (action?: () => void) => {
    setMobileOpen(false)
    setProfileMenuOpen(false)
    action?.()
  }

  const handleFindMachineClick = (e: React.MouseEvent) => {
    e.preventDefault()
    handleNavClick()
    if (location.pathname === '/' || location.pathname === '/farmer') {
      const el = document.getElementById('search-heading') || document.getElementById('search-input')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    navigate('/')
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

  // Filter sections and items based on authentication state
  const rawSections: NavSectionDef[] = isOwner ? OWNER_SIDEBAR_SECTIONS : FARMER_SIDEBAR_SECTIONS
  const sections: NavSectionDef[] = rawSections
    .map((section) => ({
      ...section,
      items: session
        ? section.items
        : section.items.filter((item) => !GUEST_HIDDEN_IDS.has(item.id)),
    }))
    .filter((section) => section.items.length > 0)

  const isItemActive = (def: NavItemDef): boolean => {
    if (def.isCropAction) {
      return location.search.includes('section=crops')
    }
    if (def.to.includes('tab=confirmed')) {
      return location.pathname === '/owner/bookings' && location.search.includes('tab=confirmed')
    }
    if (def.id === 'owner-requests') {
      return location.pathname === '/owner/bookings' && !location.search.includes('tab=confirmed')
    }
    if (def.end) {
      return location.pathname === def.to
    }
    if (def.to.startsWith('/')) {
      return location.pathname === def.to || (def.to !== '/' && def.to !== '/owner' && location.pathname.startsWith(def.to))
    }
    return false
  }

  const getItemBadge = (def: NavItemDef) => {
    if (def.badgeType === 'pending_requests' && pendingRequests > 0) {
      return { count: pendingRequests, color: 'bg-amber-500 text-ink-950 font-black' }
    }
    if (def.badgeType === 'notifications' && displayNotifBadge) {
      return { count: displayNotifBadge, color: 'bg-rose-500 text-white font-bold' }
    }
    return null
  }

  const getItemClickHandler = (def: NavItemDef) => {
    if (def.isHelpAction) {
      return (e: React.MouseEvent) => {
        e.preventDefault()
        handleNavClick()
        setHelpModalOpen(true)
      }
    }
    if (def.isCropAction) {
      return handleMyCropsClick
    }
    if (def.isSearchAction) {
      return handleFindMachineClick
    }
    return () => handleNavClick()
  }

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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0B2B1E] border-r border-[#15462D] text-white transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          /* Mobile Drawer: 280px wide */
          mobileOpen ? 'translate-x-0 w-[280px] shadow-2xl' : '-translate-x-full lg:translate-x-0'
        } ${
          /* Desktop Widths: 260px expanded, 76px collapsed */
          collapsed ? 'lg:w-[76px]' : 'lg:w-[260px]'
        }`}
      >
        {/* ============================================================= */}
        {/* SECTION 1: BRAND HEADER                                       */}
        {/* ============================================================= */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#15462D] px-4">
          <Link
            to={homePath}
            onClick={() => handleNavClick()}
            className="flex items-center gap-3 overflow-hidden group focus-visible:outline-none"
            aria-label="HarvestRent"
          >
            <LogoMark className="size-8 shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <div
              className={`flex flex-col transition-[opacity,transform] duration-200 ${
                collapsed ? 'lg:hidden opacity-0 -translate-x-2' : 'opacity-100 translate-x-0'
              }`}
            >
              <span className="font-display font-extrabold text-base tracking-tight text-white whitespace-nowrap leading-tight">
                HarvestRent
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#8FB8A0]/80">
                AgriTech Platform
              </span>
            </div>
          </Link>

          {/* Desktop Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`hidden lg:flex size-8 items-center justify-center rounded-lg text-[#A9C7B6] hover:text-white hover:bg-[#133A26] transition-colors cursor-pointer ${
              collapsed ? 'mx-auto' : ''
            }`}
            title={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
            aria-label={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
          >
            {collapsed ? <PanelLeftOpen className="size-4.5" /> : <PanelLeftClose className="size-4.5" />}
          </button>

          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex lg:hidden size-8 items-center justify-center rounded-lg text-[#A9C7B6] hover:text-white hover:bg-[#133A26] cursor-pointer"
            aria-label={t('ui.closeSidebar')}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* ============================================================= */}
        {/* SECTION 2: WORKSPACE / MODE SWITCHER                          */}
        {/* ============================================================= */}
        {session && profile ? (
          <div className="shrink-0 px-3 pt-3 pb-2 border-b border-[#15462D]/60">
            <div className={`mb-1.5 px-1 ${collapsed ? 'lg:hidden' : 'block'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6F957E]">
                Workspace
              </p>
            </div>
            <ModeSwitchButton
              variant="sidebar"
              collapsed={collapsed}
              onAfterSwitch={() => setMobileOpen(false)}
            />
          </div>
        ) : null}

        {/* ============================================================= */}
        {/* SECTION 3: SECTIONED NAVIGATION LIST                          */}
        {/* ============================================================= */}
        <nav
          aria-label={t('a11y.primaryNav')}
          className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-3 space-y-4"
        >
          {initializing ? <SidebarNavSkeleton /> : null}

          {!initializing &&
            sections.map((section) => (
              <div key={section.id} className="space-y-1">
                {/* Section Header Label (Expanded: text, Collapsed: subtle divider) */}
                <div className={`px-2 py-1 ${collapsed ? 'lg:hidden' : 'block'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6F957E] select-none">
                    {t(section.titleKey)}
                  </p>
                </div>
                {collapsed ? (
                  <div className="hidden lg:block h-px bg-[#15462D]/60 mx-2 my-2" aria-hidden="true" />
                ) : null}

                {/* Section Navigation Items */}
                <div className="space-y-1">
                  {section.items.map((def) => {
                    const Icon = def.icon
                    const active = isItemActive(def)
                    const badgeInfo = getItemBadge(def)
                    const labelText = t(def.labelKey)

                    return (
                      <div key={def.id} className="relative group">
                        <Link
                          to={def.to}
                          onClick={getItemClickHandler(def)}
                          className={`relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                            active
                              ? 'bg-[#168052] text-white font-bold shadow-xs'
                              : 'text-[#A9C7B6] hover:bg-[#133A26] hover:text-white'
                          } ${collapsed ? 'lg:justify-center lg:gap-0 lg:px-0' : ''}`}
                          aria-current={active ? 'page' : undefined}
                        >
                          {/* Active Accent Bar */}
                          {active ? (
                            <span
                              className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#E8B84A]"
                              aria-hidden="true"
                            />
                          ) : null}

                          {/* Navigation Icon */}
                          <Icon
                            className={`size-5 shrink-0 transition-colors ${
                              active ? 'text-[#E8B84A]' : 'text-[#8FB8A0] group-hover:text-white'
                            }`}
                            aria-hidden="true"
                          />

                          {/* Label (hidden when collapsed on desktop) */}
                          <span
                            className={`block truncate whitespace-nowrap transition-[opacity,max-width] duration-200 ease-out ${
                              collapsed ? 'lg:max-w-0 lg:opacity-0' : 'max-w-[170px] opacity-100'
                            }`}
                          >
                            {labelText}
                          </span>

                          {/* Counter / Badge */}
                          {badgeInfo ? (
                            <span
                              className={`ml-auto flex size-5 min-w-5 items-center justify-center rounded-full text-[11px] leading-none ${
                                badgeInfo.color
                              } ${collapsed ? 'lg:absolute lg:top-1 lg:right-1.5' : ''}`}
                            >
                              {badgeInfo.count}
                            </span>
                          ) : null}
                        </Link>

                        {/* Floating Tooltip when collapsed on desktop */}
                        {collapsed ? (
                          <div
                            role="tooltip"
                            className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden rounded-lg bg-[#071F14] px-3 py-1.5 text-xs font-semibold text-white shadow-2xl ring-1 ring-[#1E4D34] whitespace-nowrap group-hover:lg:flex items-center gap-2"
                          >
                            <span>{labelText}</span>
                            {badgeInfo ? (
                              <span className="rounded-full bg-[#168052] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {badgeInfo.count}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </nav>

        {/* ============================================================= */}
        {/* SECTION 4: FIXED BOTTOM PROFILE SECTION                       */}
        {/* ============================================================= */}
        <div className="shrink-0 border-t border-[#15462D] p-3">
          {initializing ? (
            <div className="h-12 animate-pulse rounded-2xl bg-white/5" aria-hidden="true" />
          ) : session && profile ? (
            <div ref={profileMenuRef} className="relative">
              {/* Profile Card Button */}
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className={`flex w-full items-center gap-2.5 rounded-xl bg-black/25 border border-white/10 p-2 text-left transition-colors hover:bg-white/5 hover:border-white/20 cursor-pointer ${
                  collapsed ? 'lg:justify-center lg:p-2' : ''
                }`}
                title={collapsed ? `${profile.full_name} (${profile.role === 'owner' ? t('role.owner') : t('role.farmer')})` : undefined}
                aria-expanded={profileMenuOpen}
                aria-haspopup="true"
              >
                <div className="relative shrink-0">
                  <Avatar
                    url={avatarUrl(profile.avatar_path)}
                    name={profile.full_name}
                    size="sm"
                    className="ring-1 ring-[#4ADE80]/50"
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[#4ADE80] ring-2 ring-[#0B2B1E]"
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
                  <p className="truncate text-[11px] font-semibold text-[#8BCB73] capitalize">
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

              {/* Floating Tooltip when collapsed on desktop */}
              {collapsed ? (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden rounded-md bg-[#071F14] px-2.5 py-1 text-xs font-semibold text-white shadow-xl ring-1 ring-[#1E4D34] whitespace-nowrap group-hover:lg:block"
                >
                  {profile.full_name} · {profile.role === 'owner' ? t('role.owner') : t('role.farmer')}
                </div>
              ) : null}

              {/* Profile Dropdown Popup Menu */}
              {profileMenuOpen ? (
                <div className="hr-tab-content absolute bottom-full left-0 mb-2 w-full min-w-[210px] rounded-2xl border border-[#234D2C] bg-[#0A2216]/98 backdrop-blur-md p-1.5 shadow-2xl z-50">
                  <Link
                    to="/settings"
                    onClick={() => handleNavClick()}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#c5d5c5] hover:bg-[#1c3f25] hover:text-white transition-colors"
                  >
                    <User className="size-3.5 text-[#8BCB73]" />
                    <span>{t('ui.viewProfile')}</span>
                  </Link>

                  <Link
                    to="/settings"
                    onClick={() => handleNavClick()}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#c5d5c5] hover:bg-[#1c3f25] hover:text-white transition-colors"
                  >
                    <Settings className="size-3.5 text-[#8BCB73]" />
                    <span>{t('nav.settings')}</span>
                  </Link>

                  <div className="my-1 border-t border-[#1e4128]" />

                  <ModeSwitchButton
                    variant="menu-item"
                    onAfterSwitch={() => {
                      setProfileMenuOpen(false)
                      setMobileOpen(false)
                    }}
                  />

                  <div className="my-1 border-t border-[#1e4128]" />

                  <button
                    type="button"
                    onClick={() => {
                      handleNavClick()
                      void signOut()
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    <LogOut className="size-3.5" />
                    <span>{t('ui.logout')}</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            /* Unauthenticated Guest State */
            <Link
              to="/login"
              onClick={() => handleNavClick()}
              className={`flex w-full items-center gap-2.5 rounded-xl border border-[#1E4D34] bg-[#143D28] p-2.5 text-xs font-bold text-white transition-colors hover:bg-[#1A4D32] hover:border-[#4ADE80] ${
                collapsed ? 'lg:justify-center' : ''
              }`}
            >
              <LogIn className="size-4 text-[#8BCB73] shrink-0" />
              <span className={collapsed ? 'lg:hidden' : 'block'}>{t('ui.login')}</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}
