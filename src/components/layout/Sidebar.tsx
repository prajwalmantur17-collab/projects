import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  ChevronDown,
  HelpCircle,
  House,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sprout,
  User,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { LogoMark } from '../brand/Logo'
import { Avatar } from '../ui/Avatar'
import { avatarUrl } from '../../services/avatars'
import { usePendingRequests } from '../../hooks/usePendingRequests'
import { useNotifications } from '../../hooks/useNotifications'
import { useSidebar } from './SidebarContext'

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen, setHelpModalOpen } = useSidebar()
  const { profile, session, signOut } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const isOwner = profile?.role === 'owner'
  const homePath = isOwner ? '/owner' : '/'
  const bookingsPath = isOwner ? '/owner/bookings' : session ? '/farmer/bookings' : '/login'
  const pendingRequests = usePendingRequests(isOwner ? profile?.id : undefined)
  const { unreadCount } = useNotifications(profile?.id)

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

  // 8 Main Navigation Items in exact requested order
  const navItems = [
    {
      id: 'home',
      label: t('nav.home'),
      to: homePath,
      icon: House,
      isActive: location.pathname === '/' || location.pathname === '/farmer' || location.pathname === '/owner',
    },
    {
      id: 'find',
      label: t('nav.find'),
      to: '/',
      icon: Search,
      onClick: handleFindMachineClick,
      isActive: (location.pathname === '/' || location.pathname === '/farmer') && !location.search.includes('section=crops'),
    },
    {
      id: 'bookings',
      label: t('nav.bookings'),
      to: bookingsPath,
      icon: CalendarDays,
      badge: pendingRequests > 0 ? pendingRequests : undefined,
      isActive: location.pathname.includes('/bookings'),
    },
    {
      id: 'crops',
      label: t('ui.myCrops'),
      to: '/?section=crops',
      icon: Sprout,
      onClick: handleMyCropsClick,
      isActive: location.search.includes('section=crops'),
    },
    {
      id: 'profile',
      label: t('nav.profile'),
      to: session ? '/settings' : '/login',
      icon: User,
      isActive: location.pathname === '/settings' || location.pathname === '/profile',
    },
    {
      id: 'notifications',
      label: t('nav.notifications'),
      to: bookingsPath,
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
      onClick: () => {
        handleNavClick()
        navigate(bookingsPath)
      },
      isActive: false,
    },
    {
      id: 'help',
      label: t('ui.helpSupport'),
      to: '#help',
      icon: HelpCircle,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault()
        handleNavClick()
        setHelpModalOpen(true)
      },
      isActive: false,
    },
    {
      id: 'settings',
      label: t('nav.settings'),
      to: session ? '/settings' : '/login',
      icon: Settings,
      isActive: location.pathname === '/settings',
    },
  ]

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
        aria-label="Application Sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#102719] border-r border-[#1e4128] text-white transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          /* Mobile Drawer */
          mobileOpen ? 'translate-x-0 w-[280px] shadow-2xl' : '-translate-x-full lg:translate-x-0'
        } ${
          /* Desktop Widths */
          collapsed ? 'lg:w-[76px]' : 'lg:w-[260px]'
        }`}
      >
        {/* A. Branding Section */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#1e4128] px-3.5">
          <Link
            to={homePath}
            onClick={() => handleNavClick()}
            className="flex items-center gap-2.5 overflow-hidden group focus-visible:outline-none"
            aria-label="Harvest Rentals Home"
          >
            <LogoMark className="size-9 shrink-0 transition-transform group-hover:scale-105" />
            <span
              className={`font-extrabold text-lg tracking-tight text-cream-50 whitespace-nowrap transition-opacity duration-200 ${
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
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="size-5" />
          </button>
        </div>

        {/* B. Main Navigation List */}
        <nav
          aria-label="Sidebar Navigation"
          className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-4 space-y-1.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon
            const isItemActive = item.isActive

            return (
              <div key={item.id} className="relative group">
                <Link
                  to={item.to}
                  onClick={item.onClick ? item.onClick : () => handleNavClick()}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                    isItemActive
                      ? 'bg-[#1c3f25] text-white font-bold shadow-xs border-l-4 border-[#8BCB73]'
                      : 'text-[#b8cbb8] hover:bg-[#163823] hover:text-white'
                  } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
                  aria-current={isItemActive ? 'page' : undefined}
                >
                  <Icon
                    className={`size-5 shrink-0 transition-colors ${
                      isItemActive ? 'text-[#8BCB73]' : 'text-[#8BCB73]/75 group-hover:text-[#8BCB73]'
                    }`}
                    aria-hidden="true"
                  />

                  {/* Label (hidden when collapsed on desktop) */}
                  <span
                    className={`truncate transition-opacity duration-200 ${
                      collapsed ? 'lg:hidden' : 'block'
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Badge */}
                  {item.badge ? (
                    <span
                      className={`ml-auto flex size-5 items-center justify-center rounded-full bg-harvest-500 text-[11px] font-black text-ink ${
                        collapsed ? 'lg:absolute lg:top-1 lg:right-2' : ''
                      }`}
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

        {/* C & D. User Profile & Bottom Actions Section */}
        <div className="shrink-0 border-t border-[#1e4128] p-3 space-y-2">
          {session && profile ? (
            <div ref={profileMenuRef} className="relative">
              {/* Profile Card Button */}
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className={`flex w-full items-center gap-2.5 rounded-xl bg-[#0c1f14] border border-[#1e4128] p-2 text-left transition-colors hover:bg-[#163823] hover:border-[#2a5c38] ${
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
                    className="ring-1 ring-[#8BCB73]/50"
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[#8BCB73] ring-1 ring-[#0c1f14]"
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
                    {profile.role ? t(`role.${profile.role}` as TranslationKey) : 'User'}
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
                <div className="absolute bottom-full left-0 mb-2 w-full min-w-[200px] rounded-xl border border-[#234D2C] bg-[#0c1f14] p-1.5 shadow-2xl z-50">
                  <Link
                    to="/settings"
                    onClick={() => handleNavClick()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#c5d5c5] hover:bg-[#1c3f25] hover:text-white"
                  >
                    <User className="size-3.5 text-[#8BCB73]" />
                    <span>{t('ui.viewProfile')}</span>
                  </Link>

                  <Link
                    to="/settings"
                    onClick={() => handleNavClick()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#c5d5c5] hover:bg-[#1c3f25] hover:text-white"
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
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300"
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
              className={`flex w-full items-center gap-2 rounded-xl border border-[#1e4128] bg-[#163823] p-2.5 text-xs font-bold text-white transition-colors hover:bg-[#1c3f25] hover:border-[#8BCB73] ${
                collapsed ? 'lg:justify-center' : ''
              }`}
            >
              <LogIn className="size-4 text-[#8BCB73] shrink-0" />
              <span className={collapsed ? 'lg:hidden' : 'block'}>{t('ui.login')}</span>
            </Link>
          )}

          {/* Quick Logout Button (anchored at bottom when expanded) */}
          {session ? (
            <button
              type="button"
              onClick={() => {
                handleNavClick()
                void signOut()
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#8ca38c] hover:bg-red-950/30 hover:text-red-300 transition-colors ${
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
