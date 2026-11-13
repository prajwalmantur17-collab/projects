import type { TranslationKey } from '../i18n'
import type { AppNotification, Language } from '../types'
import { formatDate } from './format'
import { machineTypeLabelKey } from './labels'

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

/** One place that turns a notification row into the sentence shown to the user. */
export function notificationText(
  notification: AppNotification,
  language: Language,
  t: Translate,
): string {
  const date = notification.payload.service_date
    ? formatDate(notification.payload.service_date, language)
    : ''
  switch (notification.kind) {
    case 'booking_created':
      return t('notif.newBooking', {
        name: notification.payload.farmer_name ?? t('owner.farmer'),
        date,
      })
    case 'booking_confirmed':
      return t('notif.confirmed', { date })
    case 'booking_rejected':
      return t('notif.rejected', { date })
    case 'booking_cancelled':
      return t('notif.cancelled', { date })
    case 'work_started':
      return t('notif.workStarted', { date })
    case 'work_completed':
      return t('notif.workCompleted', { date })
    case 'machine_free':
      return t('notif.machineFree', {
        machine: notification.payload.machine_type
          ? t(machineTypeLabelKey(notification.payload.machine_type))
          : t('common.unknown'),
      })
    case 'driver_request_created':
      return t('notif.driverRequested', {
        name: notification.payload.requester_name ?? t('common.unknown'),
        date,
      })
    case 'driver_request_accepted':
      return t('notif.driverAccepted', {
        name: notification.payload.driver_name ?? t('common.unknown'),
        date,
      })
    case 'driver_request_declined':
      return t('notif.driverDeclined', {
        name: notification.payload.driver_name ?? t('common.unknown'),
        date,
      })
    case 'driver_request_cancelled':
      return t('notif.driverCancelled', {
        name:
          (notification.payload.audience === 'driver'
            ? notification.payload.requester_name
            : notification.payload.driver_name) ?? t('common.unknown'),
        date,
      })
    default:
      return t('notif.title')
  }
}

/** Where tapping a notification should go. */
export function notificationTarget(
  notification: AppNotification,
  role: 'farmer' | 'owner' | null | undefined,
): string {
  if (notification.kind.startsWith('driver_request_')) {
    return notification.payload.audience === 'driver' ? '/driver' : '/drivers/requests'
  }
  if (notification.kind === 'machine_free' && notification.payload.machine_id) {
    return `/farmer/machines/${notification.payload.machine_id}`
  }
  return role === 'owner' ? '/owner/bookings' : '/farmer/bookings'
}
