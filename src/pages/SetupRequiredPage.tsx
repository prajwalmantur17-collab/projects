import { useI18n } from '../i18n'
import { getEnvIssue } from '../lib/env'
import { LogoLockup } from '../components/brand/Logo'
import { Alert } from '../components/ui/Alert'

export function SetupRequiredPage() {
  const { t } = useI18n()
  const issue = getEnvIssue()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream-50 px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <LogoLockup markClassName="size-12" textClassName="text-2xl" />
        </div>
        <div className="card-surface p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">{t('setup.title')}</h1>
          <p className="mt-2 text-base leading-relaxed text-ink-muted">{t('setup.intro')}</p>

          {issue ? (
            <Alert variant="warning" className="mt-4">
              {t('setup.issue', { issue })}
            </Alert>
          ) : null}

          <ol className="mt-6 space-y-3">
            {[
              t('setup.step1'),
              t('setup.step2'),
              t('setup.step3'),
              t('setup.step4'),
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-sm font-bold text-leaf-800">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-base leading-snug text-ink-soft">{step}</span>
              </li>
            ))}
          </ol>

          <p className="mt-6 rounded-xl bg-cream-100 px-4 py-3 text-sm leading-relaxed text-ink-soft">
            {t('setup.docsEmail')}
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">
          {t('app.name')} · {t('app.footer')}
        </p>
      </div>
    </div>
  )
}
