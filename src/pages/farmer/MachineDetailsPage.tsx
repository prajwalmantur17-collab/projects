import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  LocateFixed,
  MapPin,
  Mic,
  Tractor,
} from 'lucide-react'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { toast } from '../../lib/toast'
import { formatDate, formatDateTime, formatPrice } from '../../lib/format'
import { CROP_KEYS, PHONE_DISPLAY_PREFIX, isCropKey } from '../../lib/constants'
import {
  addYearsIso,
  parsePositiveNumber,
  todayIsoInIndia,
  validateBookingForm,
} from '../../lib/validation'
import type { BookingFormValues, FieldErrors } from '../../lib/validation'
import {
  CROP_SYNONYMS,
  cleanPlaceName,
  extractPhone,
  matchOption,
  parseNumber,
  parseSpokenDate,
  parseYesNo,
  spokenDigits,
} from '../../lib/voiceParse'
import type { SpokenOption } from '../../lib/voiceParse'
import { useAuth } from '../../auth/AuthProvider'
import { useAsync } from '../../hooks/useAsync'
import { useGeolocation } from '../../hooks/useGeolocation'
import { reverseGeocode } from '../../services/geocode'
import { createBooking } from '../../services/bookings'
import { getMachineCard, getMachineImageUrl, listBlackoutDates } from '../../services/machines'
import { getMachineStatus, joinWaitlist, leaveWaitlist } from '../../services/workStatus'
import type { Booking, CropKey, MachineCard, MachineStatus } from '../../types'
import { MachinePlaceholder } from '../../components/brand/MachinePlaceholder'
import { CropIcon } from '../../components/crop/CropIcon'
import { ContactButtons } from '../../components/contact/ContactButtons'
import { SpeakButton } from '../../components/voice/SpeakButton'
import { VoiceFlowAssistant } from '../../components/voice/VoiceFlowAssistant'
import { askStep, sayStep } from '../../components/voice/voiceSteps'
import type { VoiceStep } from '../../components/voice/voiceSteps'
import { StatusBadge } from '../../components/booking/StatusBadge'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, LoadingScreen } from '../../components/ui/Feedback'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'

const LAST_PHONE_KEY = 'harvest-rentals-last-phone'

type SubmitResult = { ok: true } | { ok: false; key: TranslationKey; invalid?: boolean }

interface MachinePageData {
  machine: MachineCard | null
  blackouts: Array<{ id: string; unavailable_on: string }>
}

export function MachineDetailsPage() {
  const { machineId } = useParams<{ machineId: string }>()
  const { t, language } = useI18n()
  const [searchParams] = useSearchParams()
  const [imageFailed, setImageFailed] = useState(false)
  const [machineStatus, setMachineStatus] = useState<MachineStatus | null>(null)

  const reloadStatus = useCallback(async () => {
    if (!machineId) return
    const status = await getMachineStatus(machineId)
    setMachineStatus(status)
  }, [machineId])

  useEffect(() => {
    void reloadStatus()
  }, [reloadStatus])

  const loader = useCallback(async (): Promise<MachinePageData> => {
    if (!machineId) return { machine: null, blackouts: [] }
    const machine = await getMachineCard(machineId)
    if (!machine) return { machine: null, blackouts: [] }
    let blackouts: Array<{ id: string; unavailable_on: string }> = []
    try {
      blackouts = await listBlackoutDates(machine.id)
    } catch (caught) {
      logError('machine.blackouts', caught)
    }
    return { machine, blackouts }
  }, [machineId])

  const { data, loading, error, reload } = useAsync(loader, {
    fallback: 'farmer.machineLoadError',
  })

  useEffect(() => {
    setImageFailed(false)
  }, [machineId])

  useEffect(() => {
    if (!searchParams.get('book') || !data?.machine) return
    const timer = window.setTimeout(() => {
      document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [searchParams, data?.machine])

  if (loading) return <LoadingScreen message={t('common.loading')} />

  if (error) {
    return (
      <div className="mx-auto max-w-xl">
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(error)}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
        <LinkButton to="/farmer" variant="ghost" className="mt-4">
          {t('common.back')}
        </LinkButton>
      </div>
    )
  }

  if (!data?.machine) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={t('farmer.machineNotFound')} backTo="/farmer" backLabel={t('common.back')} />
        <EmptyState
          icon={Tractor}
          title={t('farmer.machineNotFound')}
          description={t('farmer.machineNotFoundBody')}
          action={
            <LinkButton to="/farmer" variant="primary">
              {t('farmer.findMachine')}
            </LinkButton>
          }
        />
      </div>
    )
  }

  const machine = data.machine
  const imageUrl = imageFailed ? null : getMachineImageUrl(machine.image_path)
  const typeLabel = t(`machineType.${machine.machine_type}`)
  const upcomingBlackouts = data.blackouts.slice(0, 5)
  const unitLabel =
    machine.pricing_unit === 'per_hour'
      ? t('common.perHour')
      : machine.pricing_unit === 'per_day'
      ? t('common.perDay')
      : t('common.perAcre')

  return (
    <div>
      <PageHeader
        title={typeLabel}
        description={machine.model ?? undefined}
        backTo="/farmer"
        backLabel={t('farmer.findMachine')}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-card border border-cream-200 bg-cream-200 shadow-soft">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={t('machine.imageAlt', { type: typeLabel })}
                className="aspect-[16/10] w-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <MachinePlaceholder
                className="aspect-[16/10] w-full"
                label={t('machine.placeholderAlt')}
              />
            )}
          </div>

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink-muted">{t('common.machineType')}</p>
                <h2 className="mt-0.5 text-2xl font-extrabold">{typeLabel}</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {t('machine.listedBy', { name: machine.owner_name })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold text-leaf-800">
                  {formatPrice(machine.price_per_acre)}
                </p>
                <p className="text-sm font-medium text-ink-muted">{unitLabel}</p>
              </div>
            </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {machineStatus?.busy ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-harvest-100 px-3 py-1 text-sm font-bold text-harvest-800">
                    <span className="size-2 rounded-full bg-harvest-500 animate-pulse" aria-hidden="true" />
                    {t('work.busyBadge')}
                  </span>
                ) : null}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
                  machine.is_active
                    ? 'bg-leaf-50 text-leaf-800'
                    : 'bg-clay-50 text-clay-800'
                }`}
              >
                <span
                  className={`size-2 rounded-full ${machine.is_active ? 'bg-leaf-500' : 'bg-clay-500'}`}
                  aria-hidden="true"
                />
                {machine.is_active
                  ? t('farmer.availableInDistrict', { district: machine.district })
                  : t('farmer.paused')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1 text-sm font-semibold text-ink-soft">
                <MapPin className="size-4 text-leaf-600" aria-hidden="true" />
                {machine.village}, {machine.district}
              </span>
              <SpeakButton machine={machine} className="text-sm px-3 py-1" />
            </div>

            <dl className="mt-6 grid gap-4 border-t border-cream-200 pt-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-ink-muted">{t('farmer.owner')}</dt>
                <dd className="mt-0.5 text-base font-semibold">{machine.owner_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink-muted">{t('farmer.serviceAreas')}</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {machine.service_villages.map((village) => (
                    <span
                      key={village}
                      className="rounded-full bg-cream-100 px-2.5 py-0.5 text-sm text-ink-soft"
                    >
                      {village}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink-muted">{t('farmer.supportedCrops')}</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {machine.crops.length === 0 ? (
                    <span className="text-sm text-ink-muted">{t('farmer.noCrops')}</span>
                  ) : (
                    machine.crops.map((crop) => (
                      <span
                        key={crop}
                        className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 py-1 pl-1.5 pr-3 text-sm font-medium text-ink-soft ring-1 ring-cream-300/60"
                      >
                        <CropIcon crop={crop as CropKey} size={18} />
                        <span>{t(`crop.${crop}`)}</span>
                      </span>
                    ))
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink-muted">{t('common.village')}</dt>
                <dd className="mt-0.5 text-base">
                  {machine.village}, {machine.district}, {machine.state}
                </dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-cream-200 pt-5">
              <h3 className="text-base font-bold">{t('farmer.contactOwnerTitle')}</h3>
              <div className="mt-2.5">
                <ContactButtons
                  phone={machine.phone}
                  audience="owner"
                  message={`${t('app.name')}: ${typeLabel} (${machine.village})`}
                />
              </div>
            </div>

            {machineStatus && machineStatus.booked_dates.length > 0 ? (
              <div className="mt-6 border-t border-cream-200 pt-5">
                <h3 className="text-base font-bold">{t('work.bookedDates')}</h3>
                <p className="mt-1 text-xs text-ink-muted">{t('work.bookedDatesHint')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {machineStatus.booked_dates.map((date) => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-1.5 rounded-full bg-clay-50 px-3 py-1 text-sm font-semibold text-clay-800"
                    >
                      <CalendarCheck2 className="size-4" aria-hidden="true" />
                      {formatDate(date, language)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {upcomingBlackouts.length > 0 ? (
              <div className="mt-6 border-t border-cream-200 pt-5">
                <h3 className="text-base font-bold">{t('machine.unavailableDates')}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {upcomingBlackouts.map((date) => (
                    <span
                      key={date.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-clay-50 px-3 py-1 text-sm font-semibold text-clay-800"
                    >
                      <CalendarCheck2 className="size-4" aria-hidden="true" />
                      {formatDate(date.unavailable_on, language)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <div id="booking-form" className="scroll-mt-24 lg:sticky lg:top-20">
          <BookingForm machine={machine} machineStatus={machineStatus} onReloadStatus={reloadStatus} />
        </div>
      </div>
    </div>
  )
}

interface VoiceBookingValues {
  serviceDate: string
  village: string
  acreage: string
  crop: string
  phone: string
}

function BookingForm({
  machine,
  machineStatus,
  onReloadStatus,
}: {
  machine: MachineCard
  machineStatus: MachineStatus | null
  onReloadStatus: () => Promise<void>
}) {
  const { t, language } = useI18n()
  const today = todayIsoInIndia()
  const maxDate = addYearsIso(today, 1)
  const [serviceDate, setServiceDate] = useState('')
  const [village, setVillage] = useState(machine.village)
  const [acreage, setAcreage] = useState('')
  const [crop, setCrop] = useState<string>(machine.crops[0] ?? '')
  const [phone, setPhone] = useState(() => readLastPhone() ?? '')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<TranslationKey | null>(null)
  const [created, setCreated] = useState<Booking | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const geo = useGeolocation()
  const [geocoding, setGeocoding] = useState(false)
  const [detectedLoc, setDetectedLoc] = useState<string | null>(null)
  const { session, profile } = useAuth()
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlistError, setWaitlistError] = useState<TranslationKey | null>(null)
  const [waitlistSuccess, setWaitlistSuccess] = useState<TranslationKey | null>(null)
  const [notifyVoiceOpen, setNotifyVoiceOpen] = useState(false)

  const handleJoinWaitlist = async () => {
    if (waitlistLoading) return
    setWaitlistLoading(true)
    setWaitlistError(null)
    setWaitlistSuccess(null)
    try {
      await joinWaitlist(machine.id)
      setWaitlistSuccess('work.notifyAdded')
      await onReloadStatus()
    } catch (caught) {
      logError('waitlist.join', caught)
      setWaitlistError(mapErrorToKey(caught))
    } finally {
      setWaitlistLoading(false)
    }
  }

  const handleLeaveWaitlist = async () => {
    if (waitlistLoading) return
    setWaitlistLoading(true)
    setWaitlistError(null)
    setWaitlistSuccess(null)
    try {
      await leaveWaitlist(machine.id)
      setWaitlistSuccess('work.notifyRemoved')
      await onReloadStatus()
    } catch (caught) {
      logError('waitlist.leave', caught)
      setWaitlistError(mapErrorToKey(caught))
    } finally {
      setWaitlistLoading(false)
    }
  }
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceStart, setVoiceStart] = useState<VoiceBookingValues>({
    serviceDate: '',
    village: '',
    acreage: '',
    crop: '',
    phone: '',
  })

  const handleUseLocation = async () => {
    setDetectedLoc(null)
    setGeocoding(true)
    try {
      const coords = await geo.request()
      if (!coords) return
      const geocoded = await reverseGeocode(coords, language)
      if (geocoded) {
        const place = geocoded.village || geocoded.district
        if (place) {
          setVillage(place)
          clearFieldError('village')
          setDetectedLoc(`${place}, ${geocoded.district}`)
        }
      }
    } finally {
      setGeocoding(false)
    }
  }

  const clearFieldError = (field: string) => {
    setErrors((previous) => {
      if (!(field in previous)) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  const isDateBooked = Boolean(
    serviceDate && machineStatus?.booked_dates.includes(serviceDate),
  )
  const cropOptions = machine.crops.length > 0 ? machine.crops : CROP_KEYS
  const estimateValue = parsePositiveNumber(acreage)
  const isPerAcre = !machine.pricing_unit || machine.pricing_unit === 'per_acre'
  const estimate =
    isPerAcre && estimateValue !== null && estimateValue > 0
      ? estimateValue * machine.price_per_acre
      : null

  const formUnitLabel =
    machine.pricing_unit === 'per_hour'
      ? t('common.perHour')
      : machine.pricing_unit === 'per_day'
      ? t('common.perDay')
      : t('common.perAcre')

  const submitBooking = async (values: BookingFormValues): Promise<SubmitResult> => {
    setFormError(null)

    const validation = validateBookingForm(values, { allowedCrops: cropOptions, today })
    if (!validation.parsed) {
      setErrors(validation.errors)
      return {
        ok: false,
        key: Object.values(validation.errors)[0] ?? 'farmer.bookingError',
        invalid: true,
      }
    }
    setErrors({})
    setSubmitting(true)

    try {
      const booking = await createBooking({
        machineId: machine.id,
        serviceDate: validation.parsed.serviceDate,
        village: validation.parsed.village,
        acreage: validation.parsed.acreage,
        crop: validation.parsed.crop as CropKey,
        contactPhone: validation.parsed.phone,
        notes: validation.parsed.notes ?? undefined,
      })
      writeLastPhone(validation.parsed.phone)
      setCreated(booking)
      toast.success(t('farmer.bookingSuccessBody'), t('farmer.bookingSuccessTitle'))
      window.setTimeout(() => {
        document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
      return { ok: true }
    } catch (caught) {
      logError('booking.create', caught)
      const key = mapErrorToKey(caught, 'farmer.bookingError')
      setFormError(key)
      toast.error(t(key))
      return { ok: false, key }
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    const result = await submitBooking({ serviceDate, village, acreage, crop, phone, notes })
    if (!result.ok && result.invalid) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      toast.error(t(result.key))
    }
  }

  // ---- Voice booking: asks a few questions out loud and fills in the form.
  const typeLabel = t(`machineType.${machine.machine_type}`)
  const cropChoices: SpokenOption<CropKey>[] = cropOptions.map((key) => ({
    value: key,
    names: [...(CROP_SYNONYMS[key] ?? []), t(`crop.${key}`)],
  }))
  const cropList = cropOptions.map((key) => t(`crop.${key}`)).join(', ')
  const voiceBlocked = !machine.is_active
    ? t('farmer.paused')
    : !session
      ? t('vf.book.signIn')
      : profile && profile.role !== 'farmer'
        ? t('booking.error.role')
        : undefined
  const startVoice = () => {
    setVoiceStart({ serviceDate, village, acreage, crop, phone })
    setVoiceOpen(true)
  }

  const createVoiceSteps = (values: VoiceBookingValues): VoiceStep[] => {
  const voiceMissing = () =>
    !values.serviceDate || !values.village.trim() || !values.acreage || !values.crop || !values.phone

  const cropStep = askStep<CropKey>({
    id: 'crop',
    prompt: t('vf.book.crop', { crops: cropList }),
    parse: (heard) => {
      const match = matchOption(heard, cropChoices)
      return match
        ? { ok: true, value: match }
        : { ok: false, message: t('vf.book.cropBad', { crops: cropList }) }
    },
    describe: (key) => t(`crop.${key}`),
    apply: (key) => {
      values.crop = key
      setCrop(key)
      clearFieldError('crop')
    },
  })

  return [
    askStep<string>({
      id: 'date',
      prompt: t('vf.book.date'),
      parse: (heard) => {
        const iso = parseSpokenDate(heard, today)
        if (!iso) return { ok: false, message: t('vf.book.dateBad') }
        if (iso < today) return { ok: false, message: t('vf.book.datePast') }
        if (iso > maxDate) return { ok: false, message: t('validation.dateTooFar') }
        return { ok: true, value: iso }
      },
      describe: (iso) => formatDate(iso, language),
      apply: (iso) => {
        values.serviceDate = iso
        setServiceDate(iso)
        clearFieldError('serviceDate')
      },
    }),
    askStep<string>({
      id: 'village',
      prompt: t('vf.book.village'),
      parse: (heard) => {
        const name = cleanPlaceName(heard)
        return name.length >= 2 && name.length <= 80
          ? { ok: true, value: name }
          : { ok: false, message: t('vf.book.villageBad') }
      },
      describe: (name) => name,
      apply: (name) => {
        values.village = name
        setVillage(name)
        clearFieldError('village')
      },
    }),
    askStep<string>({
      id: 'acreage',
      prompt: t('vf.book.acreage'),
      parse: (heard) => {
        const number = parseNumber(heard)
        if (number === null || number < 0.1 || number > 500) {
          return { ok: false, message: t('vf.book.acreageBad') }
        }
        return { ok: true, value: String(Math.round(number * 100) / 100) }
      },
      describe: (value) => `${value} ${t('common.acres')}`,
      apply: (value) => {
        values.acreage = value
        setAcreage(value)
        clearFieldError('acreage')
      },
    }),
    ...(cropOptions.length > 1 ? [cropStep] : []),
    askStep<string>({
      id: 'phone',
      prompt: t('vf.book.phone'),
      parse: (heard) => {
        const number = extractPhone(heard)
        return number
          ? { ok: true, value: number }
          : { ok: false, message: t('vf.book.phoneBad') }
      },
      confirmText: (number) => t('vf.confirmAsk', { value: spokenDigits(number) }),
      describe: (number) => spokenDigits(number),
      apply: (number) => {
        values.phone = number
        setPhone(number)
        clearFieldError('phone')
      },
    }),
    askStep<'yes' | 'no'>({
      id: 'summary',
      allowSkip: false,
      when: () => !voiceMissing(),
      prompt: () => {
        return t('vf.book.summary', {
          machine: typeLabel,
          date: formatDate(values.serviceDate, language),
          village: values.village,
          acres: values.acreage,
          crop: t(`crop.${values.crop as CropKey}`),
          phone: spokenDigits(values.phone),
        })
      },
      parse: (heard) => {
        const answer = parseYesNo(heard)
        return answer ? { ok: true, value: answer } : { ok: false, message: t('vf.yesNoRetry') }
      },
      apply: async (answer) => {
        if (answer === 'no') return t('vf.book.notSent')
        const result = await submitBooking({ ...values, notes })
        return result.ok ? t('vf.book.sent') : t(result.key)
      },
    }),
    sayStep('incomplete', () => t('vf.incomplete'), voiceMissing),
  ]
  }

  const notifyVoiceBlocked = !session
    ? t('vf.book.signIn')
    : profile && profile.role !== 'farmer'
      ? t('booking.error.notFarmer')
      : undefined

  const createNotifyVoiceSteps = (): VoiceStep[] => [
    askStep<'yes' | 'no'>({
      id: 'notify',
      allowSkip: false,
      prompt: t('vf.notify.prompt', { machine: typeLabel }),
      confirmText: (answer) =>
        answer === 'yes' ? t('vf.notify.confirmYes') : t('vf.notify.confirmNo'),
      parse: (heard) => {
        const answer = parseYesNo(heard)
        return answer ? { ok: true, value: answer } : { ok: false, message: t('vf.yesNoRetry') }
      },
      apply: async (answer) => {
        if (answer === 'no') return t('vf.notify.cancelled')
        try {
          await joinWaitlist(machine.id)
          await onReloadStatus()
          setWaitlistSuccess('work.notifyAdded')
          return t('work.notifyAdded')
        } catch (caught) {
          logError('waitlist.voiceJoin', caught)
          return t(mapErrorToKey(caught))
        }
      },
    }),
  ]

  const notifyVoiceAssistant = (
    <VoiceFlowAssistant
      open={notifyVoiceOpen}
      onClose={() => setNotifyVoiceOpen(false)}
      title={t('vf.title.notify')}
      intro={t('vf.notify.intro')}
      initialValues={{}}
      createSteps={createNotifyVoiceSteps}
      blockedMessage={notifyVoiceBlocked}
    />
  )

  const voiceAssistant = (
    <VoiceFlowAssistant
      open={voiceOpen}
      onClose={() => setVoiceOpen(false)}
      title={t('vf.title.book')}
      intro={t('vf.book.intro')}
      initialValues={voiceStart}
      createSteps={createVoiceSteps}
      blockedMessage={voiceBlocked}
    />
  )

  if (created) {
    return (
      <>
      {voiceAssistant}
      <Card className="p-5 sm:p-6" >
        <div className="flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-leaf-100 text-leaf-800">
            <CheckCircle2 className="size-8" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-2xl font-extrabold">{t('farmer.bookingSuccessTitle')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            {t('farmer.bookingSuccessBody')}
          </p>
          <div className="mt-4">
            <StatusBadge status={created.status} />
          </div>
          <div className="mt-5 w-full rounded-xl bg-cream-100 p-4 text-left text-sm">
            <p className="flex items-center justify-between gap-3">
              <span className="text-ink-muted">{t('booking.serviceDate')}</span>
              <span className="font-bold">{formatDate(created.service_date, language)}</span>
            </p>
            <p className="mt-2 flex items-center justify-between gap-3">
              <span className="text-ink-muted">{t('booking.village')}</span>
              <span className="font-semibold">{created.village}</span>
            </p>
            <p className="mt-2 flex items-center justify-between gap-3">
              <span className="text-ink-muted">{t('booking.acreage')}</span>
              <span className="font-semibold">
                {created.acreage} {t('common.acres')}
              </span>
            </p>
          </div>
          <LinkButton to="/farmer/bookings" fullWidth className="mt-5">
            {t('farmer.viewMyBookings')}
          </LinkButton>
          <Button
            variant="ghost"
            fullWidth
            className="mt-1"
            onClick={() => {
              setCreated(null)
              setServiceDate('')
              setAcreage('')
              setNotes('')
            }}
          >
            {t('farmer.bookAnother')}
          </Button>
        </div>
      </Card>
      </>
    )
  }

  return (
    <>
    {voiceAssistant}
    <Card className="p-5 sm:p-6">
      <div ref={formRef}>
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-harvest-100 text-harvest-800">
            <Clock3 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold">{t('farmer.bookTitle')}</h2>
            <p className="text-sm font-semibold text-leaf-800">
              {formatPrice(machine.price_per_acre)} <span className="font-normal text-ink-muted">{formUnitLabel}</span>
            </p>
          </div>
        </div>

        {!session ? (
          <Alert variant="warning" className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{t('vf.book.signIn')}</span>
              <LinkButton to="/login" size="sm" variant="outline">
                {t('auth.signIn')}
              </LinkButton>
            </div>
          </Alert>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          className="mt-4"
          icon={<Mic className="size-5" aria-hidden="true" />}
          onClick={startVoice}
        >
          {t('vf.cta.book')}
        </Button>

        {notifyVoiceAssistant}
        {machineStatus?.busy ? (
          <Alert variant="warning" className="mt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-harvest-900">
                <Clock3 className="size-4 shrink-0" aria-hidden="true" />
                <span>{t('work.busyBadge')}</span>
              </div>
              <p className="text-sm text-harvest-950">{t('work.busyBody')}</p>
              {machineStatus.expected_free_at ? (
                <p className="text-xs font-semibold text-harvest-900">
                  {t('work.expectedFree', {
                    time: formatDateTime(machineStatus.expected_free_at, language),
                  })}
                </p>
              ) : null}

              {session && profile?.role === 'farmer' ? (
                <div className="pt-2">
                  {machineStatus.on_waitlist ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-leaf-800">
                        ✓ {t('work.notifyOn')}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={waitlistLoading}
                        onClick={() => void handleLeaveWaitlist()}
                      >
                        {t('work.stopNotify')}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        loading={waitlistLoading}
                        onClick={() => void handleJoinWaitlist()}
                      >
                        {t('work.notifyMe')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<Mic className="size-4" aria-hidden="true" />}
                        onClick={() => setNotifyVoiceOpen(true)}
                      >
                        {t('vf.cta.notify')}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </Alert>
        ) : null}

        {waitlistSuccess ? (
          <Alert variant="success" className="mt-4">
            {t(waitlistSuccess)}
          </Alert>
        ) : null}

        {waitlistError ? (
          <Alert variant="error" className="mt-4">
            {t(waitlistError)}
          </Alert>
        ) : null}

        {!machine.is_active ? (
          <Alert variant="warning" className="mt-4">
            {t('farmer.paused')}
          </Alert>
        ) : null}

        {formError ? (
          <Alert variant="error" className="mt-4">
            {t(formError)}
          </Alert>
        ) : null}

        <form onSubmit={(event) => void onSubmit(event)} className="mt-4 space-y-4" noValidate>
          <Input
            label={t('farmer.bookingDate')}
            hint={t('farmer.bookingDateHint')}
            type="date"
            value={serviceDate}
            min={today}
            max={maxDate}
            onChange={(event) => {
              setServiceDate(event.target.value)
              clearFieldError('serviceDate')
            }}
            error={errors.serviceDate ? t(errors.serviceDate) : isDateBooked ? t('work.bookedDatesHint') : null}
            required
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-sm font-bold text-ink">{t('farmer.bookingVillage')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={geo.loading || geocoding}
              onClick={() => void handleUseLocation()}
              icon={<LocateFixed className="size-4" aria-hidden="true" />}
            >
              {geo.loading || geocoding ? t('farmer.locationFinding') : t('farmer.useLocation')}
            </Button>
          </div>
          {detectedLoc ? (
            <Alert variant="success" className="py-2 text-xs">
              ✓ {t('farmer.locationDetected', {
                place: detectedLoc.split(',')[0].trim(),
                district: detectedLoc.split(',')[1]?.trim() || '',
              })}
            </Alert>
          ) : null}
          <Input
            label=""
            hint={t('farmer.bookingVillageHint')}
            value={village}
            onChange={(event) => setVillage(event.target.value)}
            error={errors.village ? t(errors.village) : null}
            required
            autoComplete="address-level2"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('farmer.acreage')}
              hint={t('farmer.acreageHint')}
              inputMode="decimal"
              value={acreage}
              onChange={(event) => {
                setAcreage(event.target.value)
                clearFieldError('acreage')
              }}
              error={errors.acreage ? t(errors.acreage) : null}
              required
            />

            <div>
              <Select
                label={t('farmer.crop')}
                value={crop}
                onChange={(event) => {
                  setCrop(event.target.value)
                  clearFieldError('crop')
                }}
                error={errors.crop ? t(errors.crop) : null}
                required
              >
                {cropOptions.map((key) => (
                  <option key={key} value={key}>
                    {t(`crop.${key}`)}
                  </option>
                ))}
              </Select>
              {crop && isCropKey(crop) ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-leaf-800">
                  <CropIcon crop={crop} size={18} />
                  <span>{t(`crop.${crop}`)}</span>
                </div>
              ) : null}
            </div>
          </div>

          <Input
            label={t('farmer.phone')}
            hint={t('farmer.phoneHint')}
            type="tel"
            inputMode="tel"
            placeholder={`${PHONE_DISPLAY_PREFIX} 98765 43210`}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              clearFieldError('phone')
            }}
            error={errors.phone ? t(errors.phone) : null}
            required
            autoComplete="tel"
          />

          <Textarea
            label={t('farmer.notes')}
            hint={t('farmer.notesHint')}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            error={errors.notes ? t(errors.notes) : null}
            maxLength={500}
            rows={3}
          />

          {estimate !== null ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-leaf-50 px-4 py-3">
              <span className="text-sm font-semibold text-leaf-900">{t('farmer.estimatedTotal')}</span>
              <span className="text-lg font-extrabold text-leaf-900">{formatPrice(estimate)}</span>
            </div>
          ) : null}
          <p className="text-xs leading-relaxed text-ink-muted">{t('farmer.estimateNote')}</p>

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!machine.is_active}
          >
            {submitting ? t('farmer.bookingSending') : t('farmer.submitBooking')}
          </Button>
        </form>
      </div>
    </Card>
    </>
  )
}

function readLastPhone(): string | null {
  try {
    return window.localStorage.getItem(LAST_PHONE_KEY)
  } catch {
    return null
  }
}

function writeLastPhone(phone: string) {
  try {
    window.localStorage.setItem(LAST_PHONE_KEY, phone)
  } catch {
    // ignore storage access issues
  }
}
