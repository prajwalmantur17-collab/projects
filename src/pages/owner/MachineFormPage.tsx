import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, LocateFixed, MapPin, Mic, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { CROP_KEYS, MACHINE_TYPES, MAX_VILLAGES } from '../../lib/constants'
import { CROP_DISPLAY_ORDER } from '../../lib/cropConfig'
import { CropCard } from '../../components/crop/CropCard'
import { logError, mapErrorToKey } from '../../lib/errors'
import { toast } from '../../lib/toast'
import { machineTypeLabelKey } from '../../lib/labels'
import { validateMachineForm } from '../../lib/validation'
import {
  CROP_SYNONYMS,
  MACHINE_SYNONYMS,
  PRICING_UNIT_SYNONYMS,
  cleanPlaceName,
  extractPhone,
  matchAllOptions,
  matchOption,
  parseNumber,
  parseYesNo,
  saysAll,
  spokenDigits,
} from '../../lib/voiceParse'
import type { SpokenOption } from '../../lib/voiceParse'
import type { FieldErrors, MachineFormParsed } from '../../lib/validation'
import { useAsync } from '../../hooks/useAsync'
import { useGeolocation } from '../../hooks/useGeolocation'
import { reverseGeocode } from '../../services/geocode'
import {
  createMachine,
  deleteMachine,
  deleteMachineImage,
  getMachineCard,
  getMachineLocations,
  updateMachine,
  uploadMachineImage,
} from '../../services/machines'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import type {
  Coordinates,
  CropKey,
  MachineCard,
  MachineInput,
  MachineLocation,
  MachineType,
} from '../../types'
import { ImageUpload } from '../../components/machine/ImageUpload'
import { VoiceFlowAssistant } from '../../components/voice/VoiceFlowAssistant'
import { askStep, sayStep } from '../../components/voice/voiceSteps'
import type { VoiceStep } from '../../components/voice/voiceSteps'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { LoadingScreen } from '../../components/ui/Feedback'
import { Input, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'

interface FormState {
  machineType: string
  model: string
  pricePerAcre: string
  pricingUnit: 'per_acre' | 'per_hour' | 'per_day'
  crops: string[]
  primaryVillage: string
  district: string
  state: string
  phone: string
  extraVillages: string[]
}

type SaveResult = { ok: true } | { ok: false; key: TranslationKey; invalid?: boolean }

interface EditData {
  machine: MachineCard | null
  locations: MachineLocation[]
}

export function MachineFormPage() {
  const { machineId } = useParams<{ machineId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const ownerId = profile?.id ?? 'demo-owner'
  const { t, language } = useI18n()
  const isEdit = Boolean(machineId)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!machineId) return
    setDeleting(true)
    setFormError(null)
    try {
      await deleteMachine(machineId, ownerId)
      navigate('/owner/machines')
    } catch (caught) {
      logError('machine.delete', caught)
      setFormError(mapErrorToKey(caught, 'owner.deleteError'))
      setDeleteConfirmOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const loader = useCallback(async (): Promise<EditData> => {
    if (!machineId || !ownerId) return { machine: null, locations: [] }
    const machine = await getMachineCard(machineId, { allowInactive: true })
    if (!machine || machine.owner_id !== ownerId) {
      return { machine: null, locations: [] }
    }
    const locations = await getMachineLocations(machine.id)
    return { machine, locations }
  }, [machineId, ownerId])

  const { data, loading, error, reload } = useAsync(loader, {
    enabled: isEdit,
    fallback: 'machine.editLoadError',
  })

  const [form, setForm] = useState<FormState>(() => ({
    machineType: '',
    model: '',
    pricePerAcre: '',
    pricingUnit: 'per_acre',
    crops: [],
    primaryVillage: profile?.village ?? '',
    district: profile?.district ?? '',
    state: profile?.state ?? '',
    phone: '',
    extraVillages: [],
  }))
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<TranslationKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [autoFilledNotice, setAutoFilledNotice] = useState<string | null>(null)
  const [gpsMessage, setGpsMessage] = useState<'added' | 'denied' | null>(null)
  const [initialized, setInitialized] = useState(!isEdit)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceStart, setVoiceStart] = useState<FormState>(form)
  const formRef = useRef<HTMLFormElement>(null)
  const geo = useGeolocation()

  useEffect(() => {
    if (!data || initialized) return
    const machine = data.machine
    if (!machine) {
      setInitialized(true)
      return
    }
    const primary = data.locations.find((location) => location.is_primary) ?? data.locations[0]
    setForm({
      machineType: machine.machine_type,
      model: machine.model ?? '',
      pricePerAcre: String(machine.price_per_acre),
      pricingUnit: machine.pricing_unit ?? 'per_acre',
      crops: machine.crops,
      primaryVillage: primary?.village ?? machine.village,
      district: primary?.district ?? machine.district,
      state: primary?.state ?? machine.state,
      phone: machine.phone,
      extraVillages: data.locations
        .filter((location) => !location.is_primary)
        .map((location) => location.village),
    })
    setCoordinates(
      machine.latitude !== null && machine.longitude !== null
        ? { latitude: machine.latitude, longitude: machine.longitude }
        : null,
    )
    setImagePath(machine.image_path)
    setInitialized(true)
  }, [data, initialized])

  const clearFieldError = (field: string) => {
    setErrors((previous) => {
      if (!(field in previous)) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    clearFieldError(key)
  }

  const toggleCrop = (crop: CropKey) => {
    const next = form.crops.includes(crop)
      ? form.crops.filter((value) => value !== crop)
      : [...form.crops, crop]
    setField('crops', next)
  }

  const addVillage = () => {
    if (form.extraVillages.length + 1 >= MAX_VILLAGES) return
    setField('extraVillages', [...form.extraVillages, ''])
  }

  const updateVillage = (index: number, value: string) => {
    setField(
      'extraVillages',
      form.extraVillages.map((village, position) => (position === index ? value : village)),
    )
  }

  const removeVillage = (index: number) => {
    setField(
      'extraVillages',
      form.extraVillages.filter((_, position) => position !== index),
    )
  }

  const handleGps = async () => {
    setGpsMessage(null)
    setAutoFilledNotice(null)
    setGeocoding(true)
    try {
      const result = await geo.request()
      if (result) {
        setCoordinates(result)
        setGpsMessage('added')

        // Auto-fill Operating Village, District, and State without typing
        const geocoded = await reverseGeocode(result, language)
        if (geocoded) {
          if (geocoded.village) {
            setField('primaryVillage', geocoded.village)
          }
          if (geocoded.district) {
            setField('district', geocoded.district)
          }
          if (geocoded.state) {
            setField('state', geocoded.state)
          }
          setAutoFilledNotice(`${geocoded.village}, ${geocoded.district}`)
        }
      } else {
        setGpsMessage('denied')
      }
    } finally {
      setGeocoding(false)
    }
  }

  const saveMachine = async (values: FormState): Promise<SaveResult> => {
    const activeOwnerId = profile?.id ?? 'demo-owner'
    setFormError(null)

    const validation = validateMachineForm(values)
    if (!validation.parsed) {
      setErrors(validation.errors)
      return {
        ok: false,
        key: Object.values(validation.errors)[0] ?? 'machine.saveError',
        invalid: true,
      }
    }
    setErrors({})
    setSaving(true)

    const parsed = validation.parsed
    const input = toMachineInput(parsed, coordinates)
    let uploadedPath: string | null = null

    try {
      if (imageFile) {
        try {
          uploadedPath = await uploadMachineImage(imageFile, activeOwnerId)
        } catch (caught) {
          logError('machine.uploadImage', caught)
          setFormError('machine.photoError')
          return { ok: false, key: 'machine.photoError' }
        }
      }

      const nextImagePath = uploadedPath ?? (imageRemoved ? null : imagePath)
      const previousImagePath = data?.machine?.image_path ?? null

      if (machineId) {
        await updateMachine(machineId, input, nextImagePath)
      } else {
        await createMachine(activeOwnerId, input, nextImagePath)
      }

      if (previousImagePath && previousImagePath !== nextImagePath) {
        void deleteMachineImage(previousImagePath, activeOwnerId).catch((caught) => {
          logError('machine.deleteOldImage', caught)
        })
      }

      setImagePath(nextImagePath)
      setImageFile(null)
      setImageRemoved(false)
      setSaved(true)
      toast.success(t(machineId ? 'machine.updateSuccess' : 'machine.saveSuccess'))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return { ok: true }
    } catch (caught) {
      logError('machine.save', caught)
      if (uploadedPath) {
        void deleteMachineImage(uploadedPath, activeOwnerId).catch((deleteError) => {
          logError('machine.cleanupUpload', deleteError)
        })
      }
      const key = mapErrorToKey(caught, 'machine.saveError')
      setFormError(key)
      toast.error(t(key))
      return { ok: false, key }
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const result = await saveMachine(form)
    if (!result.ok && result.invalid) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      toast.error(t(result.key))
    }
  }

  // ---- Voice: asks a few questions out loud and fills in the form.
  const unitLabel = (unit: FormState['pricingUnit']) =>
    unit === 'per_hour'
      ? t('common.perHour')
      : unit === 'per_day'
        ? t('common.perDay')
        : t('common.perAcre')

  const machineChoices: SpokenOption<MachineType>[] = MACHINE_TYPES.map((type) => ({
    value: type,
    names: [...(MACHINE_SYNONYMS[type] ?? []), t(machineTypeLabelKey(type))],
  }))
  const unitChoices: SpokenOption<FormState['pricingUnit']>[] = (
    ['per_acre', 'per_hour', 'per_day'] as const
  ).map((unit) => ({ value: unit, names: PRICING_UNIT_SYNONYMS[unit] ?? [] }))
  const cropChoices: SpokenOption<CropKey>[] = CROP_KEYS.map((key) => ({
    value: key,
    names: [...(CROP_SYNONYMS[key] ?? []), t(`crop.${key}`)],
  }))

  const startVoice = () => {
    setVoiceStart({ ...form, extraVillages: [...form.extraVillages] })
    setVoiceOpen(true)
  }

  const createVoiceSteps = (values: FormState): VoiceStep[] => {
  const voiceMissing = () => {
    return (
      !values.machineType ||
      !values.pricePerAcre ||
      values.crops.length === 0 ||
      !values.primaryVillage.trim() ||
      !values.district.trim() ||
      !values.state.trim() ||
      !values.phone
    )
  }

  const placeStep = (
    id: string,
    prompt: TranslationKey,
    field: 'primaryVillage' | 'district' | 'state',
  ) =>
    askStep<string>({
      id,
      prompt: t(prompt),
      parse: (heard) => {
        const name = cleanPlaceName(heard)
        return name.length >= 2 && name.length <= 80
          ? { ok: true, value: name }
          : { ok: false, message: t('vf.machine.placeBad') }
      },
      describe: (name) => name,
      apply: (name) => {
        values[field] = name
        setField(field, name)
      },
    })

  return [
    askStep<MachineType>({
      id: 'type',
      prompt: t('vf.machine.type'),
      parse: (heard) => {
        const match = matchOption(heard, machineChoices)
        return match
          ? { ok: true, value: match }
          : { ok: false, message: t('vf.machine.typeBad') }
      },
      describe: (type) => t(machineTypeLabelKey(type)),
      apply: (type) => {
        values.machineType = type
        setField('machineType', type)
      },
    }),
    askStep<FormState['pricingUnit']>({
      id: 'unit',
      prompt: t('vf.machine.unit'),
      parse: (heard) => {
        const match = matchOption(heard, unitChoices)
        return match
          ? { ok: true, value: match }
          : { ok: false, message: t('vf.machine.unitBad') }
      },
      describe: (unit) => unitLabel(unit),
      apply: (unit) => {
        values.pricingUnit = unit
        setField('pricingUnit', unit)
      },
    }),
    askStep<string>({
      id: 'price',
      prompt: () => t('vf.machine.price', { unit: unitLabel(values.pricingUnit) }),
      parse: (heard) => {
        const number = parseNumber(heard)
        if (number === null || number < 1 || number > 1_000_000) {
          return { ok: false, message: t('vf.machine.priceBad') }
        }
        return { ok: true, value: String(Math.round(number * 100) / 100) }
      },
      describe: (value) => `₹${value}`,
      apply: (value) => {
        values.pricePerAcre = value
        setField('pricePerAcre', value)
      },
    }),
    askStep<CropKey[]>({
      id: 'crops',
      prompt: t('vf.machine.crops'),
      parse: (heard) => {
        const crops = saysAll(heard) ? [...CROP_KEYS] : matchAllOptions(heard, cropChoices)
        return crops.length > 0
          ? { ok: true, value: crops }
          : { ok: false, message: t('vf.machine.cropsBad') }
      },
      describe: (crops) => crops.map((key) => t(`crop.${key}`)).join(', '),
      apply: (crops) => {
        values.crops = crops
        setField('crops', crops)
      },
    }),
    placeStep('village', 'vf.machine.village', 'primaryVillage'),
    placeStep('district', 'vf.machine.district', 'district'),
    placeStep('state', 'vf.machine.state', 'state'),
    askStep<string>({
      id: 'phone',
      prompt: t('vf.machine.phone'),
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
        setField('phone', number)
      },
    }),
    askStep<'yes' | 'no'>({
      id: 'summary',
      allowSkip: false,
      when: () => !voiceMissing(),
      prompt: () => {
        return t('vf.machine.summary', {
          type: t(machineTypeLabelKey(values.machineType)),
          price: values.pricePerAcre,
          unit: unitLabel(values.pricingUnit),
          crops: values.crops.map((key) => t(`crop.${key as CropKey}`)).join(', '),
          village: values.primaryVillage,
          district: values.district,
          state: values.state,
          phone: spokenDigits(values.phone),
        })
      },
      parse: (heard) => {
        const answer = parseYesNo(heard)
        return answer ? { ok: true, value: answer } : { ok: false, message: t('vf.yesNoRetry') }
      },
      apply: async (answer) => {
        if (answer === 'no') return t('vf.machine.notSaved')
        const result = await saveMachine(values)
        return result.ok ? t('vf.machine.saved') : t(result.key)
      },
    }),
    sayStep('incomplete', () => t('vf.incomplete'), voiceMissing),
  ]
  }

  const voiceAssistant = (
    <VoiceFlowAssistant
      open={voiceOpen}
      onClose={() => setVoiceOpen(false)}
      title={t('vf.title.machine')}
      intro={t('vf.machine.intro')}
      initialValues={voiceStart}
      createSteps={createVoiceSteps}
    />
  )

  if (isEdit && (loading || !initialized) && !error) {
    return <LoadingScreen message={t('common.loading')} />
  }

  if (isEdit && error) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(error)}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
        <LinkButton to="/owner/machines" variant="ghost" className="mt-4">
          {t('machine.backToMachines')}
        </LinkButton>
      </div>
    )
  }

  if (isEdit && initialized && !data?.machine) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title={t('machine.notFoundTitle')}
          backTo="/owner/machines"
          backLabel={t('machine.backToMachines')}
        />
        <Card className="p-6 text-center">
          <p className="text-ink-muted">{t('machine.notFoundBody')}</p>
          <LinkButton to="/owner/machines" variant="primary" className="mt-4">
            {t('machine.backToMachines')}
          </LinkButton>
        </Card>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-xl">
        {voiceAssistant}
        <Card className="p-6">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-leaf-100 text-leaf-800">
              <CheckCircle2 className="size-8" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold">
              {isEdit ? t('machine.updateSuccess') : t('machine.createSuccess')}
            </h1>
            <p className="mt-2 text-sm text-ink-muted">{t('owner.myMachinesSubtitle')}</p>
            <LinkButton to="/owner/machines" variant="primary" fullWidth className="mt-5">
              {t('owner.myMachinesTitle')}
            </LinkButton>
            <LinkButton to="/owner" variant="ghost" fullWidth className="mt-1">
              {t('common.home')}
            </LinkButton>
          </div>
        </Card>
      </div>
    )
  }

  const canAddVillage = form.extraVillages.length + 1 < MAX_VILLAGES

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isEdit ? t('machine.editTitle') : t('machine.newTitle')}
        description={t('machine.formSubtitle')}
        backTo="/owner/machines"
        backLabel={t('machine.backToMachines')}
      />

      {voiceAssistant}
      <Button
        type="button"
        variant="secondary"
        size="lg"
        fullWidth
        className="mb-5"
        icon={<Mic className="size-5" aria-hidden="true" />}
        onClick={startVoice}
      >
        {t('vf.cta.machine')}
      </Button>

      <form ref={formRef} onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-5">
        <Card className="space-y-5 p-5 sm:p-6">
          <Select
            label={t('machine.typeLabel')}
            hint={t('machine.typeHint')}
            value={form.machineType}
            onChange={(event) => setField('machineType', event.target.value)}
            error={errors.machineType ? t(errors.machineType) : null}
            required
          >
            <option value="">{t('common.choose')}</option>
            {MACHINE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(machineTypeLabelKey(type))}
              </option>
            ))}
          </Select>

          <Input
            label={t('machine.modelLabel')}
            hint={t('machine.modelHint')}
            value={form.model}
            onChange={(event) => setField('model', event.target.value)}
            error={errors.model ? t(errors.model) : null}
            maxLength={80}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Input
                label={t('machine.priceLabel')}
                hint={
                  form.pricingUnit === 'per_hour'
                    ? 'In rupees, for one hour of work.'
                    : form.pricingUnit === 'per_day'
                    ? 'In rupees, for one full day.'
                    : 'In rupees, for one acre.'
                }
                inputMode="decimal"
                value={form.pricePerAcre}
                onChange={(event) => setField('pricePerAcre', event.target.value)}
                error={errors.pricePerAcre ? t(errors.pricePerAcre) : null}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink">
                {t('machine.pricingUnitLabel')}
              </label>
              <p className="mt-0.5 text-sm text-ink-muted">
                {t('machine.pricingUnitHint')}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setField('pricingUnit', 'per_acre')}
                  className={`flex min-h-11 items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                    form.pricingUnit === 'per_acre'
                      ? 'border-leaf-700 bg-leaf-100 text-leaf-900 shadow-soft'
                      : 'border-cream-300 bg-white text-ink-soft hover:bg-cream-50'
                  }`}
                >
                  {t('machine.pricingPerAcre')}
                </button>
                <button
                  type="button"
                  onClick={() => setField('pricingUnit', 'per_hour')}
                  className={`flex min-h-11 items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                    form.pricingUnit === 'per_hour'
                      ? 'border-leaf-700 bg-leaf-100 text-leaf-900 shadow-soft'
                      : 'border-cream-300 bg-white text-ink-soft hover:bg-cream-50'
                  }`}
                >
                  {t('machine.pricingPerHour')}
                </button>
                <button
                  type="button"
                  onClick={() => setField('pricingUnit', 'per_day')}
                  className={`flex min-h-11 items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                    form.pricingUnit === 'per_day'
                      ? 'border-leaf-700 bg-leaf-100 text-leaf-900 shadow-soft'
                      : 'border-cream-300 bg-white text-ink-soft hover:bg-cream-50'
                  }`}
                >
                  {t('machine.pricingPerDay')}
                </button>
              </div>
            </div>
          </div>

          <fieldset>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <legend className="text-base font-semibold text-ink">
                  {t('machine.cropsLabel')}
                  <span className="ml-1 text-clay-600" aria-hidden="true">
                    *
                  </span>
                </legend>
                <p className="mt-0.5 text-sm text-ink-muted">{t('machine.cropsHint')}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-leaf-800">
                  {form.crops.length} of {CROP_KEYS.length} selected
                </span>
                <span className="text-cream-300">|</span>
                <button
                  type="button"
                  onClick={() => setField('crops', [...CROP_KEYS])}
                  className="text-xs font-bold text-leaf-700 hover:underline"
                >
                  {t('ui.selectAll')}
                </button>
                <span className="text-cream-300">|</span>
                <button
                  type="button"
                  onClick={() => setField('crops', [])}
                  className="text-xs font-bold text-ink-muted hover:underline"
                >
                  {t('ui.clearAll')}
                </button>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2.5 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5">
              {CROP_DISPLAY_ORDER.map((crop) => {
                const active = form.crops.includes(crop)
                return (
                  <CropCard
                    key={crop}
                    crop={crop}
                    selected={active}
                    onClick={() => toggleCrop(crop)}
                    compact
                  />
                )
              })}
            </div>
            {errors.crops ? (
              <p className="mt-2 text-sm font-medium text-clay-700" role="alert">
                {t(errors.crops)}
              </p>
            ) : null}
          </fieldset>
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">{t('machine.locationsTitle')}</h2>
              <p className="mt-0.5 text-sm text-ink-muted">{t('machine.primaryVillageHint')}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={geo.loading || geocoding}
              onClick={() => void handleGps()}
              icon={<LocateFixed className="size-4" aria-hidden="true" />}
            >
              {geo.loading || geocoding ? t('farmer.locationFinding') : t('farmer.useLocation')}
            </Button>
          </div>

          {autoFilledNotice ? (
            <Alert variant="success" className="py-2 text-xs">
              ✓ {t('machine.locationAutoFilled')} ({autoFilledNotice})
            </Alert>
          ) : null}

          <Input
            label={t('machine.primaryVillage')}
            value={form.primaryVillage}
            onChange={(event) => setField('primaryVillage', event.target.value)}
            error={errors.primaryVillage ? t(errors.primaryVillage) : null}
            required
            autoComplete="address-level2"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('machine.districtLabel')}
              value={form.district}
              onChange={(event) => setField('district', event.target.value)}
              error={errors.district ? t(errors.district) : null}
              required
              autoComplete="address-level1"
            />
            <Input
              label={t('machine.stateLabel')}
              value={form.state}
              onChange={(event) => setField('state', event.target.value)}
              error={errors.state ? t(errors.state) : null}
              required
              autoComplete="address-level1"
            />
          </div>

          <div>
            <p className="text-base font-semibold text-ink">{t('machine.additionalVillages')}</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {t('machine.additionalVillagesHint')}
            </p>

            {form.extraVillages.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">{t('machine.noAdditionalVillages')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {form.extraVillages.map((village, index) => (
                  <li key={index} className="flex items-end gap-2">
                    <Input
                      label={t('machine.villageField')}
                      value={village}
                      onChange={(event) => updateVillage(index, event.target.value)}
                      containerClassName="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mb-1 shrink-0 text-clay-800"
                      aria-label={`${t('common.remove')} ${t('machine.villageField')}`}
                      onClick={() => removeVillage(index)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {errors.extraVillages ? (
              <p className="mt-2 text-sm font-medium text-clay-700" role="alert">
                {t(errors.extraVillages)}
              </p>
            ) : null}

            {canAddVillage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={addVillage}
                icon={<Plus className="size-4" aria-hidden="true" />}
              >
                {t('machine.addVillage')}
              </Button>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <Input
            label={t('machine.phoneLabel')}
            hint={t('machine.phoneHint')}
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => setField('phone', event.target.value)}
            error={errors.phone ? t(errors.phone) : null}
            required
            autoComplete="tel"
          />

          <div className="border-t border-cream-200 pt-5">
            <ImageUpload
              initialPath={imagePath}
              selectedFile={imageFile}
              removed={imageRemoved}
              onSelect={(file) => {
                setImageFile(file)
                if (file) setImageRemoved(false)
              }}
              onRemove={() => {
                setImageFile(null)
                setImageRemoved(true)
              }}
              disabled={saving}
            />
          </div>

          <div className="border-t border-cream-200 pt-5">
            <p className="text-base font-semibold text-ink">{t('machine.gpsLabel')}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{t('machine.gpsHint')}</p>

            {coordinates ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-leaf-50 p-3">
                <MapPin className="size-5 shrink-0 text-leaf-700" aria-hidden="true" />
                <p className="flex-1 text-sm font-semibold text-leaf-900">
                  {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-clay-800"
                  onClick={() => {
                    setCoordinates(null)
                    setGpsMessage(null)
                  }}
                >
                  {t('machine.gpsRemove')}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                loading={geo.loading || geocoding}
                onClick={() => void handleGps()}
                icon={<LocateFixed className="size-4" aria-hidden="true" />}
              >
                {geo.loading || geocoding ? t('farmer.locationFinding') : t('machine.useGps')}
              </Button>
            )}

            {gpsMessage ? (
              <Alert
                variant={gpsMessage === 'added' ? 'success' : 'warning'}
                className="mt-3"
              >
                {gpsMessage === 'added' ? t('machine.gpsAdded') : t('machine.gpsDenied')}
              </Alert>
            ) : null}
          </div>
        </Card>

        {formError ? <Alert variant="error">{t(formError)}</Alert> : null}

        <Button type="submit" size="lg" fullWidth loading={saving}>
          {saving ? t('machine.saving') : t('machine.saveMachine')}
        </Button>

        {isEdit ? (
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              className="border-clay-300 text-clay-800 hover:bg-clay-50"
              icon={<Trash2 className="size-4 text-clay-700" aria-hidden="true" />}
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving || deleting}
            >
              {t('owner.deleteMachine')}
            </Button>
          </div>
        ) : null}

        <ConfirmDialog
          open={deleteConfirmOpen}
          onClose={() => (deleting ? undefined : setDeleteConfirmOpen(false))}
          onConfirm={() => void handleDelete()}
          title={t('owner.deleteConfirmTitle')}
          description={t('owner.deleteConfirmBody')}
          confirmLabel={t('owner.deleteMachine')}
          cancelLabel={t('common.cancel')}
          danger
          loading={deleting}
        />
      </form>
    </div>
  )
}

function toMachineInput(parsed: MachineFormParsed, coordinates: Coordinates | null): MachineInput {
  return {
    machine_type: parsed.machineType as MachineType,
    model: parsed.model,
    price_per_acre: parsed.pricePerAcre,
    pricing_unit: parsed.pricingUnit,
    crops: parsed.crops as CropKey[],
    phone: parsed.phone,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    locations: parsed.locations,
  }
}
