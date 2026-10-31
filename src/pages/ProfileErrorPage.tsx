import { LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n'
import { LogoLockup } from '../components/brand/Logo'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'

export function ProfileErrorPage() {
  const { t } = useI18n()
  const { profileError, refreshProfile, signOut } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <LogoLockup markClassName="size-12" textClassName="text-2xl" />
        </div>
        <div className="card-surface p-6 text-center sm:p-8">
          <h1 className="text-2xl font-extrabold">{t('error.profileLoad')}</h1>
          <Alert variant="error" className="mt-4 text-left">
            {t(profileError ?? 'error.generic')}
          </Alert>
          <div className="mt-6 space-y-2">
            <Button
              fullWidth
              onClick={() => void refreshProfile()}
              icon={<RefreshCw className="size-4" aria-hidden="true" />}
            >
              {t('common.retry')}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => void signOut()}
              icon={<LogOut className="size-4" aria-hidden="true" />}
            >
              {t('settings.logout')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
