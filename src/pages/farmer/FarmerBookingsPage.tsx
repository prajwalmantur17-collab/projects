import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Navigation, Phone, Play, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { machineTypeLabelKey } from '../../lib/labels'
import { useAsync } from '../../hooks/useAsync'
import {
  cancelBooking,
  clearClosedBookingsFromHistory,
  getFarmerBookings,
  removeBookingFromHistory,
  subscribeToBookings,
} from '../../services/bookings'
import type { BookingWithRelations } from '../../types'
import { BookingDetails } from '../../components/booking/BookingDetails'
import { BookingMachineThumb } from '../../components/booking/BookingMachineThumb'
import { StatusBadge } from '../../components/booking/StatusBadge'
import { workPhase } from '../../services/workStatus'
import { ContactButtons } from '../../components/contact/ContactButtons'
import { TrackMachine } from '../../components/map/TrackMachine'
import { isInShareWindow } from '../../services/liveShare'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'

type Filter = 'all' | 'active' | 'closed'

const ACTIVE_STATUSES = new Set(['pending', 'confirmed'])

export function FarmerBookingsPage() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const userId = profile?.id

  const [filter, setFilter] = useState<Filter>('all')
  const [cancelTarget, setCancelTarget] = useState<BookingWithRelations | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BookingWithRelations | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [clearClosedConfirmOpen, setClearClosedConfirmOpen] = useState(false)
  const [actionError, setActionError] = useState<TranslationKey | null>(null)
  const [success, setSuccess] = useState<TranslationKey | null>(null)
  const [hiddenMaps, setHiddenMaps] = useState<string[]>([])

  const loader = useCallback(async () => {
    if (!userId) return [] as BookingWithRelations[]
    return getFarmerBookings(userId)
  }, [userId])

  const { data, loading, error, reload } = useAsync(loader, {
    enabled: Boolean(userId),
    fallback: 'farmer.bookingsError',
  })

  useEffect(() => {
    if (!userId) return
    return subscribeToBookings(userId, 'farmer', () => reload())
  }, [userId, reload])

  const bookings = data ?? []
  const filtered = bookings.filter((booking) => {
    if (filter === 'all') return true
    const isActive = ACTIVE_STATUSES.has(booking.status)
    return filter === 'active' ? isActive : !isActive
  })

  const confirmCancel = async () => {
    if (!cancelTarget || cancelling) return
    setCancelling(true)
    setActionError(null)
    try {
      await cancelBooking(cancelTarget.id)
      setCancelTarget(null)
      setSuccess('farmer.cancelled')
      reload()
    } catch (caught) {
      logError('farmer.cancelBooking', caught)
      setActionError(mapErrorToKey(caught, 'farmer.cancelError'))
    } finally {
      setCancelling(false)
    }
  }

  const confirmDeleteFromHistory = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setActionError(null)
    try {
      await removeBookingFromHistory(deleteTarget.id)
      setDeleteTarget(null)
      setSuccess('farmer.bookingRemoved')
      reload()
    } catch (caught) {
      logError('farmer.removeBooking', caught)
      setActionError(mapErrorToKey(caught, 'error.generic'))
    } finally {
      setDeleting(false)
    }
  }

  const confirmClearClosed = async () => {
    if (deleting) return
    setDeleting(true)
    setActionError(null)
    try {
      const closedIds = bookings
        .filter((b) => !ACTIVE_STATUSES.has(b.status))
        .map((b) => b.id)
      await clearClosedBookingsFromHistory(closedIds)
      setClearClosedConfirmOpen(false)
      setSuccess('farmer.historyCleared')
      reload()
    } catch (caught) {
      logError('farmer.clearClosedBookings', caught)
      setActionError(mapErrorToKey(caught, 'error.generic'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('farmer.myBookingsTitle')}
        description={t('farmer.myBookingsSubtitle')}
        action={
          <LinkButton to="/farmer" variant="outline" icon={<CalendarDays className="size-4" aria-hidden="true" />}>
            {t('farmer.findMachine')}
          </LinkButton>
        }
      />

      {success ? (
        <Alert variant="success" className="mb-4">
          {t(success)}
        </Alert>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('farmer.myBookingsTitle')}>
          {(
            [
              ['all', t('farmer.filterAll')],
              ['active', t('farmer.filterActive')],
              ['closed', t('farmer.filterClosed')],
            ] as Array<[Filter, string]>
          ).map(([value, label]) => {
            const active = filter === value
            const count =
              value === 'all'
                ? bookings.length
                : bookings.filter((booking) =>
                    value === 'active'
                      ? ACTIVE_STATUSES.has(booking.status)
                      : !ACTIVE_STATUSES.has(booking.status),
                  ).length
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value)
                  setSuccess(null)
                }}
                aria-pressed={active}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-4 text-sm font-bold transition-colors ${
                  active
                    ? 'border-leaf-700 bg-leaf-700 text-cream-50'
                    : 'border-cream-300 bg-white text-ink-soft hover:border-leaf-300'
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    active ? 'bg-white/20' : 'bg-cream-100 text-ink-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {bookings.some((b) => !ACTIVE_STATUSES.has(b.status)) ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="size-4 text-clay-600" aria-hidden="true" />}
            onClick={() => {
              setActionError(null)
              setClearClosedConfirmOpen(true)
            }}
            className="text-xs font-semibold text-clay-700 hover:bg-clay-50"
          >
            {t('farmer.clearClosedHistory')}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-card border border-cream-200 bg-white py-16">
          <Spinner className="size-5" />
          <span className="text-sm font-medium text-ink-muted">{t('common.loading')}</span>
        </div>
      ) : error ? (
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(error)}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t('farmer.noBookingsTitle')}
          description={t('farmer.noBookingsBody')}
          action={
            <LinkButton to="/farmer" variant="primary">
              {t('farmer.findMachine')}
            </LinkButton>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((booking) => {
            const machine = booking.machine
            const typeLabel = machine
              ? t(machineTypeLabelKey(machine.machine_type))
              : t('common.unknown')
            const canCancel = booking.status === 'pending' || booking.status === 'confirmed'
            return (
              <Card key={booking.id} as="article" className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    {machine ? (
                      <BookingMachineThumb
                        imagePath={machine.image_path}
                        typeLabel={typeLabel}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">{typeLabel}</h2>
                      <p className="truncate text-sm text-ink-muted">
                        {machine?.model ?? t('farmer.noModel')}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {t('farmer.requestedOn', {
                          date: new Date(booking.created_at).toLocaleDateString('en-IN'),
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={booking.status} />
                    {booking.status === 'confirmed' ? (
                      (() => {
                        const phase = workPhase(booking)
                        if (phase === 'working') {
                          return (
                            <span className="inline-flex items-center gap-1 rounded-full border border-harvest-200 bg-harvest-50 px-2.5 py-0.5 text-xs font-bold text-harvest-800">
                              <Play className="size-3" aria-hidden="true" />
                              {t('work.working')}
                            </span>
                          )
                        }
                        if (phase === 'completed') {
                          return (
                            <span className="inline-flex items-center gap-1 rounded-full border border-leaf-200 bg-leaf-50 px-2.5 py-0.5 text-xs font-bold text-leaf-800">
                              <CheckCircle2 className="size-3" aria-hidden="true" />
                              {t('work.doneBadge')}
                            </span>
                          )
                        }
                        return null
                      })()
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-snug text-ink-muted">
                  {t(`booking.statusHelp.${booking.status}`)}
                </p>

                <div className="mt-3">
                  <BookingDetails booking={booking} />
                </div>

                {booking.owner_note ? (
                  <Alert variant="info" className="mt-3">
                    <span className="font-semibold">{t('booking.ownerNote')}: </span>
                    {booking.owner_note}
                  </Alert>
                ) : null}

                {machine?.phone ? (
                  <div className="mt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-soft">
                      <Phone className="size-4 text-leaf-600" aria-hidden="true" />
                      {t('farmer.contactOwnerTitle')}
                    </p>
                    <ContactButtons
                      phone={machine.phone}
                      audience="owner"
                      message={`${t('app.name')}: ${t('farmer.bookingForMachine', { machine: typeLabel })}`}
                    />
                  </div>
                ) : null}

                {booking.status === 'confirmed' &&
                isInShareWindow(booking.service_date) &&
                !hiddenMaps.includes(booking.id) ? (
                  <div className="mt-4">
                    <TrackMachine
                      bookingId={booking.id}
                      viewerRole="farmer"
                      otherLabel={typeLabel}
                    />
                  </div>
                ) : null}

                {booking.status === 'confirmed' && !isInShareWindow(booking.service_date) ? (
                  <p className="mt-3 text-sm text-ink-muted">
                    Live tracking starts automatically around the service date.
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {booking.status === 'confirmed' && isInShareWindow(booking.service_date) ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Navigation className="size-4" aria-hidden="true" />}
                      onClick={() =>
                        setHiddenMaps((current) =>
                          current.includes(booking.id)
                            ? current.filter((id) => id !== booking.id)
                            : [...current, booking.id],
                        )
                      }
                    >
                      {hiddenMaps.includes(booking.id) ? 'Show live map' : 'Hide live map'}
                    </Button>
                  ) : null}
                  {machine ? (
                    <LinkButton
                      to={`/farmer/machines/${machine.id}`}
                      variant="outline"
                      size="sm"
                    >
                      {t('booking.viewMachine')}
                    </LinkButton>
                  ) : null}
                  {canCancel ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-clay-300 text-clay-800 hover:bg-clay-50"
                      onClick={() => {
                        setActionError(null)
                        setCancelTarget(booking)
                      }}
                    >
                      {t('farmer.cancelBooking')}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-cream-300 text-clay-700 hover:border-clay-400 hover:bg-clay-50"
                      icon={<Trash2 className="size-4 text-clay-600" aria-hidden="true" />}
                      onClick={() => {
                        setActionError(null)
                        setDeleteTarget(booking)
                      }}
                    >
                      {t('farmer.removeFromHistory')}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Cancel Active Booking Dialog */}
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => {
          if (cancelling) return
          setCancelTarget(null)
          setActionError(null)
        }}
        onConfirm={() => void confirmCancel()}
        title={t('farmer.cancelConfirmTitle')}
        description={t('farmer.cancelConfirmBody')}
        confirmLabel={t('farmer.cancelYes')}
        cancelLabel={t('farmer.cancelKeep')}
        danger
        loading={cancelling}
      >
        {actionError ? <Alert variant="error">{t(actionError)}</Alert> : null}
      </ConfirmDialog>

      {/* Remove Single Booking from History Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (deleting) return
          setDeleteTarget(null)
          setActionError(null)
        }}
        onConfirm={() => void confirmDeleteFromHistory()}
        title={t('farmer.deleteBookingTitle')}
        description={t('farmer.deleteBookingBody')}
        confirmLabel={t('farmer.deleteBookingYes')}
        cancelLabel={t('farmer.deleteBookingCancel')}
        danger
        loading={deleting}
      >
        {actionError ? <Alert variant="error">{t(actionError)}</Alert> : null}
      </ConfirmDialog>

      {/* Clear All Closed Bookings Dialog */}
      <ConfirmDialog
        open={clearClosedConfirmOpen}
        onClose={() => {
          if (deleting) return
          setClearClosedConfirmOpen(false)
          setActionError(null)
        }}
        onConfirm={() => void confirmClearClosed()}
        title={t('farmer.clearClosedTitle')}
        description={t('farmer.clearClosedBody')}
        confirmLabel={t('farmer.deleteBookingYes')}
        cancelLabel={t('farmer.deleteBookingCancel')}
        danger
        loading={deleting}
      >
        {actionError ? <Alert variant="error">{t(actionError)}</Alert> : null}
      </ConfirmDialog>
    </div>
  )
}
