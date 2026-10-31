import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, CheckCheck, ChevronRight, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { formatDate, formatDateTime } from '../../lib/format'
import { useAuth } from '../../auth/AuthProvider'
import { useNotifications } from '../../hooks/useNotifications'
import type { AppNotification } from '../../types'
import { Spinner } from '../ui/Feedback'

export function NotificationBell() {
  const { profile } = useAuth()
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const {
    items,
    loading,
    error,
    unreadCount,
    markRead,
    markAllRead,
    removeNotification,
    removeAllNotifications,
  } = useNotifications(profile?.id)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!profile) return null

  const openBooking = (notification: AppNotification) => {
    void markRead(notification.id)
    setOpen(false)
    navigate(profile.role === 'owner' ? '/owner/bookings' : '/farmer/bookings')
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex size-11 items-center justify-center rounded-xl text-ink-soft hover:bg-cream-200"
        aria-label={t('a11y.notifications')}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute right-2 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-clay-600 px-1 text-[11px] font-bold leading-4 text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t('notif.title')}
          className="absolute right-0 top-full z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-cream-200 bg-white shadow-lift"
        >
          <div className="flex items-center justify-between gap-2 border-b border-cream-200 px-4 py-3">
            <h2 className="text-base font-bold">{t('notif.title')}</h2>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-leaf-700 hover:bg-leaf-50"
                >
                  <CheckCheck className="size-4" aria-hidden="true" />
                  {t('notif.markAllRead')}
                </button>
              ) : null}
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void removeAllNotifications()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-clay-700 hover:bg-clay-50"
                  title={t('notif.clearAll')}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t('notif.clearAll')}
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-muted">
                <Spinner className="size-5" />
                {t('common.loading')}
              </div>
            ) : error ? (
              <p className="px-4 py-8 text-center text-sm text-clay-700">{t(error)}</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <BellOff className="size-7 text-ink-muted" aria-hidden="true" />
                <p className="text-sm text-ink-muted">{t('notif.empty')}</p>
              </div>
            ) : (
              <ul>
                {items.map((notification) => (
                  <li
                    key={notification.id}
                    className="group relative flex items-stretch border-b border-cream-100 hover:bg-cream-50"
                  >
                    <button
                      type="button"
                      onClick={() => openBooking(notification)}
                      className={`flex min-w-0 flex-1 items-start gap-2.5 px-4 py-3 text-left ${
                        notification.is_read ? '' : 'bg-leaf-50/70'
                      }`}
                    >
                      <span
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${
                          notification.is_read ? 'bg-transparent' : 'bg-leaf-600'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug text-ink">
                          {notificationText(notification, language, t)}
                        </span>
                        <span className="mt-1 block text-xs text-ink-muted">
                          {formatDateTime(notification.created_at, language)}
                        </span>
                      </span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void removeNotification(notification.id)
                      }}
                      className="flex w-9 shrink-0 items-center justify-center text-ink-muted transition-colors hover:bg-cream-200/60 hover:text-clay-700"
                      title={t('notif.dismiss')}
                      aria-label={t('notif.dismiss')}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function notificationText(
  notification: AppNotification,
  language: 'en' | 'kn' | 'hi',
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
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
    default:
      return t('notif.title')
  }
}
