import { MapPin, Star } from 'lucide-react'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { cropLabelKey, machineTypeLabelKey } from '../../lib/labels'
import { avatarUrl } from '../../services/avatars'
import type { DriverCard } from '../../types'
import { Avatar } from '../ui/Avatar'

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

export function driverRateText(
  driver: Pick<DriverCard, 'rate_amount' | 'rate_unit'>,
  t: Translate,
): string {
  if (driver.rate_amount == null || !driver.rate_unit) return t('drivers.card.rateNone')
  return t('drivers.card.rate', {
    amount: formatPrice(driver.rate_amount).replace('₹', ''),
    unit: t(`drivers.unit.${driver.rate_unit}`),
  })
}

/** Photo, name, experience, machines, rating and availability of one driver. */
export function DriverSummary({ driver }: { driver: DriverCard }) {
  const { t } = useI18n()
  const place = [driver.village, driver.district].filter(Boolean).join(', ')

  return (
    <div className="flex min-w-0 gap-3">
      <Avatar url={avatarUrl(driver.avatar_path)} name={driver.full_name} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-lg font-bold">{driver.full_name}</h2>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
              driver.is_available
                ? 'border-leaf-200 bg-leaf-50 text-leaf-800'
                : 'border-cream-300 bg-cream-100 text-ink-muted'
            }`}
          >
            {driver.is_available ? t('drivers.card.available') : t('drivers.card.unavailable')}
          </span>
        </div>

        <p className="mt-0.5 text-sm font-semibold text-ink-soft">
          {driver.experience_years > 0
            ? t('drivers.card.experience', { n: driver.experience_years })
            : t('drivers.card.newDriver')}
        </p>

        <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{place}</span>
        </p>

        <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
          <Star className="size-3.5 shrink-0 text-harvest-500" aria-hidden="true" />
          {driver.rating_count > 0 && driver.rating_avg != null
            ? t('drivers.card.rating', {
                avg: Number(driver.rating_avg).toFixed(1),
                count: driver.rating_count,
              })
            : t('drivers.card.noRating')}
          {driver.jobs_done > 0 ? (
            <span> · {t('drivers.card.jobs', { n: driver.jobs_done })}</span>
          ) : null}
        </p>

        <p className="mt-1 text-sm font-semibold text-leaf-800">{driverRateText(driver, t)}</p>

        <div className="mt-2">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t('drivers.card.canRun')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {driver.machine_types.map((type) => (
              <span
                key={type}
                className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-xs font-bold text-leaf-800"
              >
                {t(machineTypeLabelKey(type))}
              </span>
            ))}
          </div>
        </div>

        {driver.crops.length > 0 ? (
          <div className="mt-2">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t('drivers.card.crops')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {driver.crops.map((crop) => (
                <span
                  key={crop}
                  className="rounded-full bg-harvest-50 px-2.5 py-0.5 text-xs font-semibold text-harvest-900"
                >
                  {t(cropLabelKey(crop))}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
