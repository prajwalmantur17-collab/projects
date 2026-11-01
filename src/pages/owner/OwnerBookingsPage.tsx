import { useCallback, useEffect, useState } from 'react'
import { Inbox, Mic, Phone, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { toast } from '../../lib/toast'
import { formatDate, formatDateTime } from '../../lib/format'
import { cropLabelKey, machineTypeLabelKey } from '../../lib/labels'
import { parseYesNo } from '../../lib/voiceParse'
import { useAsync } from '../../hooks/useAsync'
import { clearClosedBookingsFromHistory, getOwnerBookings, removeBookingFromHistory, respondToBooking, subscribeToBookings } from '../../services/bookings'
import { isInShareWindow, startSharing, stopSharing } from '../../services/liveShare'
import { workPhase } from '../../services/workStatus'
import type { BookingStatus, BookingWithRelations } from '../../types'
import { BookingDetails } from '../../components/booking/BookingDetails'
import { BookingMachineThumb } from '../../components/booking/BookingMachineThumb'
import { PersonChip } from '../../components/booking/PersonChip'
import { WorkControls } from '../../components/booking/WorkControls'
import { StatusBadge } from '../../components/booking/StatusBadge'
import { ContactButtons } from '../../components/contact/ContactButtons'
import { ShareLocationPanel } from '../../components/map/ShareLocationPanel'
import { VoiceFlowAssistant } from '../../components/voice/VoiceFlowAssistant'
import { askStep } from '../../components/voice/voiceSteps'
import type { VoiceStep } from '../../components/voice/voiceSteps'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'

type Filter = 'pending' | 'confirmed' | 'completed' | 'closed'
type Decision = Extract<BookingStatus, 'confirmed' | 'rejected'>

export function OwnerBookingsPage() {
  const { profile } = useAuth()
  const { t, language } = useI18n()
  const ownerId = profile?.id

  const [filter, setFilter] = useState<Filter>('pending')
  const [target, setTarget] = useState<{ booking: BookingWithRelations; decision: Decision } | null>(
    null,
  )
  const [note, setNote] = useState('')
  const [responding, setResponding] = useState(false)
  const [responseError, setResponseError] = useState<TranslationKey | null>(null)
  const [success, setSuccess] = useState<TranslationKey | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceQueue, setVoiceQueue] = useState<BookingWithRelations[]>([])
  const [deleteTarget, setDeleteTarget] = useState<BookingWithRelations | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [clearClosedConfirmOpen, setClearClosedConfirmOpen] = useState(false)
  const [clearCompletedConfirmOpen, setClearCompletedConfirmOpen] = useState(false)
  const [actionError, setActionError] = useState<TranslationKey | null>(null)

  const loader = useCallback(async () => {
    if (!ownerId) return [] as BookingWithRelations[]
    return getOwnerBookings(ownerId)
  }, [ownerId])

  const { data, loading, error, reload } = useAsync(loader, {
    enabled: Boolean(ownerId),
    fallback: 'owner.requestsError',
  })

  useEffect(() => {
    if (!ownerId) return
    return subscribeToBookings(ownerId, 'owner', () => reload())
  }, [ownerId, reload])

  const bookings = data ?? []
  const counts = {
    pending: bookings.filter((booking) => booking.status === 'pending').length,
    confirmed: bookings.filter(
      (booking) => booking.status === 'confirmed' && !booking.completed_at,
    ).length,
    completed: bookings.filter(
      (booking) => booking.status === 'confirmed' && Boolean(booking.completed_at),
    ).length,
    closed: bookings.filter(
      (booking) => booking.status === 'rejected' || booking.status === 'cancelled',
    ).length,
  }

  const filtered = bookings.filter((booking) => {
    if (filter === 'pending') return booking.status === 'pending'
    if (filter === 'confirmed') return booking.status === 'confirmed' && !booking.completed_at
    if (filter === 'completed') return booking.status === 'confirmed' && Boolean(booking.completed_at)
    return booking.status === 'rejected' || booking.status === 'cancelled'
  })

  const openDialog = (booking: BookingWithRelations, decision: Decision) => {
    setTarget({ booking, decision })
    setNote('')
    setResponseError(null)
    setSuccess(null)
  }

  const closeDialog = () => {
    if (responding) return
    setTarget(null)
    setNote('')
    setResponseError(null)
  }

  const confirmResponse = async () => {
    if (!target || responding) return
    setResponding(true)
    setResponseError(null)
    try {
      await respondToBooking(
        target.booking.id,
        target.decision,
        target.decision === 'rejected' ? note : undefined,
      )
      if (target.decision === 'confirmed' && isInShareWindow(target.booking.service_date)) {
        // Accepting is a tap, so the browser can show its location prompt right now.
        startSharing(target.booking.id, true)
      }
      setTarget(null)
      setNote('')
      const successKey = target.decision === 'confirmed' ? 'owner.acceptSuccess' : 'owner.rejectSuccess'
      setSuccess(successKey)
      toast.success(t(successKey))
      reload()
    } catch (caught) {
      logError('owner.respondToBooking', caught)
      const errKey = mapErrorToKey(caught, 'owner.respondError')
      setResponseError(errKey)
      toast.error(t(errKey))
    } finally {
      setResponding(false)
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
      logError('owner.removeBooking', caught)
      setActionError(mapErrorToKey(caught, 'error.generic'))
    } finally {
      setDeleting(false)
    }
  }

  const confirmClearCompleted = async () => {
    if (deleting) return
    setDeleting(true)
    setActionError(null)
    try {
      const completedIds = bookings
        .filter((b) => b.status === 'confirmed' && Boolean(b.completed_at))
        .map((b) => b.id)
      await clearClosedBookingsFromHistory(completedIds)
      setClearCompletedConfirmOpen(false)
      setSuccess('farmer.historyCleared')
      reload()
    } catch (caught) {
      logError('owner.clearCompletedBookings', caught)
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
        .filter((b) => b.status === 'rejected' || b.status === 'cancelled')
        .map((b) => b.id)
      await clearClosedBookingsFromHistory(closedIds)
      setClearClosedConfirmOpen(false)
      setSuccess('farmer.historyCleared')
      reload()
    } catch (caught) {
      logError('owner.clearClosedBookings', caught)
      setActionError(mapErrorToKey(caught, 'error.generic'))
    } finally {
      setDeleting(false)
    }
  }

  // ---- Voice: reads each new request aloud; the owner says yes (accept), no (reject) or skip.
  const startVoice = () => {
    setVoiceQueue(bookings.filter((booking) => booking.status === 'pending'))
    setSuccess(null)
    setVoiceOpen(true)
  }

  const voiceSteps: VoiceStep[] = voiceQueue.map((booking, index) =>
    askStep<'yes' | 'no'>({
      id: booking.id,
      prompt: () =>
        t('vf.requests.item', {
          n: index + 1,
          total: voiceQueue.length,
          farmer: booking.farmer?.full_name ?? t('owner.farmer'),
          machine: booking.machine
            ? t(machineTypeLabelKey(booking.machine.machine_type))
            : t('common.unknown'),
          date: formatDate(booking.service_date, language),
          acres: booking.acreage,
          crop: t(cropLabelKey(booking.crop)),
          village: booking.village,
        }),
      parse: (heard) => {
        const answer = parseYesNo(heard)
        return answer ? { ok: true, value: answer } : { ok: false, message: t('vf.yesNoRetry') }
      },
      confirmText: (answer) =>
        t(answer === 'yes' ? 'vf.requests.confirmAccept' : 'vf.requests.confirmReject'),
      apply: async (answer) => {
        const decision: Decision = answer === 'yes' ? 'confirmed' : 'rejected'
        try {
          await respondToBooking(booking.id, decision)
          if (decision === 'confirmed' && isInShareWindow(booking.service_date)) {
            startSharing(booking.id, true)
          }
          reload()
          return t(decision === 'confirmed' ? 'owner.acceptSuccess' : 'owner.rejectSuccess')
        } catch (caught) {
          logError('owner.voiceRespond', caught)
          return t(mapErrorToKey(caught, 'owner.respondError'))
        }
      },
    }),
  )

  return (
    <div>
      <VoiceFlowAssistant
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        title={t('vf.title.requests')}
        intro={
          voiceQueue.length === 0
            ? t('vf.requests.none')
            : t('vf.requests.intro', { count: voiceQueue.length })
        }
        createSteps={() => voiceSteps}
      />

      <PageHeader title={t('owner.requestsTitle')} description={t('owner.requestsSubtitle')} />

      {counts.pending > 0 ? (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          className="mb-4"
          icon={<Mic className="size-5" aria-hidden="true" />}
          onClick={startVoice}
        >
          {t('vf.cta.requests')}
        </Button>
      ) : null}

      {success ? (
        <Alert variant="success" className="mb-4">
          {t(success)}
        </Alert>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('owner.requestsTitle')}>
        {(
          [
            ['pending', t('owner.filterPending'), counts.pending],
            ['confirmed', t('owner.filterConfirmed'), counts.confirmed],
            ['completed', t('owner.filterCompleted'), counts.completed],
            ['closed', t('owner.filterClosed'), counts.closed],
          ] as Array<[Filter, string, number]>
        ).map(([value, label, count]) => {
          const active = filter === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
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

        {filter === 'completed' && counts.completed > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="size-4 text-clay-600" aria-hidden="true" />}
            onClick={() => {
              setActionError(null)
              setClearCompletedConfirmOpen(true)
            }}
            className="text-xs font-semibold text-clay-700 hover:bg-clay-50"
          >
            {t('work.clearAll')}
          </Button>
        ) : filter === 'closed' && counts.closed > 0 ? (
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
          icon={Inbox}
          title={
            filter === 'pending'
              ? t('owner.noRequestsTitle')
              : filter === 'completed'
                ? t('work.noCompleted')
                : t('owner.noClosedBookings')
          }
          description={
            filter === 'pending'
              ? t('owner.noRequestsBody')
              : filter === 'completed'
                ? t('work.noCompleted')
                : t('owner.requestsSubtitle')
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((booking) => {
            const machine = booking.machine
            const typeLabel = machine
              ? t(machineTypeLabelKey(machine.machine_type))
              : t('common.unknown')
            const paused = Boolean(machine && !machine.is_active)
            const isPending = booking.status === 'pending'
            return (
              <Card key={booking.id} as="article" className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    {machine ? (
                      <BookingMachineThumb imagePath={machine.image_path} typeLabel={typeLabel} />
                    ) : null}
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">{typeLabel}</h2>
                      <p className="truncate text-sm text-ink-muted">
                        {machine?.model ?? t('farmer.noModel')}
                      </p>
                      <PersonChip
                        className="mt-1"
                        userId={booking.farmer_id}
                        name={booking.farmer?.full_name}
                        label={t('owner.farmerName', {
                          name: booking.farmer?.full_name ?? t('owner.farmer'),
                        })}
                      />
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {t('farmer.requestedOn', {
                          date: formatDateTime(booking.created_at, language),
                        })}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>

                <div className="mt-3">
                  <BookingDetails booking={booking} />
                </div>

                {booking.notes ? (
                  <Alert variant="info" className="mt-3">
                    <span className="font-semibold">{t('common.notes')}: </span>
                    {booking.notes}
                  </Alert>
                ) : null}

                {booking.owner_note ? (
                  <Alert variant="info" className="mt-3">
                    <span className="font-semibold">{t('owner.ownerNoteLabel')}: </span>
                    {booking.owner_note}
                  </Alert>
                ) : null}

                {isPending && paused ? (
                  <Alert variant="warning" className="mt-3">
                    {t('owner.machinePausedWarning')}
                  </Alert>
                ) : null}

                {booking.contact_phone ? (
                  <div className="mt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-soft">
                      <Phone className="size-4 text-leaf-600" aria-hidden="true" />
                      {t('owner.farmerPhone')}
                    </p>
                    <ContactButtons
                      phone={booking.contact_phone}
                      audience="farmer"
                      message={`${t('app.name')}: ${t('owner.bookedMachine', { machine: typeLabel })} (${formatDate(booking.service_date, language)})`}
                    />
                  </div>
                ) : null}

                {booking.status === 'confirmed' &&
                (workPhase(booking) === 'accepted' || workPhase(booking) === 'working') ? (
                  <ShareLocationPanel
                    bookingId={booking.id}
                    serviceDate={booking.service_date}
                    farmerName={booking.farmer?.full_name ?? t('owner.farmer')}
                    village={booking.village}
                    farmerId={booking.farmer_id}
                  />
                ) : null}

                {booking.status === 'confirmed' ? (
                  <WorkControls
                    booking={booking}
                    onChanged={(message) => {
                      if (message === 'work.completedOk') {
                        stopSharing(booking.id)
                        setFilter('completed')
                      }
                      setSuccess(message)
                      reload()
                    }}
                  />
                ) : null}

                {booking.status === 'confirmed' && Boolean(booking.completed_at) ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-cream-200 pt-4">
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
                      {t('work.removeHistory')}
                    </Button>
                  </div>
                ) : null}

                {booking.status === 'rejected' || booking.status === 'cancelled' ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-cream-200 pt-4">
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
                  </div>
                ) : null}

                {isPending ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-cream-200 pt-4">
                    <Button
                      size="sm"
                      onClick={() => openDialog(booking, 'confirmed')}
                      disabled={paused}
                    >
                      {t('owner.accept')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-clay-300 text-clay-800 hover:bg-clay-50"
                      onClick={() => openDialog(booking, 'rejected')}
                    >
                      {t('owner.reject')}
                    </Button>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(target)}
        onClose={closeDialog}
        onConfirm={() => void confirmResponse()}
        title={
          target?.decision === 'confirmed'
            ? t('owner.acceptConfirmTitle')
            : t('owner.rejectConfirmTitle')
        }
        description={
          target?.decision === 'confirmed'
            ? t('owner.acceptConfirmBody')
            : t('owner.rejectConfirmBody')
        }
        confirmLabel={target?.decision === 'confirmed' ? t('owner.accept') : t('owner.reject')}
        cancelLabel={t('common.cancel')}
        danger={target?.decision === 'rejected'}
        loading={responding}
      >
        {responseError ? <Alert variant="error">{t(responseError)}</Alert> : null}
        {target?.decision === 'rejected' ? (
          <div className={responseError ? 'mt-3' : undefined}>
            <Textarea
              label={t('owner.ownerNote')}
              hint={t('owner.ownerNoteHint')}
              placeholder={t('owner.ownerNotePlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
              rows={3}
            />
          </div>
        ) : null}
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
        title={
          deleteTarget?.completed_at
            ? t('work.removeConfirm')
            : t('farmer.deleteBookingTitle')
        }
        description={t('farmer.deleteBookingBody')}
        confirmLabel={
          deleteTarget?.completed_at
            ? t('work.removeHistory')
            : t('farmer.deleteBookingYes')
        }
        cancelLabel={t('farmer.deleteBookingCancel')}
        danger
        loading={deleting}
      >
        {actionError ? <Alert variant="error">{t(actionError)}</Alert> : null}
      </ConfirmDialog>

      {/* Clear All Completed Bookings Dialog */}
      <ConfirmDialog
        open={clearCompletedConfirmOpen}
        onClose={() => {
          if (deleting) return
          setClearCompletedConfirmOpen(false)
          setActionError(null)
        }}
        onConfirm={() => void confirmClearCompleted()}
        title={t('work.clearConfirm')}
        description={t('farmer.clearClosedBody')}
        confirmLabel={t('work.clearAll')}
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
