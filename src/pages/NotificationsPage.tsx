import { BellOff, CheckCheck, ChevronRight, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useNotifications } from '../hooks/useNotifications'
import { useI18n } from '../i18n'
import { formatDateTime } from '../lib/format'
import { notificationTarget, notificationText } from '../lib/notificationText'
import type { AppNotification } from '../types'
import { Spinner } from '../components/ui/Feedback'

export function NotificationsPage() {
  const { profile } = useAuth()
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const {
    items,
    loading,
    error,
    unreadCount,
    markRead,
    markAllRead,
    removeNotification,
    removeAllNotifications,
  } = useNotifications(profile?.id, 'page')

  const open = (notification: AppNotification) => {
    if (!notification.is_read) void markRead(notification.id)
    navigate(notificationTarget(notification, profile?.role))
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-lg backdrop-blur-md sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">{t('notif.title')}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t('notif.pageSubtitle')}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-leaf-700 transition-colors hover:bg-leaf-50"
              >
                <CheckCheck className="size-4" aria-hidden="true" />
                {t('notif.markAllRead')}
              </button>
            ) : null}
            {items.length > 0 ? (
              <button
                type="button"
                onClick={() => void removeAllNotifications()}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-clay-700 transition-colors hover:bg-clay-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t('notif.clearAll')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-lg backdrop-blur-md">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-ink-muted">
            <Spinner className="size-5" />
            {t('common.loading')}
          </div>
        ) : error ? (
          <p className="px-4 py-12 text-center text-sm text-clay-700">{t(error)}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <BellOff className="size-8 text-ink-muted" aria-hidden="true" />
            <p className="text-sm text-ink-muted">{t('notif.empty')}</p>
          </div>
        ) : (
          <ul>
            {items.map((notification, index) => (
              <li
                key={notification.id}
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                className="hr-card-in flex items-stretch border-b border-cream-100 last:border-b-0 hover:bg-cream-50"
              >
                <button
                  type="button"
                  onClick={() => open(notification)}
                  className={`flex min-w-0 flex-1 items-start gap-3 px-4 py-4 text-left transition-colors ${
                    notification.is_read ? '' : 'bg-leaf-50/70'
                  }`}
                >
                  <span
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full transition-colors ${
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
                  onClick={() => void removeNotification(notification.id)}
                  className="flex w-11 shrink-0 items-center justify-center text-ink-muted transition-colors hover:bg-cream-200/60 hover:text-clay-700"
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
  )
}
