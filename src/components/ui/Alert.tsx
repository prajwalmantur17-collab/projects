import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

type AlertVariant = 'error' | 'success' | 'info' | 'warning'

const styles: Record<AlertVariant, { wrapper: string; icon: ReactNode }> = {
  error: {
    wrapper: 'border-clay-200 bg-clay-50 text-clay-900',
    icon: <XCircle className="size-5 shrink-0" aria-hidden="true" />,
  },
  success: {
    wrapper: 'border-leaf-200 bg-leaf-50 text-leaf-900',
    icon: <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />,
  },
  info: {
    wrapper: 'border-cream-300 bg-cream-100 text-ink',
    icon: <Info className="size-5 shrink-0" aria-hidden="true" />,
  },
  warning: {
    wrapper: 'border-harvest-200 bg-harvest-50 text-harvest-900',
    icon: <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />,
  },
}

export function Alert({
  variant = 'info',
  children,
  className = '',
}: {
  variant?: AlertVariant
  children: ReactNode
  className?: string
}) {
  const { wrapper, icon } = styles[variant]
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium leading-snug ${wrapper} ${className}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
