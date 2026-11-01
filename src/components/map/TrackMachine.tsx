import { useEffect, useMemo, useState } from 'react'
import { Navigation } from 'lucide-react'
import { distanceKm, formatDistance } from '../../lib/geo'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useAvatarUrls } from '../../hooks/useAvatarUrls'
import { useAuth } from '../../auth/AuthProvider'
import { avatarUrl } from '../../services/avatars'
import { getLiveLocations, subscribeToLiveLocations } from '../../services/liveLocation'
import type { LiveLocation } from '../../types'
import { Alert } from '../ui/Alert'
import { Spinner } from '../ui/Feedback'
import { LiveMap } from './LiveMap'

const STALE_AFTER_SECONDS = 60
const AVERAGE_SPEED_KMH = 20

type Role = LiveLocation['role']
type Rows = Partial<Record<Role, LiveLocation>>

function ago(seconds: number): string {
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.round(seconds / 60)} min ago`
}

/**
 * Two-way live map for a confirmed booking. Shows the viewer (blue dot) and the
 * other person: the machine for a farmer, the farmer for the owner.
 */
export function TrackMachine({
  bookingId,
  viewerRole,
  otherLabel,
}: {
  bookingId: string
  viewerRole: Role
  /** Name shown for the other person, e.g. the machine type or the farmer's name. */
  otherLabel: string
}) {
  const otherRole: Role = viewerRole === 'farmer' ? 'owner' : 'farmer'
  const { profile } = useAuth()
  const mePhotoUrl = avatarUrl(profile?.avatar_path)
  const { coordinates: browserPosition, request: requestMyLocation } = useGeolocation()
  const [rows, setRows] = useState<Rows>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    void requestMyLocation()
  }, [requestMyLocation])

  useEffect(() => {
    let cancelled = false

    getLiveLocations(bookingId)
      .then((list) => {
        if (cancelled) return
        const next: Rows = {}
        for (const row of list) next[row.role] = row
        setRows(next)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        setLoading(false)
      })

    const unsubscribe = subscribeToLiveLocations(bookingId, (change) => {
      if (cancelled) return
      setRows((previous) => {
        const next = { ...previous }
        if (change.type === 'delete') {
          delete next[change.role]
        } else {
          next[change.location.role] = change.location
        }
        return next
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [bookingId])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(id)
  }, [])

  const mine = rows[viewerRole]
  const other = rows[otherRole]
  const otherUserId = other ? (otherRole === 'owner' ? other.owner_id : other.farmer_id) : null
  const photos = useAvatarUrls([otherUserId])
  const trackedPhotoUrl = otherUserId ? (photos[otherUserId] ?? null) : null

  const me = useMemo(
    () =>
      mine ? { latitude: mine.latitude, longitude: mine.longitude } : browserPosition,
    [mine, browserPosition],
  )
  const tracked = useMemo(
    () => (other ? { latitude: other.latitude, longitude: other.longitude } : null),
    [other],
  )

  const ageSeconds = other
    ? Math.max(0, Math.round((now - new Date(other.updated_at).getTime()) / 1000))
    : null
  const stale = ageSeconds !== null && ageSeconds > STALE_AFTER_SECONDS

  const km = tracked && me ? distanceKm(tracked, me) : null
  const etaMinutes = km !== null ? Math.max(1, Math.round((km / AVERAGE_SPEED_KMH) * 60)) : null

  const otherWho = viewerRole === 'farmer' ? 'the machine owner' : 'the farmer'

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-leaf-100 bg-white">
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-harvest-100 text-harvest-700">
          <Navigation className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {loading ? (
            <p className="flex items-center gap-2 font-medium text-ink-muted">
              <Spinner className="size-4" /> Checking for live location…
            </p>
          ) : failed ? (
            <p className="font-medium text-ink-muted">
              Could not load the live location. Try again later.
            </p>
          ) : other && ageSeconds !== null ? (
            <>
              <p className="font-bold text-ink">
                {stale
                  ? `${otherLabel}: signal lost`
                  : viewerRole === 'farmer'
                    ? `${otherLabel} is on the way`
                    : `${otherLabel} · live location`}
              </p>
              <p className={stale ? 'text-clay-700' : 'text-ink-muted'}>
                {km !== null && etaMinutes !== null
                  ? `${formatDistance(km)} km apart · about ${etaMinutes} min (straight-line estimate) · `
                  : ''}
                updated {ago(ageSeconds)}
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-ink">Waiting for {otherWho}</p>
              <p className="text-ink-muted">
                Tracking starts automatically as soon as {otherWho} opens the app and allows
                location access.
              </p>
            </>
          )}
        </div>
      </div>

      {tracked || me ? (
        <LiveMap
          me={me}
          tracked={tracked}
          trackedKind={viewerRole === 'farmer' ? 'machine' : 'farmer'}
          trackedPhotoUrl={trackedPhotoUrl}
          mePhotoUrl={mePhotoUrl}
          className="h-64 sm:h-80"
        />
      ) : null}

      {!me ? (
        <Alert variant="info" className="m-3">
          Allow location access to see where you are on the map.
        </Alert>
      ) : null}
    </div>
  )
}
