import { useState } from 'react'
import type { FormEvent } from 'react'
import { Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n'
import { logError, mapErrorToKey } from '../lib/errors'
import { isValidEmail, normalizeWhitespace } from '../lib/validation'
import { LogoLockup } from '../components/brand/Logo'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LanguageSelector } from '../components/ui/LanguageSelector'

type Mode = 'signin' | 'signup' | 'forgot'

interface FieldErrors {
  name?: TranslationKey
  email?: TranslationKey
  password?: TranslationKey
}

export function LoginPage() {
  const { t } = useI18n()
  const { signInWithPassword, signUpWithPassword, requestPasswordReset } = useAuth()

  const [mode, setMode] = useState<Mode>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<TranslationKey | null>(null)
  const [noticeEmail, setNoticeEmail] = useState<string | null>(null)
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const switchMode = (next: Mode) => {
    if (submitting) return
    setMode(next)
    setErrors({})
    setFormError(null)
    setPassword('')
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return

    setFormError(null)
    const trimmedEmail = email.trim()
    const trimmedName = normalizeWhitespace(fullName)
    const nextErrors: FieldErrors = {}

    if (mode === 'signup' && trimmedName.length < 2) nextErrors.name = 'auth.nameRequired'
    if (!isValidEmail(trimmedEmail)) nextErrors.email = 'auth.emailInvalid'
    if (mode !== 'forgot' && password.length < 6) nextErrors.password = 'auth.passwordShort'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSubmitting(true)
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(trimmedEmail)
        setResetSentTo(trimmedEmail)
      } else if (mode === 'signin') {
        await signInWithPassword(trimmedEmail, password)
      } else {
        const result = await signUpWithPassword(trimmedEmail, password, trimmedName)
        if (result.needsEmailConfirmation) {
          setNoticeEmail(trimmedEmail)
          setPassword('')
        }
      }
    } catch (caught) {
      logError('login.submit', caught)
      setFormError(mapErrorToKey(caught, mode === 'forgot' ? 'auth.resetFailed' : 'auth.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const resetToSignIn = () => {
    setNoticeEmail(null)
    setResetSentTo(null)
    setMode('signin')
    setPassword('')
    setErrors({})
    setFormError(null)
  }

  return (
    <div className="min-h-dvh bg-cream-50 px-4 py-5 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-md flex-col">
        <header className="flex items-center justify-between gap-3">
          <LogoLockup markClassName="size-10" />
          <LanguageSelector />
        </header>

        <main className="flex flex-1 items-center justify-center py-8">
          <div className="w-full">
            {noticeEmail || resetSentTo ? (
              <div className="card-surface p-6 text-center sm:p-8">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-leaf-100 text-leaf-800">
                  <Mail className="size-7" aria-hidden="true" />
                </span>
                <h1 className="mt-4 text-2xl font-extrabold">{t('auth.checkEmailTitle')}</h1>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {t(resetSentTo ? 'auth.resetSentBody' : 'auth.checkEmailBody', {
                    email: resetSentTo ?? noticeEmail ?? '',
                  })}
                </p>
                <Button fullWidth size="lg" className="mt-6" onClick={resetToSignIn}>
                  {t('auth.backToSignIn')}
                </Button>
              </div>
            ) : (
              <div className="card-surface p-6 sm:p-8">
                <h1 className="text-2xl font-extrabold sm:text-3xl">
                  {mode === 'signin'
                    ? t('auth.welcomeBack')
                    : mode === 'signup'
                      ? t('auth.createTitle')
                      : t('auth.forgotTitle')}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {mode === 'signin'
                    ? t('auth.signInSubtitle')
                    : mode === 'signup'
                      ? t('auth.createSubtitle')
                      : t('auth.forgotSubtitle')}
                </p>

                {formError ? (
                  <Alert variant="error" className="mt-5">
                    <p className="font-semibold">{t(formError)}</p>
                    <p className="mt-1 font-normal text-clay-800">{t('auth.errorNote')}</p>
                  </Alert>
                ) : null}

                <form onSubmit={(event) => void onSubmit(event)} noValidate className="mt-5 space-y-4">
                  {mode === 'signup' ? (
                    <Input
                      label={t('auth.name')}
                      placeholder={t('auth.namePlaceholder')}
                      value={fullName}
                      onChange={(event) => {
                        setFullName(event.target.value)
                        setErrors((previous) => ({ ...previous, name: undefined }))
                      }}
                      error={errors.name ? t(errors.name) : null}
                      autoComplete="name"
                      required
                    />
                  ) : null}

                  <Input
                    label={t('auth.email')}
                    placeholder={t('auth.emailPlaceholder')}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setErrors((previous) => ({ ...previous, email: undefined }))
                    }}
                    error={errors.email ? t(errors.email) : null}
                    required
                  />

                  {mode !== 'forgot' ? (
                    <div>
                      <Input
                        label={t('auth.password')}
                        hint={mode === 'signup' ? t('auth.passwordHint') : undefined}
                        type="password"
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value)
                          setErrors((previous) => ({ ...previous, password: undefined }))
                        }}
                        error={errors.password ? t(errors.password) : null}
                        required
                      />
                      {mode === 'signin' ? (
                        <div className="mt-2 text-right">
                          <button
                            type="button"
                            className="text-sm font-bold text-leaf-700 hover:underline"
                            onClick={() => switchMode('forgot')}
                          >
                            {t('auth.forgotPassword')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <Button type="submit" size="lg" fullWidth loading={submitting}>
                    {mode === 'forgot'
                      ? submitting
                        ? t('auth.sendingResetLink')
                        : t('auth.sendResetLink')
                      : submitting
                        ? mode === 'signin'
                          ? t('auth.signingIn')
                          : t('auth.creatingAccount')
                        : mode === 'signin'
                          ? t('auth.signIn')
                          : t('auth.createAccount')}
                  </Button>
                </form>

                <p className="mt-5 text-center text-sm text-ink-muted">
                  {mode === 'forgot'
                    ? null
                    : mode === 'signin'
                      ? t('auth.newHere')
                      : t('auth.haveAccount')}{' '}
                  <button
                    type="button"
                    className="font-bold text-leaf-700 hover:underline"
                    onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                  >
                    {mode === 'signin'
                      ? t('auth.createLink')
                      : mode === 'signup'
                        ? t('auth.signInLink')
                        : t('auth.backToSignIn')}
                  </button>
                </p>

                <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-cream-100 px-3.5 py-3 text-sm text-ink-soft">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-leaf-700" aria-hidden="true" />
                  <p className="leading-snug">{t('auth.secureNote')}</p>
                </div>

                <p className="mt-4 text-center text-xs font-medium text-ink-muted">
                  {t('auth.accountNote')}
                </p>
              </div>
            )}
          </div>
        </main>

        <p className="pb-2 text-center text-sm text-ink-muted">{t('app.footer')}</p>
      </div>
    </div>
  )
}
