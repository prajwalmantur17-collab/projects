import { useState } from 'react'
import { CheckCircle2, Play, Wallet } from 'lucide-react'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { formatDateTime, formatPrice } from '../../lib/format'
import { completeWork, recordPayment, startWork, workPhase } from '../../services/workStatus'
import type { Booking, PaymentMethod } from '../../types'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

type Panel = 'start' | 'complete' | 'payment' | null
type PayChoice = PaymentMethod | 'none'

const ETA_OPTIONS: Array<{ key: TranslationKey; hours: number | null }> = [
  { key: 'work.eta.unknown', hours: null },
  { key: 'work.eta.h2', hours: 2 },
  { key: 'work.eta.h4', hours: 4 },
  { key: 'work.eta.h8', hours: 8 },
  { key: 'work.eta.d1', hours: 24 },
]

/** Owner controls for an accepted booking: start work, finish the job, record the payment. */
export function WorkControls({
  booking,
  onChanged,
}: {
  booking: Booking
  onChanged: (message: TranslationKey) => void
}) {
  const { t, language } = useI18n()
  const phase = workPhase(booking)
  const [panel, setPanel] = useState<Panel>(null)
  const [eta, setEta] = useState<number | null>(null)
  const [choice, setChoice] = useState<PayChoice>('upi')
  const [amount, setAmount] = useState(() => String(Math.round(booking.acreage * booking.price_per_acre)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)

  if (!phase) return null

  const close = () => {
    setPanel(null)
    setError(null)
  }

  const run = async (action: () => Promise<unknown>, message: TranslationKey) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
      setPanel(null)
      onChanged(message)
    } catch (caught) {
      logError('workControls', caught)
      setError(mapErrorToKey(caught))
    } finally {
      setBusy(false)
    }
  }

  const parsedAmount = Number(amount)
  const amountOk = Number.isFinite(parsedAmount) && parsedAmount >= 0 && amount.trim() !== ''

  const methodLabel = (method: PaymentMethod) => t(method === 'upi' ? 'work.upi' : 'work.cash')

  const submitStart = () =>
    run(
      () =>
        startWork(
          booking.id,
          eta === null ? null : new Date(Date.now() + eta * 3600 * 1000).toISOString(),
        ),
      'work.startedOk',
    )

  const submitComplete = () => {
    if (choice !== 'none' && !amountOk) {
      setError('work.amountBad')
      return
    }
    return run(
      () => completeWork(booking.id, choice === 'none' ? null : { amount: parsedAmount, method: choice }),
      'work.completedOk',
    )
  }

  const submitPayment = () => {
    if (choice === 'none' || !amountOk) {
      setError('work.amountBad')
      return
    }
    return run(() => recordPayment(booking.id, parsedAmount, choice), 'work.paymentSaved')
  }

  const paymentFields = (
    <div className="mt-3 space-y-3">
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-ink-soft">{t('work.payMethod')}</legend>
        <div className="flex flex-wrap gap-2">
          {(panel === 'payment' ? (['upi', 'cash'] as const) : (['upi', 'cash', 'none'] as const)).map(
            (option) => (
              <label
                key={option}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-4 text-sm font-semibold ${
                  choice === option
                    ? 'border-leaf-600 bg-leaf-50 text-leaf-800'
                    : 'border-cream-300 bg-white text-ink-soft'
                }`}
              >
                <input
                  type="radio"
                  name={`pay-${booking.id}`}
                  className="sr-only"
                  checked={choice === option}
                  onChange={() => setChoice(option)}
                />
                {option === 'none' ? t('work.notPaid') : methodLabel(option)}
              </label>
            ),
          )}
        </div>
      </fieldset>
      {choice !== 'none' ? (
        <div>
          <label htmlFor={`amount-${booking.id}`} className="mb-1.5 block text-sm font-bold text-ink-soft">
            {t('work.amount')}
          </label>
          <input
            id={`amount-${booking.id}`}
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="min-h-12 w-full rounded-xl border-2 border-cream-300 bg-white px-4 text-base focus:border-leaf-600"
          />
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="mt-4 border-t border-cream-200 pt-4">
      {phase === 'working' ? (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-harvest-200 bg-harvest-50 px-3 py-1 text-sm font-bold text-harvest-800">
          <Play className="size-4" aria-hidden="true" />
          {t('work.working')}
          {booking.expected_free_at
            ? ` - ${t('work.expectedFree', { time: formatDateTime(booking.expected_free_at, language) })}`
            : ''}
        </p>
      ) : null}

      {phase === 'completed' ? (
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 rounded-full border border-leaf-200 bg-leaf-50 px-3 py-1 text-sm font-bold text-leaf-800">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t('work.doneBadge')}
          </p>
          <p className="text-sm text-ink-soft">
            {booking.payment_method && booking.amount_paid != null
              ? t('work.paidInfo', {
                  amount: formatPrice(booking.amount_paid),
                  method: methodLabel(booking.payment_method),
                })
              : t('work.unpaidInfo')}
          </p>
        </div>
      ) : null}

      {error ? (
        <Alert variant="error" className="mb-3">
          {t(error)}
        </Alert>
      ) : null}

      {panel === 'start' ? (
        <div>
          <p className="text-sm font-bold text-ink-soft">{t('work.startTitle')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ETA_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setEta(option.hours)}
                className={`min-h-11 rounded-xl border-2 px-4 text-sm font-semibold ${
                  eta === option.hours
                    ? 'border-leaf-600 bg-leaf-50 text-leaf-800'
                    : 'border-cream-300 bg-white text-ink-soft'
                }`}
              >
                {t(option.key)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" loading={busy} onClick={() => void submitStart()}>
              {t('work.start')}
            </Button>
            <Button size="sm" variant="ghost" onClick={close} disabled={busy}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {panel === 'complete' || panel === 'payment' ? (
        <div>
          <p className="text-sm font-bold text-ink-soft">
            {panel === 'complete' ? t('work.completeTitle') : t('work.recordPayment')}
          </p>
          {paymentFields}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              loading={busy}
              onClick={() => void (panel === 'complete' ? submitComplete() : submitPayment())}
            >
              {panel === 'complete' ? t('work.confirmComplete') : t('work.savePayment')}
            </Button>
            <Button size="sm" variant="ghost" onClick={close} disabled={busy}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {panel === null ? (
        <div className="flex flex-wrap gap-2">
          {phase === 'accepted' ? (
            <Button size="sm" icon={<Play className="size-4" aria-hidden="true" />} onClick={() => setPanel('start')}>
              {t('work.start')}
            </Button>
          ) : null}
          {phase === 'accepted' || phase === 'working' ? (
            <Button
              size="sm"
              variant={phase === 'working' ? 'primary' : 'outline'}
              icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
              onClick={() => {
                setChoice('upi')
                setPanel('complete')
              }}
            >
              {t('work.complete')}
            </Button>
          ) : null}
          {phase === 'completed' && !booking.payment_method ? (
            <Button
              size="sm"
              variant="outline"
              icon={<Wallet className="size-4" aria-hidden="true" />}
              onClick={() => {
                setChoice('upi')
                setPanel('payment')
              }}
            >
              {t('work.recordPayment')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
