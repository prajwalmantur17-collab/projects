import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, LocateFixed, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n'
import { logError, mapErrorToKey } from '../lib/errors'
import { toast } from '../lib/toast'
import { validateProfileForm } from '../lib/validation'
import type { FieldErrors } from '../lib/validation'
import { useGeolocation } from '../hooks/useGeolocation'
import { reverseGeocode } from '../services/geocode'
import { updateProfile } from '../services/profiles'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Input } from '../components/ui/Input'
import { LanguageSelector } from '../components/ui/LanguageSelector'
import { PageHeader } from '../components/ui/PageHeader'
import { ProfilePhotoCard } from '../components/profile/ProfilePhotoCard'

export function SettingsPage() {
  const { profile, refreshProfile, signOut } = useAuth()
  const { t, language } = useI18n()
  const navigate = useNavigate()

  const [form, setForm] = useState(() => ({
    fullName: profile?.full_name ?? '',
    village: profile?.village ?? '',
    district: profile?.district ?? '',
    state: profile?.state ?? '',
  }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null)
  const [success, setSuccess] = useState<TranslationKey | null>(null)
  const [formError, setFormError] = useState<TranslationKey | null>(null)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<TranslationKey | null>(null)
  const geo = useGeolocation()

  const handleUseLocation = async () => {
    setDetectedLocation(null)
    setGeocoding(true)
    try {
      const coords = await geo.request()
      if (!coords) return
      const geocoded = await reverseGeocode(coords, language)
      if (geocoded) {
        if (geocoded.village) setField('village', geocoded.village)
        if (geocoded.district) setField('district', geocoded.district)
        if (geocoded.state) setField('state', geocoded.state)
        setDetectedLocation(`${geocoded.village}, ${geocoded.district}`)
      }
    } finally {
      setGeocoding(false)
    }
  }

  const setField = (key: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => {
      if (!(key in previous)) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile || saving) return
    setSuccess(null)
    setFormError(null)

    const validation = validateProfileForm(form)
    if (!validation.parsed) {
      setErrors(validation.errors)
      const firstErr = Object.values(validation.errors)[0]
      if (firstErr) toast.error(t(firstErr as TranslationKey))
      return
    }
    setErrors({})
    setSaving(true)
    try {
      await updateProfile(profile.id, {
        full_name: validation.parsed.fullName,
        village: validation.parsed.village,
        district: validation.parsed.district,
        state: validation.parsed.state,
      })
      await refreshProfile()
      setSuccess('settings.saved')
      toast.success(t('settings.saved'))
    } catch (caught) {
      logError('settings.updateProfile', caught)
      const key = mapErrorToKey(caught, 'settings.saveError')
      setFormError(key)
      toast.error(t(key))
    } finally {
      setSaving(false)
    }
  }

  const onLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError(null)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (caught) {
      logError('settings.signOut', caught)
      setLogoutError(mapErrorToKey(caught, 'error.generic'))
    } finally {
      setLoggingOut(false)
    }
  }

  const isFarmer = profile?.role === 'farmer'

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />

      {success ? (
        <Alert variant="success" className="mb-4">
          {t(success)}
        </Alert>
      ) : null}

      <ProfilePhotoCard />

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-leaf-100 text-leaf-800">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-extrabold">{t('settings.detailsTitle')}</h2>
        </div>

        <p className="mt-3 text-sm text-ink-muted">
          {t('settings.signedInAs', { name: profile?.full_name ?? '' })}
        </p>

        {formError ? (
          <Alert variant="error" className="mt-4">
            {t(formError)}
          </Alert>
        ) : null}

        <form onSubmit={(event) => void onSubmit(event)} noValidate className="mt-4 space-y-4">
          <Input
            label={t('settings.name')}
            value={form.fullName}
            onChange={(event) => setField('fullName', event.target.value)}
            error={errors.fullName ? t(errors.fullName) : null}
            required
            autoComplete="name"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <span className="text-sm font-bold text-ink">{t('settings.village')}</span>
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
          {detectedLocation ? (
            <Alert variant="success" className="py-2 text-xs">
              ✓ {t('farmer.locationDetected', {
                place: detectedLocation.split(',')[0].trim(),
                district: detectedLocation.split(',')[1]?.trim() || '',
              })}
            </Alert>
          ) : null}
          <Input
            label=""
            hint={t('settings.villageHint')}
            value={form.village}
            onChange={(event) => setField('village', event.target.value)}
            error={errors.village ? t(errors.village) : null}
            autoComplete="address-level2"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('settings.district')}
              value={form.district}
              onChange={(event) => setField('district', event.target.value)}
              error={errors.district ? t(errors.district) : null}
              autoComplete="address-level1"
            />
            <Input
              label={t('settings.state')}
              value={form.state}
              onChange={(event) => setField('state', event.target.value)}
              error={errors.state ? t(errors.state) : null}
              autoComplete="address-level1"
            />
          </div>
          <Button type="submit" loading={saving} fullWidth size="lg">
            {saving ? t('common.saving') : t('settings.save')}
          </Button>
        </form>

        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-leaf-600" aria-hidden="true" />
          {t('settings.noPhoneNote')}
        </p>
      </Card>

      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="text-lg font-bold">{t('settings.language')}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{t('settings.languageHint')}</p>
        <div className="mt-3">
          <LanguageSelector className="max-w-xs" />
        </div>
      </Card>

      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="text-lg font-bold">{t('settings.accountType')}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-leaf-50 px-3 py-1 text-sm font-bold text-leaf-900">
            {isFarmer ? t('settings.accountTypeFarmer') : t('settings.accountTypeOwner')}
          </span>
          <span className="text-sm text-ink-muted">
            {isFarmer ? t('settings.roleFarmerHelp') : t('settings.roleOwnerHelp')}
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-muted">{t('settings.accountLocked')}</p>
      </Card>

            <Card className="mt-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">{t('record.title')}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{t('record.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/record')}
            icon={<FileText className="size-4" aria-hidden="true" />}
          >
            {t('record.link')}
          </Button>
        </div>
      </Card>

      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="text-lg font-bold">{t('common.logout')}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{t('settings.emailNote')}</p>
        <Button
          variant="outline"
          className="mt-3 border-clay-300 text-clay-800 hover:bg-clay-50"
          onClick={() => {
            setLogoutError(null)
            setLogoutOpen(true)
          }}
          icon={<LogOut className="size-4" aria-hidden="true" />}
        >
          {t('settings.logout')}
        </Button>
      </Card>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => {
          if (loggingOut) return
          setLogoutOpen(false)
        }}
        onConfirm={() => void onLogout()}
        title={t('settings.logoutConfirmTitle')}
        description={t('settings.logoutConfirmBodyEmail')}
        confirmLabel={t('settings.logout')}
        cancelLabel={t('common.cancel')}
        danger
        loading={loggingOut}
      >
        {logoutError ? <Alert variant="error">{t(logoutError)}</Alert> : null}
      </ConfirmDialog>
    </div>
  )
}
