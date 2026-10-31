import { requireSupabase } from '../lib/supabase'
import type { AppNotification } from '../types'

const HIDDEN_NOTIFICATIONS_KEY = 'harvest-rentals-hidden-notifications'

export function getHiddenNotificationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(HIDDEN_NOTIFICATIONS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function hideNotificationLocally(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const hidden = getHiddenNotificationIds()
    hidden.add(id)
    window.localStorage.setItem(HIDDEN_NOTIFICATIONS_KEY, JSON.stringify(Array.from(hidden)))
  } catch {
    // Ignore quota errors
  }
}

export function hideAllNotificationsLocally(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    const hidden = getHiddenNotificationIds()
    for (const id of ids) hidden.add(id)
    window.localStorage.setItem(HIDDEN_NOTIFICATIONS_KEY, JSON.stringify(Array.from(hidden)))
  } catch {
    // Ignore quota errors
  }
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await requireSupabase()
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  const hidden = getHiddenNotificationIds()
  return ((data ?? []) as AppNotification[]).filter((item) => !hidden.has(item.id))
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('notifications')
    .update({ is_read: true })
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

export function subscribeToNotifications(userId: string, onChange: () => void): () => void {
  const client = requireSupabase()
  const channel = client
    .channel(`notifications-${userId}`)
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
    void client.removeChannel(channel)
  }
}
