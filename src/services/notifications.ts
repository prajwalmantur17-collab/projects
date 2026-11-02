import { requireSupabase } from '../lib/supabase'
import type { AppNotification } from '../types'

const LOCAL_STORAGE_KEY = 'harvest_hidden_notifications'

function getHiddenIds(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function hideNotificationLocally(id: string) {
  try {
    const hidden = getHiddenIds()
    if (!hidden.includes(id)) {
      hidden.push(id)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(hidden))
    }
  } catch {
    // Ignore storage issues
  }
}

function hideAllNotificationsLocally(ids: string[]) {
  try {
    const hidden = getHiddenIds()
    const merged = Array.from(new Set([...hidden, ...ids]))
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Ignore storage issues
  }
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const hiddenIds = getHiddenIds()
  const { data, error } = await requireSupabase()
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  // Filter out any locally soft-deleted notifications
  return ((data as AppNotification[]) || []).filter((item) => !hiddenIds.includes(item.id))
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) throw error
}

export async function deleteNotification(id: string): Promise<void> {
  hideNotificationLocally(id)
  try {
    await requireSupabase().from('notifications').delete().eq('id', id)
  } catch {
    // Fallback if RLS restricts table delete
  }
}

export async function deleteAllNotifications(userId: string, currentIds: string[] = []): Promise<void> {
  hideAllNotificationsLocally(currentIds)
  try {
    await markAllNotificationsRead(userId)
    await requireSupabase().from('notifications').delete().eq('user_id', userId)
  } catch {
    // Fallback if RLS restricts table delete
  }
}

export function subscribeToNotifications(
  userId: string,
  onChange: () => void,
  scope = 'default',
): () => void {
  try {
    const client = requireSupabase()
    const channelId = `notifications-${userId}-${scope}-${Math.random().toString(36).slice(2, 7)}`
    const channel = client
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        onChange,
      )
      .subscribe()
    return () => {
      try {
        void client.removeChannel(channel)
      } catch {
        // cleanup safety
      }
    }
  } catch (err) {
    console.warn('Realtime subscription skipped:', err)
    return () => {}
  }
}
