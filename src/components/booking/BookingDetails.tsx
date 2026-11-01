import { CheckCircle2, Play } from 'lucide-react'
import { useI18n } from '../../i18n'
import { formatDate, formatDateTime, formatPrice } from '../../lib/format'
import { cropLabelKey } from '../../lib/labels'
import { workPhase } from '../../services/workStatus'
import type { BookingWithRelations } from '../../types'

export function BookingDetails({ booking }: { booking: BookingWithRelations }) {
  const { t, language } = useI18n()
  const phase = workPhase(booking)
  const methodLabel = booking.payment_method === 'upi' ? t('work.upi') : t('work.cash')

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-cream-50 px-4 py-3.5 text-sm">
        <div>
          <dt className="text-ink-muted">{t('booking.serviceDate')}</dt>
          <dd className="mt-0.5 font-bold text-ink">{formatDate(booking.service_date, language)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('booking.village')}</dt>
          <dd className="mt-0.5 font-semibold text-ink">{booking.village}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('booking.acreage')}</dt>
          <dd className="mt-0.5 font-semibold text-ink">
            {booking.acreage} {t('common.acres')}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('booking.crop')}</dt>
          <dd className="mt-0.5 font-semibold text-ink">
            {t(cropLabelKey(booking.crop))}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('booking.price')}</dt>
          <dd className="mt-0.5 font-semibold text-ink">
            {formatPrice(booking.price_per_acre)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('booking.estimatedTotal')}</dt>
          <dd className="mt-0.5 font-bold text-leaf-800">
            {formatPrice(booking.price_per_acre * booking.acreage)}
          </dd>
        </div>
      </dl>

      {phase === 'working' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-harvest-200 bg-harvest-50 px-3.5 py-2 text-sm font-semibold text-harvest-900">
          <Play className="size-4 shrink-0 text-harvest-700" aria-hidden="true" />
          <span>{t('work.working')}</span>
          {booking.expected_free_at ? (
            <span className="text-xs text-harvest-800">
              • {t('work.expectedFree', { time: formatDateTime(booking.expected_free_at, language) })}
            </span>
          ) : null}
        </div>
      ) : null}

      {phase === 'completed' ? (
        <div className="space-y-1 rounded-xl border border-leaf-200 bg-leaf-50 px-3.5 py-2 text-sm text-leaf-900">
          <div className="flex items-center gap-2 font-bold text-leaf-800">
            <CheckCircle2 className="size-4 text-leaf-600" aria-hidden="true" />
            <span>{t('work.doneBadge')}</span>
          </div>
          <p className="text-xs text-ink-soft">
            {booking.payment_method && booking.amount_paid != null
              ? t('work.paidInfo', {
                  amount: formatPrice(booking.amount_paid),
                  method: methodLabel,
                })
              : t('work.unpaidInfo')}
          </p>
        </div>
      ) : null}
    </div>
  )
}
