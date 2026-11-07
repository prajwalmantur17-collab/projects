import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MapPin, MessageCircle, Phone } from 'lucide-react'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { formatDistance } from '../../lib/geo'
import { telHref, whatsappHref } from '../../lib/validation'
import { getMachineImageUrl } from '../../services/machines'
import type { CropKey, MachineCard as MachineCardType } from '../../types'
import { CropIcon } from '../crop/CropIcon'
import { MachinePlaceholder } from '../brand/MachinePlaceholder'
import { PersonChip } from '../booking/PersonChip'
import { LinkButton } from '../ui/Button'
import { SpeakButton } from '../voice/SpeakButton'

export function MachineCard({
  machine,
  distanceKm,
  acreage,
  selectedCrop,
  userLocation,
  userVillage,
  userDistrict,
  isBusy,
  index = 0,
}: {
  machine: MachineCardType
  distanceKm?: number | null
  acreage?: number | null
  selectedCrop?: string | null
  userLocation?: string | null
  userVillage?: string | null
  userDistrict?: string | null
  isBusy?: boolean
  /** Position in the list, used only for the staggered entrance. */
  index?: number
}) {
  const { t } = useI18n()
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = imageFailed ? null : getMachineImageUrl(machine.image_path)
  const typeLabel = t(`machineType.${machine.machine_type}`)
  const crops = machine.crops.slice(0, 3)
  const extraCrops = machine.crops.length - crops.length

  const hasAcreage = typeof acreage === 'number' && acreage > 0
  const isPerAcre = !machine.pricing_unit || machine.pricing_unit === 'per_acre'
  const estimatedTotal = hasAcreage && isPerAcre ? machine.price_per_acre * acreage : null

  const unitLabel =
    machine.pricing_unit === 'per_hour'
      ? t('common.perHour')
      : machine.pricing_unit === 'per_day'
      ? t('common.perDay')
      : t('common.perAcre')

  // WhatsApp pre-filled inquiry text
  const cropName = selectedCrop ? t(`crop.${selectedCrop}` as TranslationKey) : 'crops'
  const pricingDetail = `${formatPrice(machine.price_per_acre)} ${unitLabel}`
  const waMessage = `Namaste ${machine.owner_name}, I saw your ${machine.model || typeLabel} (${pricingDetail}) on Harvest Rentals. I need harvesting for ${
    hasAcreage ? `${acreage} acres of ` : ''
  }${cropName} in ${machine.village}. Is your machine available?`

  const normalizedUserLoc = (userLocation || '').trim().toLowerCase()
  const targetVillage = (userVillage || normalizedUserLoc || '').trim().toLowerCase()
  const targetDistrict = (userDistrict || '').trim().toLowerCase()

  const machineDistrict = (machine.district || '').trim().toLowerCase()
  const machineVillage = (machine.village || '').trim().toLowerCase()
  const machineVillages = Array.isArray(machine.service_villages)
    ? machine.service_villages.map((v) => (typeof v === 'string' ? v.toLowerCase() : ''))
    : []

  // Mode B - Level 1: In Your Village (0 to 5 km)
  // Machine parked in exact village, or lists the village under operating villages
  const isInYourVillage =
    Boolean(targetVillage) &&
    (machineVillage === targetVillage ||
      machineVillages.includes(targetVillage) ||
      (targetVillage.length >= 3 && machineVillage.includes(targetVillage)))

  // Mode B - Level 2: Same District (~10 to 40 km)
  // Machine registered in the same revenue district
  const isInSameDistrict =
    !isInYourVillage &&
    Boolean(machineDistrict) &&
    ((Boolean(targetDistrict) &&
      (machineDistrict === targetDistrict ||
        machineDistrict.includes(targetDistrict) ||
        targetDistrict.includes(machineDistrict))) ||
      (Boolean(normalizedUserLoc) &&
        (machineDistrict === normalizedUserLoc ||
          machineDistrict.includes(normalizedUserLoc) ||
          normalizedUserLoc.includes(machineDistrict))))

  const villageEqualsDistrict = machineDistrict === machineVillage

  return (
    <article
      className="card-surface hr-card-in flex flex-col overflow-hidden transition-shadow transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-lift hover:-translate-y-0.5"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-cream-200">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={t('machine.imageAlt', { type: typeLabel })}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <MachinePlaceholder className="size-full" label={t('machine.placeholderAlt')} />
        )}

        {typeof distanceKm === 'number' ? (
          /* Mode A: GPS Distance in Kilometers */
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-1 text-xs font-bold text-leaf-800 shadow-soft">
            <MapPin className="size-3 text-leaf-600" aria-hidden="true" />
            {t('farmer.kmAway', { distance: formatDistance(distanceKm) })}
          </span>
        ) : isInYourVillage ? (
          /* Mode B - Level 1 (In Your Village - 0 to 5 km) */
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-leaf-800/95 backdrop-blur-xs px-3 py-1 text-xs font-bold text-white shadow-soft ring-1 ring-white/60">
            <CheckCircle2 className="size-3.5 text-harvest-400" aria-hidden="true" />
            {t('farmer.inYourVillage', { village: machine.village })}
          </span>
        ) : isInSameDistrict ? (
          /* Mode B - Level 2 (Same District - ~10 to 40 km) */
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-leaf-700/95 backdrop-blur-xs px-3 py-1 text-xs font-bold text-white shadow-soft ring-1 ring-white/50">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {t('farmer.availableInSameDistrict', { district: machine.district })}
          </span>
        ) : (
          /* Available in District */
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-leaf-700/95 backdrop-blur-xs px-3 py-1 text-xs font-bold text-white shadow-soft ring-1 ring-white/50">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {t('farmer.availableInSameDistrict', { district: machine.district })}
          </span>
        )}

        {isBusy ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-harvest-400/95 backdrop-blur-xs px-2.5 py-1 text-xs font-bold text-ink shadow-soft">
            <span className="size-1.5 rounded-full bg-ink animate-pulse" aria-hidden="true" />
            {t('work.busyBadge')}
          </span>
        ) : !machine.is_active ? (
          <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-bold text-white">
            {t('farmer.paused')}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display truncate text-lg font-bold leading-tight text-ink">{typeLabel}</h3>
            <p className="truncate text-sm font-medium text-ink-muted">
              {machine.model ?? t('farmer.noModel')}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-2xl font-extrabold leading-none tracking-tight text-leaf-800">
              {formatPrice(machine.price_per_acre)}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">{unitLabel}</p>
          </div>
        </div>

        {/* Live Estimator for Acreage / Hourly / Daily */}
        {hasAcreage && machine.pricing_unit === 'per_hour' ? (
          <div className="rounded-xl border border-leaf-200 bg-leaf-50/80 px-3 py-2 text-sm font-semibold text-leaf-900">
            <span className="text-leaf-700">{t('ui.hourlyRate')}: </span>
            <span className="text-sm font-extrabold text-leaf-800">{formatPrice(machine.price_per_acre)} {t('price.unitHour')}</span>
            <span className="text-leaf-600"> {t('ui.hoursPerAcre')}</span>
          </div>
        ) : hasAcreage && machine.pricing_unit === 'per_day' ? (
          <div className="rounded-xl border border-leaf-200 bg-leaf-50/80 px-3 py-2 text-sm font-semibold text-leaf-900">
            <span className="text-leaf-700">{t('ui.dailyRate')}: </span>
            <span className="text-sm font-extrabold text-leaf-800">{formatPrice(machine.price_per_acre)} {t('price.unitDay')}</span>
          </div>
        ) : estimatedTotal && hasAcreage ? (
          <div className="rounded-xl border border-leaf-200 bg-leaf-50/80 px-3 py-2 text-sm font-semibold text-leaf-900">
            <span className="text-leaf-700">{t('ui.estTotal')}: </span>
            <span className="text-sm font-extrabold text-leaf-800">{formatPrice(estimatedTotal)}</span>
            <span className="text-leaf-600"> {t('ui.acresCount', { n: acreage ?? 0 })}</span>
          </div>
        ) : null}

        {/* Clean Location without repeating village if village == district */}
        <p className="flex items-start gap-1.5 text-sm text-ink-soft">
          <MapPin className="mt-0.5 size-4 shrink-0 text-leaf-600" aria-hidden="true" />
          <span className="min-w-0">
            <span className="font-semibold">{machine.village}</span>
            <span className="text-ink-muted">
              {villageEqualsDistrict ? '' : ` • ${machine.district}`}
            </span>
          </span>
        </p>

        {/* Diesel & Driver status */}
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
          <CheckCircle2 className="size-3.5 text-leaf-600" />
          <span>{t('ui.operatorIncluded')}</span>
        </div>

        {/* Crops */}
        {machine.crops.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {crops.map((crop) => (
              <span
                key={crop}
                className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 py-0.5 pl-1 pr-2.5 text-sm font-semibold text-ink-soft ring-1 ring-cream-300/60"
              >
                <CropIcon crop={crop as CropKey} size={15} />
                <span>{t(`crop.${crop}` as TranslationKey)}</span>
              </span>
            ))}
            {extraCrops > 0 ? (
              <span className="text-sm font-semibold text-ink-muted">+{extraCrops}</span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          {machine.owner_id ? (
            <PersonChip
              userId={machine.owner_id}
              name={machine.owner_name}
              label={t('farmer.ownerName', { name: machine.owner_name })}
              className="min-w-0 font-medium text-ink-muted"
            />
          ) : (
            <p className="text-sm font-medium text-ink-muted">
              {t('farmer.ownerName', { name: machine.owner_name })}
            </p>
          )}
          <SpeakButton machine={machine} />
        </div>

        {/* Direct Action Buttons - Clean & Non-Redundant */}
        <div className="mt-auto space-y-2 pt-2">
          <LinkButton to={`/farmer/machines/${machine.id}`} variant="primary" size="sm" fullWidth className="min-h-12 text-base font-bold shadow-soft">
            {t('farmer.bookTitle')}
          </LinkButton>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={telHref(machine.phone)}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-cream-200 bg-cream-50/60 px-3 text-sm font-bold text-leaf-900 transition-all duration-button hover:bg-white hover:border-leaf-600 hover:text-leaf-800 active:scale-98"
            >
              <Phone className="size-3.5 shrink-0 text-leaf-700" aria-hidden="true" />
              <span>{t('farmer.callOwner')}</span>
            </a>

            <a
              href={whatsappHref(machine.phone, waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-cream-200 bg-cream-50/60 px-3 text-sm font-bold text-leaf-900 transition-all duration-button hover:bg-white hover:border-leaf-600 hover:text-leaf-800 active:scale-98"
            >
              <MessageCircle className="size-3.5 shrink-0 text-leaf-700" aria-hidden="true" />
              <span>{t('farmer.whatsappOwner')}</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

export function MachineSummaryLink({
  id,
  label,
}: {
  id: string
  label: string
}) {
  return (
    <Link to={`/farmer/machines/${id}`} className="font-semibold text-leaf-700 hover:underline">
      {label}
    </Link>
  )
}
