import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { CROP_KEYS } from '../../lib/constants'
import { validateHireForm } from '../../lib/driverValidation'
import type { HireFormValues } from '../../lib/driverValidation'
import { logError, mapErrorToKey } from '../../lib/errors'
import { cropLabelKey, machineTypeLabelKey } from '../../lib/labels'
import { toast } from '../../lib/toast'
import type { FieldErrors } from '../../lib/validation'
import { todayIsoInIndia } from '../../lib/validation'
import { useAsync } from '../../hooks/useAsync'
import { createDriverRequest, getDriver } from '../../services/drivers'
import { DriverContact } from '../../components/drivers/DriverContact'
import { DriverSummary } from '../../components/drivers/DriverSummary'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { LoadingScreen } from '../../components/ui/Feedback'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'

export function DriverDetailPage() {
  const { driverId = '' } = useParams()
  const { profile } = useAuth()
  const { t } = useI18n()

  const loader = useCallback(async () => (driverId ? getDriver(driverId) : null), [driverId])
  const { data: driver, loading, error, reload } = useAsync(loader, {
    fallback: 'drivers.error.notFound',
  })

  const [values, setValues] = useState<HireFormValues>({
    machineType: '',
    serviceDate: '',
    days: '1',
    village: profile?.village ?? '',
    crop: '',
    phone: '',
    notes: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<TranslationKey | null>(null)
  const [sent, setSent] = useState(false)

  const set = (field: keyof HireFormValues, value: string) =>
    setValues((current) => ({ ...current, [field]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!driver || submitting) return
    setFormError(null)
    const { errors: found, parsed } = validateHireForm(driver.user_id, values, {
      allowedMachines: driver.machine_types,
    })
    setErrors(found)
    if (!parsed) return

    setSubmitting(true)
    try {
      await createDriverRequest(parsed)
      setSent(true)
      toast.success(t('drivers.hire.sent'))
    } catch (caught) {
      logError('drivers.createRequest', caught)
      const key = mapErrorToKey(caught, 'error.generic')
      setFormError(key)
      toast.error(t(key))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingScreen message={t('app.loading')} />

  if (error || !driver) {
    return (
      <div>
        <PageHeader title={t('drivers.find.title')} backTo="/drivers" backLabel={t('drivers.detail.back')} />
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(error ?? 'drivers.detail.notFound')}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  const isOwnProfile = profile?.id === driver.user_id
  const canHire = driver.is_available && !isOwnProfile

  return (
    <div>
      <PageHeader
        title={driver.full_name}
        backTo="/drivers"
        backLabel={t('drivers.detail.back')}
      />

      <Card className="mb-5 p-5">
        <DriverSummary driver={driver} />
        {driver.bio ? <p className="mt-4 text-sm leading-relaxed text-ink">{driver.bio}</p> : null}
        <div className="mt-4">
          <DriverContact phone={driver.phone} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t('drivers.hire.title')} />
        <div className="p-5 sm:p-6">
          {isOwnProfile ? (
            <Alert variant="info">{t('drivers.hire.own')}</Alert>
          ) : !driver.is_available ? (
            <Alert variant="warning">{t('drivers.hire.unavailableNote')}</Alert>
          ) : sent ? (
            <div className="space-y-4">
              <Alert variant="success">{t('drivers.hire.sent')}</Alert>
              <LinkButton to="/drivers/requests" variant="primary" fullWidth>
                {t('drivers.hire.viewRequests')}
              </LinkButton>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
              <Select
                label={t('drivers.hire.machine')}
                value={values.machineType}
                error={errors.machineType ? t(errors.machineType) : null}
                disabled={!canHire}
                required
                onChange={(event) => set('machineType', event.target.value)}
              >
                <option value="">—</option>
                {driver.machine_types.map((type) => (
                  <option key={type} value={type}>
                    {t(machineTypeLabelKey(type))}
                  </option>
                ))}
              </Select>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t('drivers.hire.date')}
                  type="date"
                  min={todayIsoInIndia()}
                  value={values.serviceDate}
                  error={errors.serviceDate ? t(errors.serviceDate) : null}
                  required
                  onChange={(event) => set('serviceDate', event.target.value)}
                />
                <Input
                  label={t('drivers.hire.days')}
                  inputMode="numeric"
                  value={values.days}
                  error={errors.days ? t(errors.days) : null}
                  required
                  maxLength={2}
                  onChange={(event) => set('days', event.target.value)}
                />
              </div>

              <Input
                label={t('drivers.hire.village')}
                value={values.village}
                error={errors.village ? t(errors.village) : null}
                required
                maxLength={80}
                onChange={(event) => set('village', event.target.value)}
              />

              <Select
                label={t('drivers.hire.crop')}
                value={values.crop}
                error={errors.crop ? t(errors.crop) : null}
                onChange={(event) => set('crop', event.target.value)}
              >
                <option value="">{t('drivers.hire.noCrop')}</option>
                {CROP_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(cropLabelKey(key))}
                  </option>
                ))}
              </Select>

              <Input
                label={t('drivers.hire.phone')}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={values.phone}
                error={errors.phone ? t(errors.phone) : null}
                required
                onChange={(event) => set('phone', event.target.value)}
              />

              <Textarea
                label={t('drivers.hire.notes')}
                value={values.notes}
                error={errors.notes ? t(errors.notes) : null}
                maxLength={500}
                onChange={(event) => set('notes', event.target.value)}
              />

              {formError ? <Alert variant="error">{t(formError)}</Alert> : null}

              <Button type="submit" fullWidth loading={submitting} disabled={!canHire}>
                {t('drivers.hire.send')}
              </Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  )
}
