import { useState } from 'react'
import { Star } from 'lucide-react'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { cropLabelKey, machineTypeLabelKey } from '../../lib/labels'
import { toast } from '../../lib/toast'
import { todayIsoInIndia } from '../../lib/validation'
import { avatarUrl } from '../../services/avatars'
import {
  cancelDriverRequest,
  rateDriver,
  respondToDriverRequest,
} from '../../services/drivers'
import type { DriverRequestRow } from '../../types'
import { Alert } from '../ui/Alert'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Textarea } from '../ui/Input'
import { DriverContact } from './DriverContact'

const STATUS_STYLES: Record<DriverRequestRow['status'], string> = {
  pending: 'border-harvest-200 bg-harvest-50 text-harvest-900',
  accepted: 'border-leaf-200 bg-leaf-50 text-leaf-800',
  declined: 'border-clay-200 bg-clay-50 text-clay-800',
  cancelled: 'border-cream-300 bg-cream-100 text-ink-muted',
}

/**
 * One hire request. mode 'requester' = I asked a driver; mode 'driver' = someone asked me.
 * Calls onChanged after any successful action so the list can reload.
 */
export function DriverRequestCard({
  request,
  mode,
  onChanged,
}: {
  request: DriverRequestRow
  mode: 'requester' | 'driver'
  onChanged: () => void
}) {
  const { t, language } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState('')
  const [rating, setRating] = useState(false)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')

  const isPending = request.status === 'pending'
  const isAccepted = request.status === 'accepted'
  const canRate =
    mode === 'requester' &&
    isAccepted &&
    request.rating_stars == null &&
    request.service_date <= todayIsoInIndia()

  const run = async (action: () => Promise<void>, doneKey: TranslationKey, context: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
      toast.success(t(doneKey))
      onChanged()
      return true
    } catch (caught) {
      logError(context, caught)
      const key = mapErrorToKey(caught, 'error.generic')
      setError(key)
      toast.error(t(key))
      return false
    } finally {
      setBusy(false)
    }
  }

  const accept = () =>
    void run(
      () => respondToDriverRequest(request.id, 'accepted', note.trim() || null),
      'drivers.req.acceptDone',
      'drivers.accept',
    )

  const decline = () =>
    void run(
      () => respondToDriverRequest(request.id, 'declined', note.trim() || null),
      'drivers.req.declineDone',
      'drivers.decline',
    )

  const cancel = async () => {
    const ok = await run(
      () => cancelDriverRequest(request.id),
      'drivers.req.cancelDone',
      'drivers.cancel',
    )
    if (ok) setCancelOpen(false)
  }

  const submitRating = () => {
    if (stars < 1) return
    void run(
      () => rateDriver(request.id, stars, comment.trim() || null),
      'drivers.rate.done',
      'drivers.rate',
    )
  }

  const contactPhone = mode === 'driver' ? request.contact_phone : request.other_phone

  return (
    <Card as="article" className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar url={avatarUrl(request.other_avatar_path)} name={request.other_name} size="md" />
          <div className="min-w-0">
            <p className="truncate font-bold">
              {mode === 'driver'
                ? t('drivers.req.from', { name: request.other_name })
                : t('drivers.req.to', { name: request.other_name })}
            </p>
            <p className="text-sm font-semibold text-leaf-800">
              {t(machineTypeLabelKey(request.machine_type))}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[request.status]}`}
        >
          {t(`drivers.status.${request.status}`)}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-ink-muted">
        <p className="font-semibold text-ink">
          {request.days === 1
            ? t('drivers.req.whenOne', { date: formatDate(request.service_date, language) })
            : t('drivers.req.when', {
                date: formatDate(request.service_date, language),
                days: request.days,
              })}
        </p>
        <p>{t('drivers.req.where', { village: request.village })}</p>
        {request.crop ? (
          <p>{t('drivers.req.crop', { crop: t(cropLabelKey(request.crop)) })}</p>
        ) : null}
        {request.notes ? <p>{t('drivers.req.notes', { notes: request.notes })}</p> : null}
        {request.driver_note ? (
          <p>{t('drivers.req.driverNote', { note: request.driver_note })}</p>
        ) : null}
      </div>

      {(isPending || isAccepted) && contactPhone ? (
        <div className="mt-4">
          <DriverContact
            phone={contactPhone}
            hiddenNote={false}
            callLabel={mode === 'driver' ? t('owner.callFarmer') : undefined}
            whatsappLabel={mode === 'driver' ? t('owner.whatsappFarmer') : undefined}
          />
        </div>
      ) : null}

      {request.rating_stars != null ? (
        <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-ink-soft">
          <Star className="size-4 text-harvest-500" aria-hidden="true" />
          {t('drivers.rate.yours', { n: request.rating_stars })}
        </p>
      ) : null}

      {error ? (
        <Alert variant="error" className="mt-3">
          {t(error)}
        </Alert>
      ) : null}

      {mode === 'driver' && isPending ? (
        <div className="mt-4 space-y-3">
          {declining ? (
            <Textarea
              label={t('drivers.req.noteLabel')}
              value={note}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={accept} loading={busy}>
              {t('drivers.req.accept')}
            </Button>
            {declining ? (
              <Button type="button" size="sm" variant="danger" onClick={decline} loading={busy}>
                {t('drivers.req.decline')}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDeclining(true)}
                disabled={busy}
              >
                {t('drivers.req.decline')}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {canRate ? (
        <div className="mt-4 space-y-3">
          {rating ? (
            <>
              <p className="text-sm font-bold">{t('drivers.rate.title')}</p>
              <div className="flex gap-1" role="group" aria-label={t('drivers.rate.title')}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStars(value)}
                    aria-label={t('drivers.rate.star', { n: value })}
                    aria-pressed={stars === value}
                    className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-harvest-50"
                  >
                    <Star
                      className={`size-7 ${
                        value <= stars ? 'fill-harvest-400 text-harvest-500' : 'text-cream-300'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
              <Textarea
                label={t('drivers.rate.comment')}
                value={comment}
                maxLength={300}
                onChange={(event) => setComment(event.target.value)}
              />
              <Button
                type="button"
                size="sm"
                onClick={submitRating}
                loading={busy}
                disabled={stars < 1}
              >
                {t('drivers.rate.submit')}
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="secondary" onClick={() => setRating(true)}>
              {t('drivers.rate.open')}
            </Button>
          )}
        </div>
      ) : null}

      {isPending || isAccepted ? (
        <div className="mt-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-clay-300 text-clay-800 hover:bg-clay-50"
            onClick={() => {
              setError(null)
              setCancelOpen(true)
            }}
          >
            {t('drivers.req.cancel')}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => void cancel()}
        title={t('drivers.req.cancelTitle')}
        description={t('drivers.req.cancelBody')}
        confirmLabel={t('drivers.req.cancel')}
        cancelLabel={t('drivers.req.keep')}
        danger
        loading={busy}
      >
        {error ? <Alert variant="error">{t(error)}</Alert> : null}
      </ConfirmDialog>
    </Card>
  )
}
