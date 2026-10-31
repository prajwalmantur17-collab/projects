import { useI18n } from '../../i18n'
import type { BookingStatus } from '../../types'
import {
  CheckCircle2,
  Clock3,
  XCircle,
  Ban,
} from 'lucide-react'

const styles: Record<BookingStatus, string> = {
  pending: 'bg-harvest-50 text-harvest-800 border-harvest-200',
  confirmed: 'bg-leaf-50 text-leaf-800 border-leaf-200',
  rejected: 'bg-clay-50 text-clay-800 border-clay-200',
  cancelled: 'bg-cream-100 text-ink-soft border-cream-300',
}

const icons = {
  pending: Clock3,
  confirmed: CheckCircle2,
  rejected: XCircle,
  cancelled: Ban,
}

export function StatusBadge({
  status,
  className = '',
}: {
  status: BookingStatus
  className?: string
}) {
  const { t } = useI18n()
  const Icon = icons[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${styles[status]} ${className}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {t(`booking.status.${status}`)}
    </span>
  )
}
