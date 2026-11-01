import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { toast } from '../../lib/toast'
import type { ToastItem, ToastType } from '../../lib/toast'

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-leaf-700 ring-1 ring-leaf-300/60">
      <CheckCircle2 className="size-4.5 stroke-[2.5]" aria-hidden="true" />
    </div>
  ),
  error: (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-clay-100 text-clay-700 ring-1 ring-clay-300/60">
      <XCircle className="size-4.5 stroke-[2.5]" aria-hidden="true" />
    </div>
  ),
  warning: (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-harvest-100 text-harvest-800 ring-1 ring-harvest-300/60">
      <AlertTriangle className="size-4.5 stroke-[2.5]" aria-hidden="true" />
    </div>
  ),
  info: (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cream-200 text-ink ring-1 ring-cream-300/60">
      <Info className="size-4.5 stroke-[2.5]" aria-hidden="true" />
    </div>
  ),
}

const STYLES: Record<ToastType, string> = {
  success: 'border-leaf-200/80 bg-white/92 text-leaf-950',
  error: 'border-clay-200/80 bg-white/92 text-clay-950',
  warning: 'border-harvest-200/80 bg-white/92 text-harvest-950',
  info: 'border-cream-300/80 bg-white/92 text-ink',
}

/**
 * Fixed top-centered banner overlay with Apple Dynamic Island physics.
 * Preserves the page layout entirely without shifting or rearranging content.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    return toast.subscribe(setToasts)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed left-1/2 top-4 z-[9999] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col items-center gap-2.5 sm:max-w-md"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role={item.type === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full items-center gap-3 rounded-2xl border p-3 shadow-[0_12px_36px_-6px_rgba(23,36,27,0.18)] backdrop-blur-xl ring-1 ring-black/[0.04] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:animate-[apple-spring-in_350ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none ${STYLES[item.type]}`}
        >
          {ICONS[item.type]}
          <div className="min-w-0 flex-1">
            {item.title ? (
              <p className="text-[11px] font-bold tracking-wider uppercase opacity-75">{item.title}</p>
            ) : null}
            <p className="text-sm font-semibold tracking-tight leading-snug">{item.message}</p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(item.id)}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-black/5 hover:text-ink active:scale-90 focus-visible:outline-2"
            aria-label="Dismiss notification"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
