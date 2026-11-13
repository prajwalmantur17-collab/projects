import { useCallback, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Users } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { CROP_KEYS, MACHINE_TYPES } from '../../lib/constants'
import { validateDriverForm } from '../../lib/driverValidation'
import type { DriverFormValues } from '../../lib/driverValidation'
import { logError, mapErrorToKey } from '../../lib/errors'
import { cropLabelKey, machineTypeLabelKey } from '../../lib/labels'
import { toast } from '../../lib/toast'
import type { FieldErrors } from '../../lib/validation'
import { useAsync } from '../../hooks/useAsync'
import {
  getMyDriverProfile,
  listDriverRequests,
  saveDriverProfile,
} from '../../services/drivers'
import type { DriverProfile } from '../../types'
import { DriverRequestCard } from '../../components/drivers/DriverRequestCard'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState, LoadingScreen, Spinner } from '../../components/ui/Feedback'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-cream-300 bg-white px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 accent-leaf-700"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm text-ink-muted">{hint}</span> : null}
      </span>
    </label>
  )
}

function ChipGroup({
  legend,
  error,
  children,
}: {
  legend: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error ? (
        <p className="text-sm font-medium text-clay-700" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center rounded-xl border-2 px-4 text-sm font-bold transition-colors ${
        active
          ? 'border-leaf-700 bg-leaf-700 text-cream-50'
          : 'border-cream-300 bg-white text-ink-soft hover:border-leaf-300'
      }`}
    >
      {children}
    </button>
  )
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function DriverProfileForm({
  initial,
  onSaved,
}: {
  initial: DriverProfile | null
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const { t } = useI18n()

  const [values, setValues] = useState<DriverFormValues>(() => ({
    experienceYears: initial ? String(initial.experience_years) : '',
    machineTypes: initial ? [...initial.machine_types] : [],
    crops: initial ? [...initial.crops] : [],
    village: initial?.village ?? profile?.village ?? '',
    district: initial?.district ?? profile?.district ?? '',
    state: initial?.state ?? profile?.state ?? '',
    phone: initial?.phone ?? '',
    rateAmount: initial?.rate_amount != null ? String(initial.rate_amount) : '',
    rateUnit: initial?.rate_unit ?? 'per_acre',
    bio: initial?.bio ?? '',
    isActive: initial?.is_active ?? true,
    isAvailable: initial?.is_available ?? true,
    phonePublic: initial?.phone_public ?? true,
  }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<TranslationKey | null>(null)

  const set = <K extends keyof DriverFormValues>(field: K, value: DriverFormValues[K]) =>
    setValues((current) => ({ ...current, [field]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setFormError(null)
    const { errors: found, parsed } = validateDriverForm(values)
    setErrors(found)
    if (!parsed) return

    setSaving(true)
    try {
      await saveDriverProfile(parsed)
      toast.success(t('drivers.profile.saved'))
      onSaved()
    } catch (caught) {
      logError('drivers.saveProfile', caught)
      const key = mapErrorToKey(caught, 'error.generic')
      setFormError(key)
      toast.error(t(key))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5 p-5 sm:p-6" noValidate>
      <Input
        label={t('drivers.profile.experience')}
        inputMode="numeric"
        maxLength={2}
        value={values.experienceYears}
        error={errors.experienceYears ? t(errors.experienceYears) : null}
        required
        onChange={(event) => set('experienceYears', event.target.value)}
      />

      <ChipGroup
        legend={t('drivers.profile.machines')}
        error={errors.machineTypes ? t(errors.machineTypes) : null}
      >
        {MACHINE_TYPES.map((type) => (
          <Chip
            key={type}
            active={values.machineTypes.includes(type)}
            onClick={() => set('machineTypes', toggle(values.machineTypes, type))}
          >
            {t(machineTypeLabelKey(type))}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup
        legend={t('drivers.profile.crops')}
        error={errors.crops ? t(errors.crops) : null}
      >
        {CROP_KEYS.map((key) => (
          <Chip
            key={key}
            active={values.crops.includes(key)}
            onClick={() => set('crops', toggle(values.crops, key))}
          >
            {t(cropLabelKey(key))}
          </Chip>
        ))}
      </ChipGroup>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label={t('drivers.profile.village')}
          value={values.village}
          error={errors.village ? t(errors.village) : null}
          required
          maxLength={80}
          onChange={(event) => set('village', event.target.value)}
        />
        <Input
          label={t('drivers.profile.district')}
          value={values.district}
          error={errors.district ? t(errors.district) : null}
          required
          maxLength={80}
          onChange={(event) => set('district', event.target.value)}
        />
        <Input
          label={t('drivers.profile.state')}
          value={values.state}
          error={errors.state ? t(errors.state) : null}
          required
          maxLength={80}
          onChange={(event) => set('state', event.target.value)}
        />
      </div>

      <Input
        label={t('drivers.profile.phone')}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={values.phone}
        error={errors.phone ? t(errors.phone) : null}
        required
        onChange={(event) => set('phone', event.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('drivers.profile.rate')}
          inputMode="decimal"
          value={values.rateAmount}
          error={errors.rateAmount ? t(errors.rateAmount) : null}
          onChange={(event) => set('rateAmount', event.target.value)}
        />
        <Select
          label={t('drivers.profile.rateUnit')}
          value={values.rateUnit}
          error={errors.rateUnit ? t(errors.rateUnit) : null}
          onChange={(event) => set('rateUnit', event.target.value)}
        >
          <option value="per_acre">{t('drivers.unit.per_acre')}</option>
          <option value="per_hour">{t('drivers.unit.per_hour')}</option>
          <option value="per_day">{t('drivers.unit.per_day')}</option>
        </Select>
      </div>

      <Textarea
        label={t('drivers.profile.bio')}
        hint={t('drivers.profile.bioHint')}
        value={values.bio}
        error={errors.bio ? t(errors.bio) : null}
        maxLength={300}
        onChange={(event) => set('bio', event.target.value)}
      />

      <p className="text-sm text-ink-muted">{t('drivers.profile.photoHint')}</p>

      <div className="space-y-2">
        <CheckRow
          checked={values.isActive}
          onChange={(value) => set('isActive', value)}
          label={t('drivers.profile.active')}
        />
        <CheckRow
          checked={values.isAvailable}
          onChange={(value) => set('isAvailable', value)}
          label={t('drivers.profile.available')}
        />
        <CheckRow
          checked={values.phonePublic}
          onChange={(value) => set('phonePublic', value)}
          label={t('drivers.profile.phonePublic')}
          hint={t('drivers.profile.phonePublicHint')}
        />
      </div>

      {formError ? <Alert variant="error">{t(formError)}</Alert> : null}

      <Button type="submit" fullWidth loading={saving}>
        {t('drivers.profile.save')}
      </Button>
    </form>
  )
}

/** Make or edit my driver profile, and answer hire requests sent to me. */
export function DriverProfilePage() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const userId = profile?.id

  const profileLoader = useCallback(async () => {
    if (!userId) return null
    return getMyDriverProfile(userId)
  }, [userId])
  const {
    data: myProfile,
    loading,
    error,
    reload,
  } = useAsync(profileLoader, { enabled: Boolean(userId), fallback: 'drivers.profile.loadError' })

  const requestsLoader = useCallback(() => listDriverRequests('driver'), [])
  const {
    data: incoming,
    loading: requestsLoading,
    error: requestsError,
    reload: reloadRequests,
  } = useAsync(requestsLoader, { fallback: 'drivers.req.loadError' })

  const [formVersion, setFormVersion] = useState(0)
  const handleSaved = () => {
    reload()
    setFormVersion((value) => value + 1)
  }

  if (loading && !myProfile) return <LoadingScreen message={t('app.loading')} />

  const requests = incoming ?? []

  return (
    <div>
      <PageHeader
        title={t('drivers.profile.title')}
        description={t('drivers.profile.subtitle')}
        action={
          <LinkButton to="/drivers" variant="outline">
            {t('drivers.find.title')}
          </LinkButton>
        }
      />

      {error ? (
        <Alert variant="error" className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(error)}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      ) : (
        <Card className="mb-6">
          <CardHeader
            title={t('drivers.profile.title')}
            action={
              myProfile ? (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                    myProfile.is_active
                      ? 'border-leaf-200 bg-leaf-50 text-leaf-800'
                      : 'border-cream-300 bg-cream-100 text-ink-muted'
                  }`}
                >
                  {myProfile.is_active ? t('drivers.profile.listed') : t('drivers.profile.hidden')}
                </span>
              ) : null
            }
          />
          <DriverProfileForm key={formVersion} initial={myProfile ?? null} onSaved={handleSaved} />
        </Card>
      )}

      <h2 className="mb-3 text-xl font-extrabold text-white drop-shadow-md">
        {t('drivers.incoming.title')}
      </h2>

      {requestsLoading && !incoming ? (
        <div className="flex justify-center py-8" aria-busy="true">
          <Spinner className="size-8" />
        </div>
      ) : requestsError ? (
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(requestsError)}</span>
            <Button size="sm" variant="outline" onClick={reloadRequests}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('drivers.incoming.emptyTitle')}
          description={t('drivers.incoming.emptyBody')}
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <DriverRequestCard
              key={request.id}
              request={request}
              mode="driver"
              onChanged={reloadRequests}
            />
          ))}
        </div>
      )}
    </div>
  )
}
