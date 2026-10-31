import { useI18n } from '../i18n'
import { useAuth } from '../auth/AuthProvider'
import { homeForProfile } from '../auth/routing'
import { LogoLockup } from '../components/brand/Logo'
import { LinkButton } from '../components/ui/Button'

export function NotFoundPage() {
  const { t } = useI18n()
  const { profile, session } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream-50 px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <LogoLockup markClassName="size-12" textClassName="text-2xl" />
        </div>
        <div className="card-surface p-6 sm:p-8">
          <p className="text-6xl font-extrabold text-leaf-200">404</p>
          <h1 className="mt-2 text-2xl font-extrabold">{t('notFound.title')}</h1>
          <p className="mt-2 text-base leading-relaxed text-ink-muted">{t('notFound.body')}</p>
          <LinkButton
            to={session ? homeForProfile(profile) : '/login'}
            fullWidth
            className="mt-6"
          >
            {t('notFound.home')}
          </LinkButton>
        </div>
      </div>
    </div>
  )
}
