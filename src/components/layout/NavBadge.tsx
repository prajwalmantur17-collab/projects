import { useI18n } from '../../i18n'

/** Small red number shown on a nav item (for example waiting requests). */
export function NavBadge({ count, className = '' }: { count: number; className?: string }) {
  const { t } = useI18n()
  if (count <= 0) return null
  return (
    <span
      className={`flex min-w-5 items-center justify-center rounded-full bg-clay-600 px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white ${className}`}
      aria-label={t('nav.pendingCount', { count })}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
