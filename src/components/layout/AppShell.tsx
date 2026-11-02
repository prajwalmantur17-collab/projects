import { Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { AppHeader } from './AppHeader'
import { LiveShareManager } from '../map/LiveShareManager'
import { ToastContainer } from '../ui/Toast'
import { BottomNav } from './BottomNav'

export function AppShell() {
  const { t } = useI18n()
  const location = useLocation()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-leaf-900 focus:shadow-lift"
      >
        {t('a11y.skip')}
      </a>
      <AppHeader />
      <LiveShareManager />
      <ToastContainer />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:pb-14">
        <div key={location.pathname} className="hr-route">
          <Outlet />
        </div>
      </main>
      <footer className="hidden border-t border-cream-200 px-6 py-6 text-center text-sm text-ink-muted lg:block">
        <p>
          {t('app.name')} · {t('app.footer')}
        </p>
      </footer>
      <BottomNav />
    </div>
  )
}
