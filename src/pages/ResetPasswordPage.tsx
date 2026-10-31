import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, LinkIcon } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { homeForProfile } from '../auth/routing'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n'
import { logError, mapErrorToKey } from '../lib/errors'
import { LogoLockup } from '../components/brand/Logo'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { LoadingScreen } from '../components/ui/Feedback'
import { Input } from '../components/ui/Input'
import { LanguageSelector } from '../components/ui/LanguageSelector'

interface FieldErrors {
  password?: TranslationKey
  confirm?: TranslationKey
}

/**
 * Landing page for the password-reset email link. Supabase signs the user in
 * with a short-lived recovery session; this page lets them choose a new password.
 */
export function ResetPasswordPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { initializing, session, profile, updatePassword, signOut } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<TranslationKey | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setFormError(null)

    const nextErrors: FieldErrors = {}
    if (password.length < 6) nextErrors.password = 'auth.passwordShort'
    if (confirm !== password) nextErrors.confirm = 'auth.passwordMismatch'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSubmitting(true)
    try {
      await updatePassword(password)
      setPassword('')
      setConfirm('')
      setDone(true)
    } catch (caught) {
      logError('auth.updatePassword', caught)
      setFormError(mapErrorToKey(caught, 'auth.resetFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const goToLogin = async () => {
    try {
      await signOut()
    } catch (caught) {
      logError('auth.signOut', caught)
    }
    navigate('/login', { replace: true })
  }

  const goHome = () => {
    navigate(profile ? homeForProfile(profile) : '/select-role', { replace: true })
  }

  if (initializing) return <LoadingScreen message={t('app.loading')} />

  let content
  if (done) {
    content = (
      <div className="card-surface p-6 text-center sm:p-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-leaf-100 text-leaf-800">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">{t('auth.passwordUpdatedTitle')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {t('auth.passwordUpdatedBody')}
        </p>
        <Button fullWidth size="lg" className="mt-6" onClick={goHome}>
          {t('auth.continue')}
        </Button>
      </div>
    )
  } else if (!session) {
    content = (
      <div className="card-surface p-6 text-center sm:p-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-clay-50 text-clay-800">
          <LinkIcon className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">{t('auth.resetLinkInvalidTitle')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {t('auth.resetLinkInvalidBody')}
        </p>
        <Button
          fullWidth
          size="lg"
          className="mt-6"
          onClick={() => navigate('/login', { replace: true })}
        >
          {t('auth.backToSignIn')}
        </Button>
      </div>
    )
  } else {
    content = (
      <div className="card-surface p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t('auth.resetTitle')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t('auth.resetSubtitle')}</p>

        {formError ? (
          <Alert variant="error" className="mt-5">
            <p className="font-semibold">{t(formError)}</p>
          </Alert>
        ) : null}

        <form onSubmit={(event) => void onSubmit(event)} noValidate className="mt-5 space-y-4">
          <Input
            label={t('auth.newPassword')}
            hint={t('auth.passwordHint')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setErrors((previous) => ({ ...previous, password: undefined }))
            }}
            error={errors.password ? t(errors.password) : null}
            required
          />

          <Input
            label={t('auth.confirmPassword')}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value)
              setErrors((previous) => ({ ...previous, confirm: undefined }))
            }}
            error={errors.confirm ? t(errors.confirm) : null}
            required
          />

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {submitting ? t('auth.updatingPassword') : t('auth.updatePassword')}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm">
          <button
            type="button"
            className="font-bold text-leaf-700 hover:underline"
            onClick={() => void goToLogin()}
          >
            {t('auth.backToSignIn')}
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-cream-50 px-4 py-5 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-md flex-col">
        <header className="flex items-center justify-between gap-3">
          <LogoLockup markClassName="size-10" />
          <LanguageSelector />
        </header>

        <main className="flex flex-1 items-center justify-center py-8">
          <div className="w-full">{content}</div>
        </main>

        <p className="pb-2 text-center text-sm text-ink-muted">{t('app.footer')}</p>
      </div>
    </div>
  )
}
