import { useSyncExternalStore } from 'react'
import { Navigation, Radio } from 'lucide-react'
import {
  getShareState,
  isInShareWindow,
  isPaused,
  startSharing,
  stopSharing,
  subscribeShare,
} from '../../services/liveShare'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { TrackMachine } from './TrackMachine'

/**
 * Owner-side live tracking for a confirmed booking. Sharing starts on its own
 * when the request is accepted (and whenever the app is opened around the
 * service date); this panel shows the map and lets the owner stop or resume.
 */
export function ShareLocationPanel({
  bookingId,
  serviceDate,
  farmerName,
}: {
  bookingId: string
  /** Booking service date as YYYY-MM-DD. */
  serviceDate: string
  farmerName: string
}) {
  const share = useSyncExternalStore(subscribeShare, getShareState, getShareState)
  const sharing = share.activeBookingIds.includes(bookingId)
  const inWindow = isInShareWindow(serviceDate)
  const paused = !sharing && isPaused(bookingId)

  return (
    <div className="mt-4 space-y-3 rounded-xl border-2 border-leaf-100 bg-leaf-50/60 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-leaf-100 text-leaf-800">
          {sharing ? (
            <Radio className="size-5" aria-hidden="true" />
          ) : (
            <Navigation className="size-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Live tracking</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {!inWindow
              ? 'Live tracking turns on automatically around the service date, while the app is open.'
              : sharing
                ? `Sharing your location with the farmer${
                    share.lastSentAt
                      ? ` · last update ${new Date(share.lastSentAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}`
                      : ' · getting your position…'
                  }`
                : paused
                  ? 'Sharing is paused. The farmer cannot see you.'
                  : 'Not sharing yet. Allow location access in your browser, then press Start.'}
          </p>
        </div>
      </div>

      {share.error ? <Alert variant="warning">{share.error}</Alert> : null}

      {inWindow ? (
        <div>
          {sharing ? (
            <Button
              size="sm"
              variant="outline"
              className="border-clay-300 text-clay-800 hover:bg-clay-50"
              onClick={() => stopSharing(bookingId)}
            >
              Stop sharing
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => startSharing(bookingId)}
              icon={<Navigation className="size-4" aria-hidden="true" />}
            >
              {paused ? 'Resume sharing' : 'Start sharing'}
            </Button>
          )}
        </div>
      ) : null}

      {inWindow ? (
        <TrackMachine bookingId={bookingId} viewerRole="owner" otherLabel={farmerName} />
      ) : null}
    </div>
  )
}
