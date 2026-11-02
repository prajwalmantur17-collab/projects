import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

interface SidebarContextValue {
  collapsed: boolean
  setCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void
  toggleCollapsed: () => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  toggleMobile: () => void
  helpModalOpen: boolean
  setHelpModalOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

const STORAGE_KEY = 'harvest_rentals_sidebar_collapsed'

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) {
      return saved === 'true'
    }
    // Default to collapsed on tablet screens (768 to 1024), expanded on desktop
    return window.innerWidth >= 768 && window.innerWidth < 1024
  })

  const [mobileOpen, setMobileOpen] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)

  const setCollapsed = (val: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(next))
      }
      return next
    })
  }

  const toggleCollapsed = () => setCollapsed((prev) => !prev)
  const toggleMobile = () => setMobileOpen((prev) => !prev)

  // Close mobile drawer on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && mobileOpen) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mobileOpen])

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        setCollapsed,
        toggleCollapsed,
        mobileOpen,
        setMobileOpen,
        toggleMobile,
        helpModalOpen,
        setHelpModalOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return ctx
}
