import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationKey } from '../i18n'
import { logError, mapErrorToKey } from '../lib/errors'
import {
  deleteAllNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../services/notifications'
import type { AppNotification } from '../types'

export function useNotifications(userId: string | undefined, scope = 'default') {
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState<TranslationKey | null>(null)
  const mounted = useRef(true)

  const reload = useCallback(async () => {
    if (!userId) {
      setItems([])
      setLoading(false)
      return
    }
    try {
      const notifications = await listNotifications(userId)
      if (mounted.current) {
        setItems(notifications)
        setError(null)
      }
    } catch (caught) {
      logError('notifications.reload', caught)
      if (mounted.current) setError(mapErrorToKey(caught, 'notif.loadError'))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    mounted.current = true
    void reload()
    return () => {
      mounted.current = false
    }
  }, [reload])

  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToNotifications(userId, () => {
      void reload()
    }, scope)
    return unsubscribe
  }, [userId, reload, scope])

  const markRead = useCallback(
    async (id: string) => {
      setItems((previous) => previous.map((item) => (item.id === id ? { ...item, is_read: true } : item)))
      try {
        await markNotificationRead(id)
      } catch (caught) {
        logError('notifications.markRead', caught)
        void reload()
      }
    },
    [reload],
  )

  const markAllRead = useCallback(async () => {
    if (!userId) return
    setItems((previous) => previous.map((item) => ({ ...item, is_read: true })))
    try {
      await markAllNotificationsRead(userId)
    } catch (caught) {
      logError('notifications.markAllRead', caught)
      void reload()
    }
  }, [userId, reload])

  const removeNotification = useCallback(
    async (id: string) => {
      setItems((previous) => previous.filter((item) => item.id !== id))
      try {
        await deleteNotification(id)
      } catch (caught) {
        logError('notifications.delete', caught)
        void reload()
      }
    },
    [reload],
  )

  const removeAllNotifications = useCallback(async () => {
    if (!userId) return
    const currentIds = items.map((i) => i.id)
    setItems([])
    try {
      await deleteAllNotifications(userId, currentIds)
    } catch (caught) {
      logError('notifications.deleteAll', caught)
      void reload()
    }
  }, [userId, items, reload])

  return {
    items,
    loading,
    error,
    unreadCount: items.filter((item) => !item.is_read).length,
    markRead,
    markAllRead,
    removeNotification,
    removeAllNotifications,
    reload,
  }
}
