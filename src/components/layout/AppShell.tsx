import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { AppHeader } from './AppHeader'
import { Sidebar } from './Sidebar'
import { HelpSupportModal } from './HelpSupportModal'
import { SidebarProvider, useSidebar } from './SidebarContext'
import { LiveShareManager } from '../map/LiveShareManager'
import { ToastContainer } from '../ui/Toast'
import { BottomNav } from './BottomNav'
import { LoadingScreen } from '../ui/Feedback'

function AppShellContent() {
  const { t } = useI18n()
  const location = useLocation()
  const { collapsed } = useSidebar()

  return (
    <div className="min-h-dvh overflow-x-hidden relative bg-cream-50 text-ink selection:bg-leaf-700 selection:text-white">
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(1200px_circle_at_50%_0%,rgba(23,107,69,0.05)_0%,rgba(248,250,245,0)_100%)]"
        aria-hidden="true"
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2.5 focus:font-semibold focus:text-leaf-900 focus:shadow-lift focus:ring-2 focus:ring-leaf-700"
      >
        {t('a11y.skip')}
      </a>

      {/* Left Sidebar (fixed on desktop, off-canvas on mobile) */}
      <Sidebar />

      {/* Help & Support Modal */}
      <HelpSupportModal />

      <LiveShareManager />
      <ToastContainer />

      {/* Main Content Area (adjusts automatically to sidebar width) */}
      <div
        className={`relative z-1 flex min-h-dvh flex-col transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[260px]'
        }`}
      >
        <AppHeader />

        <main id="main-content" className="w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 pb-28 lg:pb-12">
          <div key={location.pathname} className="hr-route">
            <Suspense fallback={<LoadingScreen message={t('app.loading')} />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        <footer className="mt-auto px-6 py-5 text-center text-xs border-t border-cream-200 bg-white/70 backdrop-blur-md text-ink-muted">
          <p className="font-medium tracking-tight">
            {t('app.name')} · {t('app.footer')}
          </p>
        </footer>

        <BottomNav />
      </div>
    </div>
  )
}

export function AppShell() {
  return (
    <SidebarProvider>
      <AppShellContent />
    </SidebarProvider>
  )
}
