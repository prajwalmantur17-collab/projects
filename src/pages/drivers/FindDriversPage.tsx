import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { LocateFixed, Search, UserCog, Users } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { CROP_KEYS, MACHINE_TYPES, isCropKey, isMachineType } from '../../lib/constants'
import { cropLabelKey, machineTypeLabelKey } from '../../lib/labels'
import { normalizeWhitespace } from '../../lib/validation'
import { useAsync } from '../../hooks/useAsync'
import { reverseGeocode } from '../../services/geocode'
import { searchDrivers } from '../../services/drivers'
import type { DriverSearchFilters } from '../../types'
import { DriverContact } from '../../components/drivers/DriverContact'
import { DriverSummary } from '../../components/drivers/DriverSummary'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { Input, Select } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'

const EXPERIENCE_OPTIONS = [0, 1, 3, 5, 10]

export function FindDriversPage() {
  const { profile } = useAuth()
  const { t, language } = useI18n()

  const [village, setVillage] = useState(profile?.village ?? '')
  const [district, setDistrict] = useState(profile?.district ?? '')
  const [state, setState] = useState(profile?.state ?? '')
  const [machineType, setMachineType] = useState('')
  const [crop, setCrop] = useState('')
  const [minExperience, setMinExperience] = useState('0')
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<TranslationKey | null>(null)

  const [applied, setApplied] = useState<DriverSearchFilters>(() => ({
    village: profile?.village ?? '',
    district: profile?.district ?? '',
    state: profile?.state ?? '',
  }))

  const loader = useCallback(() => searchDrivers(applied), [applied])
  const { data, loading, error, reload } = useAsync(loader, {
    fallback: 'drivers.find.error',
  })
  const drivers = data ?? []

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setApplied({
      village: normalizeWhitespace(village),
      district: normalizeWhitespace(district),
      state: normalizeWhitespace(state),
      machineType: isMachineType(machineType) ? machineType : '',
      crop: isCropKey(crop) ? crop : '',
      minExperience: Number(minExperience) || 0,
    })
  }

  const useMyLocation = () => {
    if (locating) return
    setLocationError(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('drivers.find.locationError')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void reverseGeocode(
          { latitude: position.coords.latitude, longitude: position.coords.longitude },
          language,
        )
          .then((place) => {
            if (!place) {
              setLocationError('drivers.find.locationError')
              return
            }
            setVillage(place.village)
            setDistrict(place.district)
            setState(place.state)
          })
          .catch(() => setLocationError('drivers.find.locationError'))
          .finally(() => setLocating(false))
      },
      () => {
        setLocationError('drivers.find.locationError')
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <div>
      <PageHeader
        title={t('drivers.find.title')}
        description={t('drivers.find.subtitle')}
        action={
          <LinkButton
            to="/driver"
            variant="outline"
            icon={<UserCog className="size-4" aria-hidden="true" />}
          >
            {t('drivers.find.becomeDriver')}
          </LinkButton>
        }
      />

      <Card className="mb-5 p-5">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input
              label={t('drivers.find.village')}
              hint={t('drivers.find.villageHint')}
              value={village}
              maxLength={80}
              onChange={(event) => {
                setVillage(event.target.value)
                setDistrict('')
                setState('')
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={useMyLocation}
              loading={locating}
              icon={<LocateFixed className="size-4" aria-hidden="true" />}
            >
              {locating ? t('drivers.find.locating') : t('drivers.find.useLocation')}
            </Button>
          </div>

          {locationError ? <Alert variant="warning">{t(locationError)}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label={t('drivers.find.machine')}
              value={machineType}
              onChange={(event) => setMachineType(event.target.value)}
            >
              <option value="">{t('drivers.find.anyMachine')}</option>
              {MACHINE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(machineTypeLabelKey(type))}
                </option>
              ))}
            </Select>
            <Select
              label={t('drivers.find.experience')}
              value={minExperience}
              onChange={(event) => setMinExperience(event.target.value)}
            >
              {EXPERIENCE_OPTIONS.map((years) => (
                <option key={years} value={String(years)}>
                  {years === 0
                    ? t('drivers.find.anyExperience')
                    : t('drivers.find.minYears', { n: years })}
                </option>
              ))}
            </Select>
            <Select
              label={t('drivers.find.crop')}
              value={crop}
              onChange={(event) => setCrop(event.target.value)}
            >
              <option value="">{t('drivers.find.anyCrop')}</option>
              {CROP_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(cropLabelKey(key))}
                </option>
              ))}
            </Select>
          </div>

          <Button
            type="submit"
            fullWidth
            icon={<Search className="size-4" aria-hidden="true" />}
          >
            {t('drivers.find.search')}
          </Button>
        </form>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10" aria-busy="true">
          <Spinner className="size-8" />
        </div>
      ) : error ? (
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(error)}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      ) : drivers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('drivers.find.emptyTitle')}
          description={t('drivers.find.emptyBody')}
        />
      ) : (
        <div>
          <p className="mb-3 text-sm font-semibold text-white/90 drop-shadow-xs" role="status">
            {t('drivers.find.results', { count: drivers.length })}
          </p>
          <div className="space-y-4">
            {drivers.map((driver) => (
              <Card key={driver.user_id} as="article" className="p-5">
                <DriverSummary driver={driver} />
                <div className="mt-4 space-y-3">
                  <DriverContact phone={driver.phone} />
                  <LinkButton to={`/drivers/${driver.user_id}`} fullWidth>
                    {t('drivers.card.view')}
                  </LinkButton>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
