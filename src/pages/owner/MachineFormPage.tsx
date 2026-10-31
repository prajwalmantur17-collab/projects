import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Check, CheckCircle2, LocateFixed, MapPin, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { CROP_KEYS, MACHINE_TYPES, MAX_VILLAGES } from '../../lib/constants'
import { logError, mapErrorToKey } from '../../lib/errors'
import { machineTypeLabelKey } from '../../lib/labels'
import { validateMachineForm } from '../../lib/validation'
import type { FieldErrors, MachineFormParsed } from '../../lib/validation'
import { useAsync } from '../../hooks/useAsync'
import { useGeolocation } from '../../hooks/useGeolocation'
import { reverseGeocode } from '../../services/geocode'
import {
  createMachine,
  deleteMachineImage,
  getMachineCard,
  getMachineLocations,
  updateMachine,
  uploadMachineImage,
} from '../../services/machines'
import type {
  Coordinates,
  CropKey,
  MachineCard,
  MachineInput,
  MachineLocation,
  MachineType,
} from '../../types'
import { ImageUpload } from '../../components/machine/ImageUpload'
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

interface EditData {
  machine: MachineCard | null
  locations: MachineLocation[]
}

export function MachineFormPage() {
  const { machineId } = useParams<{ machineId: string }>()
  const { profile } = useAuth()
  const ownerId = profile?.id ?? 'demo-owner'
  const { t, language } = useI18n()
  const isEdit = Boolean(machineId)

  const loader = useCallback(async (): Promise<EditData> => {
    if (!machineId || !ownerId) return { machine: null, locations: [] }
    const machine = await getMachineCard(machineId)
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

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const activeOwnerId = profile?.id ?? 'demo-owner'
    setFormError(null)

    const validation = validateMachineForm(form)
    if (!validation.parsed) {
      setErrors(validation.errors)
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
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
          return
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
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caught) {
      logError('machine.save', caught)
      if (uploadedPath) {
        void deleteMachineImage(uploadedPath, activeOwnerId).catch((deleteError) => {
          logError('machine.cleanupUpload', deleteError)
        })
      }
      setFormError(mapErrorToKey(caught, 'machine.saveError'))
    } finally {
      setSaving(false)
    }
  }

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
            <legend className="text-base font-semibold text-ink">
              {t('machine.cropsLabel')}
              <span className="ml-1 text-clay-600" aria-hidden="true">
                *
              </span>
            </legend>
            <p className="mt-0.5 text-sm text-ink-muted">{t('machine.cropsHint')}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {CROP_KEYS.map((crop) => {
                const active = form.crops.includes(crop)
                return (
                  <button
                    key={crop}
                    type="button"
                    onClick={() => toggleCrop(crop)}
                    aria-pressed={active}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-semibold transition-colors ${
                      active
                        ? 'border-leaf-600 bg-leaf-50 text-leaf-900'
                        : 'border-cream-300 bg-white text-ink-soft hover:border-leaf-300'
                    }`}
                  >
                    {active ? <Check className="size-4" aria-hidden="true" /> : null}
                    {t(`crop.${crop}`)}
                  </button>
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
