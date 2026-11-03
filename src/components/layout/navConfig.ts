import type { LucideIcon } from 'lucide-react'
import {
  Bell,
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
}

export const OWNER_SIDEBAR_NAV: NavItemDef[] = [
  { id: 'owner-home', to: '/owner', labelKey: 'nav.home', icon: House, end: true },
  { id: 'owner-requests', to: '/owner/bookings', labelKey: 'nav.requests', icon: Inbox, badgeType: 'pending_requests' },
  { id: 'owner-machines', to: '/owner/machines', labelKey: 'nav.machines', icon: Tractor },
  { id: 'owner-add', to: '/owner/machines/new', labelKey: 'owner.addMachine', icon: PlusCircle },
  { id: 'owner-records', to: '/record', labelKey: 'ui.myRecords', icon: History },
  { id: 'owner-profile', to: '/settings', labelKey: 'nav.profile', icon: User },
  { id: 'owner-notifications', to: '/notifications', labelKey: 'a11y.notifications', icon: Bell, badgeType: 'notifications' },
  { id: 'owner-help', to: '#help', labelKey: 'ui.helpSupport', icon: HelpCircle, isHelpAction: true },
  { id: 'owner-settings', to: '/settings', labelKey: 'settings.title', icon: Settings },
]

export const FARMER_SIDEBAR_NAV: NavItemDef[] = [
  { id: 'farmer-home', to: '/', labelKey: 'nav.home', icon: House, end: true },
  { id: 'farmer-bookings', to: '/farmer/bookings', labelKey: 'nav.bookings', icon: CalendarDays },
  { id: 'farmer-records', to: '/record', labelKey: 'ui.myRecords', icon: History },
  { id: 'farmer-crops', to: '/farmer?section=crops', labelKey: 'ui.myCrops', icon: Sprout, isCropAction: true },
  { id: 'farmer-profile', to: '/settings', labelKey: 'nav.profile', icon: User },
  { id: 'farmer-notifications', to: '/notifications', labelKey: 'a11y.notifications', icon: Bell, badgeType: 'notifications' },
  { id: 'farmer-help', to: '#help', labelKey: 'ui.helpSupport', icon: HelpCircle, isHelpAction: true },
  { id: 'farmer-settings', to: '/settings', labelKey: 'settings.title', icon: Settings },
]

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
