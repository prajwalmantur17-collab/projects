import { Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { AppHeader } from './AppHeader'
import { Sidebar } from './Sidebar'
import { HelpSupportModal } from './HelpSupportModal'
import { SidebarProvider, useSidebar } from './SidebarContext'
import { LiveShareManager } from '../map/LiveShareManager'
import { ToastContainer } from '../ui/Toast'
import { BottomNav } from './BottomNav'

function AppShellContent() {
  const { t } = useI18n()
  const location = useLocation()
  const { collapsed } = useSidebar()

  return (
    <div
      className="min-h-dvh bg-cover bg-center bg-fixed bg-no-repeat overflow-x-hidden relative text-ink selection:bg-leaf-600 selection:text-white"
      style={{
        backgroundImage: "url('/images/paddy-countryside.jpg')",
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-leaf-900 focus:shadow-lift"
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
        className={`flex min-h-dvh flex-col transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[260px]'
        }`}
      >
        <AppHeader />

        <main id="main-content" className="w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-8 pb-28 lg:pb-12">
          <div key={location.pathname} className="hr-route">
            <Outlet />
          </div>
        </main>

        <footer className="mt-auto border-t border-white/20 bg-black/40 backdrop-blur-md px-6 py-4 text-center text-xs text-white/90">
          <p>
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
