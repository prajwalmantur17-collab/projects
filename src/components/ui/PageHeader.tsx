import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useI18n } from '../../i18n'

export function PageHeader({
  title,
  description,
  backTo,
  backLabel,
  action,
}: {
  title: string
  description?: string
  backTo?: string
  backLabel?: string
  action?: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div className="mb-6">
      {backTo ? (
        <Link
          to={backTo}
          className="mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg pr-2 text-sm font-semibold text-leaf-700 hover:text-leaf-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backLabel ?? t('common.back')}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-1.5 text-base leading-relaxed text-ink-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  )
}
