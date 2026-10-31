import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MapPin, MessageCircle, Phone, Wheat } from 'lucide-react'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { formatDistance } from '../../lib/geo'
import { telHref, whatsappHref } from '../../lib/validation'
import { getMachineImageUrl } from '../../services/machines'
import type { MachineCard as MachineCardType } from '../../types'
import { MachinePlaceholder } from '../brand/MachinePlaceholder'
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
}: {
  machine: MachineCardType
  distanceKm?: number | null
  acreage?: number | null
  selectedCrop?: string | null
  userLocation?: string | null
  userVillage?: string | null
  userDistrict?: string | null
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
  const waMessage = `Namaste ${machine.owner_name}, I saw your ${machine.model || typeLabel} (${pricingDetail}) on HarvestRental. I need harvesting for ${
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
    <article className="card-surface flex flex-col overflow-hidden transition-all duration-200 hover:shadow-lift">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-cream-200">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={t('machine.imageAlt', { type: typeLabel })}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <MachinePlaceholder className="size-full" label={t('machine.placeholderAlt')} />
        )}

        {typeof distanceKm === 'number' ? (
          /* Mode A: GPS Distance in Kilometers */
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-leaf-800 shadow-soft">
            <MapPin className="size-3 text-leaf-600" aria-hidden="true" />
            {t('farmer.kmAway', { distance: formatDistance(distanceKm) })}
          </span>
        ) : isInYourVillage ? (
          /* Mode B - Level 1 (In Your Village - 0 to 5 km) */
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-leaf-800 px-3 py-1 text-xs font-bold text-white shadow-soft ring-1 ring-white/60">
            <CheckCircle2 className="size-3.5 text-leaf-300" aria-hidden="true" />
            {t('farmer.inYourVillage', { village: machine.village })}
          </span>
        ) : isInSameDistrict ? (
          /* Mode B - Level 2 (Same District - ~10 to 40 km) */
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-leaf-700 px-3 py-1 text-xs font-bold text-white shadow-soft ring-1 ring-white/50">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {t('farmer.availableInSameDistrict', { district: machine.district })}
          </span>
        ) : (
          /* Available in District */
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-leaf-700 px-3 py-1 text-xs font-bold text-white shadow-soft ring-1 ring-white/50">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {t('farmer.availableInSameDistrict', { district: machine.district })}
          </span>
        )}

        {!machine.is_active ? (
          <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-bold text-white">
            {t('farmer.paused')}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold leading-tight">{typeLabel}</h3>
            <p className="truncate text-sm font-medium text-ink-muted">
              {machine.model ?? t('farmer.noModel')}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-extrabold text-leaf-800">
              {formatPrice(machine.price_per_acre)}
            </p>
            <p className="text-xs font-medium text-ink-muted">{unitLabel}</p>
          </div>
        </div>

        {/* Live Estimator for Acreage / Hourly / Daily */}
        {hasAcreage && machine.pricing_unit === 'per_hour' ? (
          <div className="rounded-xl border border-leaf-200 bg-leaf-50/80 px-3 py-2 text-xs font-semibold text-leaf-900">
            <span className="text-leaf-700">Hourly Rate: </span>
            <span className="text-sm font-extrabold text-leaf-800">{formatPrice(machine.price_per_acre)} / hr</span>
            <span className="text-leaf-600"> (approx. ~1.5 hrs/acre)</span>
          </div>
        ) : hasAcreage && machine.pricing_unit === 'per_day' ? (
          <div className="rounded-xl border border-leaf-200 bg-leaf-50/80 px-3 py-2 text-xs font-semibold text-leaf-900">
            <span className="text-leaf-700">Daily Rate: </span>
            <span className="text-sm font-extrabold text-leaf-800">{formatPrice(machine.price_per_acre)} / day</span>
          </div>
        ) : estimatedTotal ? (
          <div className="rounded-xl border border-leaf-200 bg-leaf-50/80 px-3 py-2 text-xs font-semibold text-leaf-900">
            <span className="text-leaf-700">Estimated Total: </span>
            <span className="text-sm font-extrabold text-leaf-800">{formatPrice(estimatedTotal)}</span>
            <span className="text-leaf-600"> ({acreage} acres)</span>
          </div>
        ) : null}

        {/* In Village or Same District Highlight Tag */}
        {isInYourVillage ? (
          <div className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-leaf-400 bg-leaf-50 px-2.5 py-1 text-xs font-bold text-leaf-900">
            <CheckCircle2 className="size-3.5 text-leaf-700" />
            <span>{t('farmer.inYourVillageBadge')} • {machine.village}</span>
          </div>
        ) : (
          <div className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-leaf-300 bg-leaf-50 px-2.5 py-1 text-xs font-bold text-leaf-900">
            <CheckCircle2 className="size-3.5 text-leaf-700" />
            <span>{t('farmer.sameDistrictBadge')} • {machine.district}</span>
          </div>
        )}

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
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
          <CheckCircle2 className="size-3.5 text-leaf-600" />
          <span>Operator & Diesel included</span>
        </div>

        {/* Crops */}
        {machine.crops.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Wheat className="size-4 text-leaf-600" aria-hidden="true" />
            {crops.map((crop) => (
              <span
                key={crop}
                className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-ink-soft"
              >
                {t(`crop.${crop}`)}
              </span>
            ))}
            {extraCrops > 0 ? (
              <span className="text-xs font-semibold text-ink-muted">+{extraCrops}</span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink-muted">
            {t('farmer.ownerName', { name: machine.owner_name })}
          </p>
          <SpeakButton machine={machine} />
        </div>

        {/* Direct Action Buttons - Clean & Non-Redundant */}
        <div className="mt-auto space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={telHref(machine.phone)}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-leaf-700 bg-white px-3 text-xs font-bold text-leaf-800 transition-colors hover:bg-leaf-50 active:scale-95"
            >
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              <span>{t('farmer.callOwner')}</span>
            </a>

            <a
              href={whatsappHref(machine.phone, waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-leaf-700 px-3 text-xs font-bold text-cream-50 transition-colors hover:bg-leaf-800 active:scale-95"
            >
              <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{t('farmer.whatsappOwner')}</span>
            </a>
          </div>

          <LinkButton to={`/farmer/machines/${machine.id}`} variant="outline" size="sm" fullWidth>
            {t('common.viewDetails')} &amp; {t('farmer.bookTitle')}
          </LinkButton>
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
