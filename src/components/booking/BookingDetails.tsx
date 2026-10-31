import { useI18n } from '../../i18n'
import { formatDate, formatPrice } from '../../lib/format'
import { cropLabelKey } from '../../lib/labels'
import type { BookingWithRelations } from '../../types'

export function BookingDetails({ booking }: { booking: BookingWithRelations }) {
  const { t, language } = useI18n()

  return (
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
  )
}
