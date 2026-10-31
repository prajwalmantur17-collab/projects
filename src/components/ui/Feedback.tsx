import { Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function Spinner({ className = 'size-6' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-leaf-700 ${className}`} aria-hidden="true" />
}

export function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <Spinner className="size-8" />
      <p className="text-base font-medium text-ink-muted">{message}</p>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-cream-300 bg-cream-50/60 px-6 py-12 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-leaf-100 text-leaf-700">
        <Icon className="size-7" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
