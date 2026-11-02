import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sprout, Tractor } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n'
import { logError, mapErrorToKey } from '../lib/errors'
import { setUserRole } from '../services/profiles'
import type { UserRole } from '../types'
import { Alert } from '../components/ui/Alert'
export function RoleSelectionPage() {
  const { profile, refreshProfile } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState<UserRole | null>(null)
  const [error, setError] = useState<TranslationKey | null>(null)

  const choose = async (role: UserRole) => {
    if (submitting) return
    setSubmitting(role)
    setError(null)
    try {
      await setUserRole(role)
      const updated = await refreshProfile()
      navigate(updated?.role === 'owner' ? '/owner' : '/farmer', { replace: true })
    } catch (caught) {
      logError('role.select', caught)
      const key = mapErrorToKey(caught, 'role.error')
      if (key === 'booking.error.roleSet') {
        const updated = await refreshProfile()
        navigate(updated?.role === 'owner' ? '/owner' : '/farmer', { replace: true })
        return
      }
      setError(key)
      setSubmitting(null)
    }
  }

  const name = profile?.full_name?.trim() || t('role.welcome')

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-100 drop-shadow-sm">
          {t('role.welcome')}, {name}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-4xl">
          {t('role.title')}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-white/90 drop-shadow-sm">
          {t('role.subtitle')}
        </p>
      </div>

      {error ? (
        <Alert variant="error" className="mx-auto mt-6 max-w-2xl">
          {t(error)}
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5">
        <RoleCard
          icon={<Sprout className="size-10" aria-hidden="true" />}
          title={t('role.farmerTitle')}
          description={t('role.farmerDescription')}
          continueLabel={submitting === 'farmer' ? t('role.selecting') : t('role.continue')}
          disabled={Boolean(submitting)}
          loading={submitting === 'farmer'}
          onClick={() => void choose('farmer')}
          accent="leaf"
        />
        <RoleCard
          icon={<Tractor className="size-10" aria-hidden="true" />}
          title={t('role.ownerTitle')}
          description={t('role.ownerDescription')}
          continueLabel={submitting === 'owner' ? t('role.selecting') : t('role.continue')}
          disabled={Boolean(submitting)}
          loading={submitting === 'owner'}
          onClick={() => void choose('owner')}
          accent="harvest"
        />
      </div>

      <p className="mx-auto mt-6 max-w-xl text-center text-sm font-medium text-white/80 drop-shadow-xs">
        {t('role.lockedNote')}
      </p>
    </div>
  )
}

function RoleCard({
  icon,
  title,
  description,
  continueLabel,
  onClick,
  disabled,
  loading,
  accent,
}: {
  icon: ReactNode
  title: string
  description: string
  continueLabel: string
  onClick: () => void
  disabled: boolean
  loading: boolean
  accent: 'leaf' | 'harvest'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading || undefined}
      className="group flex min-h-64 w-full flex-col rounded-card border-2 border-cream-200 bg-white p-6 text-left shadow-soft transition-colors hover:border-leaf-300 hover:shadow-lift disabled:cursor-wait disabled:opacity-70 sm:min-h-72 sm:p-7"
    >
      <span
        className={`flex size-16 items-center justify-center rounded-2xl ${
          accent === 'leaf' ? 'bg-leaf-100 text-leaf-800' : 'bg-harvest-100 text-harvest-800'
        }`}
      >
        {icon}
      </span>
      <h2 className="mt-5 text-2xl font-extrabold leading-tight">{title}</h2>
      <p className="mt-2 flex-1 text-base leading-relaxed text-ink-muted">{description}</p>
      <span className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-leaf-700 px-4 text-base font-bold text-cream-50 group-hover:bg-leaf-800">
        {continueLabel}
        <ArrowRight className="size-5" aria-hidden="true" />
      </span>
    </button>
  )
}
