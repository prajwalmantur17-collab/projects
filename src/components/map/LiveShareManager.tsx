import { useEffect, useSyncExternalStore } from 'react'
import { MapPin } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import { useSidebar } from '../layout/SidebarContext'
import { getFarmerBookings, getOwnerBookings, subscribeToBookings } from '../../services/bookings'
import {
  getShareState,
  isInShareWindow,
  releaseAll,
  releaseSharing,
  startSharing,
  stopAllSharing,
  subscribeShare,
} from '../../services/liveShare'

const RESYNC_MS = 10 * 60 * 1000

/**
 * Starts live location sharing on its own, for owners and farmers alike, for
 * every confirmed booking around its service date. It runs on every page, so
 * tracking begins as soon as a request is accepted (or the app is opened on
 * the day) without anyone pressing a button. It also shows a small banner so
 * people always know their location is being shared, and can stop it.
 */
export function LiveShareManager() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const { collapsed } = useSidebar()
  const userId = profile?.id
  const role = profile?.role
  const share = useSyncExternalStore(subscribeShare, getShareState, getShareState)

  useEffect(() => {
    if (!userId || !role) return
    let cancelled = false

    const sync = async () => {
      try {
        const bookings =
          role === 'owner' ? await getOwnerBookings(userId) : await getFarmerBookings(userId)
        if (cancelled) return
        const wanted = new Set(
          bookings
            // A finished job keeps status 'confirmed', so completion must be checked too.
            .filter(
              (b) =>
                b.status === 'confirmed' &&
                !b.completed_at &&
                !b.cancelled_at &&
                isInShareWindow(b.service_date),
            )
            .map((b) => b.id),
        )
        wanted.forEach((id) => startSharing(id, true))
        getShareState()
          .activeBookingIds.filter((id) => !wanted.has(id))
          .forEach((id) => releaseSharing(id))
      } catch {
        // Offline or not signed in: try again on the next booking change or timer tick.
      }
    }

    void sync()
    const unsubscribe = subscribeToBookings(userId, role, () => void sync(), 'live-share')
    const interval = window.setInterval(() => void sync(), RESYNC_MS)

    return () => {
      cancelled = true
      unsubscribe()
      window.clearInterval(interval)
      releaseAll()
    }
  }, [userId, role])

  const sharing = share.activeBookingIds.length > 0
  if (!sharing && !share.error) return null

  return (
    <div
      role="status"
      className={`hr-tab-content border-b border-leaf-200 bg-leaf-50 px-4 py-2 text-sm text-leaf-900 transition-[padding] duration-300 ${
        collapsed ? 'lg:pl-[92px]' : 'lg:pl-[276px]'
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          {sharing
            ? t('live.sharing')
            : share.error}
        </p>
        {sharing ? (
          <button
            type="button"
            onClick={stopAllSharing}
            className="rounded-lg px-2 py-1 text-sm font-bold text-clay-800 underline hover:bg-clay-50"
          >
            {t('live.stop')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
