import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { useI18n } from '../i18n'
import { logError } from '../lib/errors'
import { LogoLockup } from './brand/Logo'
import { Button } from './ui/Button'

interface BoundaryProps {
  children: ReactNode
  renderFallback: (retry: () => void) => ReactNode
}

interface BoundaryState {
  hasError: boolean
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError('errorBoundary', { message: error.message, details: info.componentStack ?? '' })
  }

  render() {
    if (this.state.hasError) {
      return this.props.renderFallback(() => this.setState({ hasError: false }))
    }
    return this.props.children
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n()

  return (
    <Boundary
      renderFallback={(retry) => (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-cream-50 px-4 py-10">
          <div className="w-full max-w-md">
            <div className="mb-6 flex justify-center">
              <LogoLockup markClassName="size-12" textClassName="text-2xl" />
            </div>
            <div className="card-surface p-6 text-center sm:p-8">
              <h1 className="text-2xl font-extrabold">{t('errorBoundary.title')}</h1>
              <p className="mt-2 text-base leading-relaxed text-ink-muted">
                {t('errorBoundary.body')}
              </p>
              <Button
                className="mt-6"
                fullWidth
                onClick={() => {
                  retry()
                  window.location.reload()
                }}
                icon={<RefreshCw className="size-4" aria-hidden="true" />}
              >
                {t('common.retry')}
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </Boundary>
  )
}
