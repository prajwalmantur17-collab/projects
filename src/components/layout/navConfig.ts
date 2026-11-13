import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  HelpCircle,
  History,
  House,
  Inbox,
  PlusCircle,
  Search,
  Settings,
  Sprout,
  Tractor,
  User,
} from 'lucide-react'
import type { TranslationKey } from '../../i18n'

export interface NavItemDef {
  id: string
  to: string
  labelKey: TranslationKey
  icon: LucideIcon
  end?: boolean
  badgeType?: 'pending_requests' | 'notifications'
  isHelpAction?: boolean
  isCropAction?: boolean
  isSearchAction?: boolean
}

export interface NavSectionDef {
  id: string
  titleKey: TranslationKey
  items: NavItemDef[]
}

// -----------------------------------------------------------------------------
// Farmer Sidebar Sections
// -----------------------------------------------------------------------------

export const FARMER_SIDEBAR_SECTIONS: NavSectionDef[] = [
  {
    id: 'main',
    titleKey: 'nav.section.main',
    items: [
      { id: 'farmer-find', to: '/', labelKey: 'nav.findMachines', icon: Search, isSearchAction: true },
      { id: 'farmer-bookings', to: '/farmer/bookings', labelKey: 'nav.bookings', icon: CalendarDays },
      { id: 'farmer-records', to: '/record', labelKey: 'ui.myRecords', icon: History },
      { id: 'farmer-crops', to: '/farmer?section=crops', labelKey: 'ui.myCrops', icon: Sprout, isCropAction: true },
    ],
  },
  {
    id: 'account',
    titleKey: 'nav.section.account',
    items: [
      { id: 'farmer-profile', to: '/settings', labelKey: 'nav.profile', icon: User },
      { id: 'farmer-notifications', to: '/notifications', labelKey: 'nav.notifications', icon: Bell, badgeType: 'notifications' },
      { id: 'farmer-settings', to: '/settings', labelKey: 'common.settings', icon: Settings },
    ],
  },
  {
    id: 'support',
    titleKey: 'nav.section.support',
    items: [
      { id: 'farmer-help', to: '#help', labelKey: 'ui.helpSupport', icon: HelpCircle, isHelpAction: true },
    ],
  },
]

// -----------------------------------------------------------------------------
// Machine Owner Sidebar Sections
// -----------------------------------------------------------------------------

export const OWNER_SIDEBAR_SECTIONS: NavSectionDef[] = [
  {
    id: 'main',
    titleKey: 'nav.section.main',
    items: [
      { id: 'owner-home', to: '/owner', labelKey: 'nav.ownerDashboard', icon: House, end: true },
      { id: 'owner-machines', to: '/owner/machines', labelKey: 'nav.machines', icon: Tractor },
      { id: 'owner-requests', to: '/owner/bookings', labelKey: 'nav.requests', icon: Inbox, badgeType: 'pending_requests' },
      { id: 'owner-rentals', to: '/owner/bookings?tab=confirmed', labelKey: 'nav.myRentals', icon: CalendarCheck },
      { id: 'owner-history', to: '/record', labelKey: 'nav.rentalHistory', icon: History },
    ],
  },
  {
    id: 'account',
    titleKey: 'nav.section.account',
    items: [
      { id: 'owner-profile', to: '/settings', labelKey: 'nav.profile', icon: User },
      { id: 'owner-notifications', to: '/notifications', labelKey: 'nav.notifications', icon: Bell, badgeType: 'notifications' },
      { id: 'owner-settings', to: '/settings', labelKey: 'common.settings', icon: Settings },
    ],
  },
  {
    id: 'support',
    titleKey: 'nav.section.support',
    items: [
      { id: 'owner-help', to: '#help', labelKey: 'ui.helpSupport', icon: HelpCircle, isHelpAction: true },
    ],
  },
]

// Flattened for backward compatibility
export const FARMER_SIDEBAR_NAV: NavItemDef[] = FARMER_SIDEBAR_SECTIONS.flatMap((s) => s.items)
export const OWNER_SIDEBAR_NAV: NavItemDef[] = OWNER_SIDEBAR_SECTIONS.flatMap((s) => s.items)

// -----------------------------------------------------------------------------
// Bottom Navigation (Mobile Bar)
// -----------------------------------------------------------------------------

export const OWNER_BOTTOM_NAV: NavItemDef[] = [
  { id: 'b-owner-home', to: '/owner', labelKey: 'nav.home', icon: House, end: true },
  { id: 'b-owner-requests', to: '/owner/bookings', labelKey: 'nav.requestsShort', icon: Inbox, end: false, badgeType: 'pending_requests' },
  { id: 'b-owner-machines', to: '/owner/machines', labelKey: 'nav.machinesShort', icon: Tractor, end: false },
  { id: 'b-owner-profile', to: '/settings', labelKey: 'nav.profile', icon: User, end: false },
]

export const FARMER_BOTTOM_NAV: NavItemDef[] = [
  { id: 'b-farmer-home', to: '/', labelKey: 'nav.find', icon: Search, end: true },
  { id: 'b-farmer-bookings', to: '/farmer/bookings', labelKey: 'nav.bookingsShort', icon: CalendarDays, end: false },
  { id: 'b-farmer-profile', to: '/settings', labelKey: 'nav.profile', icon: User, end: false },
]

export const GUEST_BOTTOM_NAV: NavItemDef[] = [
  { id: 'b-guest-home', to: '/', labelKey: 'nav.find', icon: Search, end: true },
  { id: 'b-guest-list', to: '/owner/machines/new', labelKey: 'ui.listMachineShort', icon: PlusCircle, end: false },
  { id: 'b-guest-login', to: '/login', labelKey: 'ui.login', icon: User, end: false },
]
