import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { toast } from '../../lib/toast'
import type { ToastItem, ToastType } from '../../lib/toast'

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="size-5 shrink-0 text-leaf-700" aria-hidden="true" />,
  error: <XCircle className="size-5 shrink-0 text-clay-600" aria-hidden="true" />,
  warning: <AlertTriangle className="size-5 shrink-0 text-harvest-600" aria-hidden="true" />,
  info: <Info className="size-5 shrink-0 text-ink-soft" aria-hidden="true" />,
}

const STYLES: Record<ToastType, string> = {
  success: 'border-leaf-300 bg-white/95 text-leaf-950 ring-1 ring-leaf-200/50',
  error: 'border-clay-300 bg-white/95 text-clay-950 ring-1 ring-clay-200/50',
  warning: 'border-harvest-300 bg-white/95 text-harvest-950 ring-1 ring-harvest-200/50',
  info: 'border-cream-300 bg-white/95 text-ink ring-1 ring-cream-200/50',
}

/**
 * Fixed overlay container for non-intrusive floating notifications.
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
      className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2.5 sm:w-96"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role={item.type === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-lift backdrop-blur-md transition-all duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-reduce:transition-none motion-reduce:transform-none ${STYLES[item.type]}`}
        >
          <div className="mt-0.5">{ICONS[item.type]}</div>
          <div className="min-w-0 flex-1">
            {item.title ? (
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">{item.title}</p>
            ) : null}
            <p className="text-sm font-semibold leading-snug">{item.message}</p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(item.id)}
            className="rounded-lg p-1 text-ink-muted transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-2"
            aria-label="Dismiss notification"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
