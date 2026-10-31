import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AuthProvider } from './auth/AuthProvider'
import { LanguageInitializer } from './auth/LanguageInitializer'
import { I18nProvider } from './i18n'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <AppErrorBoundary>
        <AuthProvider>
          <LanguageInitializer />
          <App />
        </AuthProvider>
      </AppErrorBoundary>
    </I18nProvider>
  </StrictMode>,
)
