import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { TOUR_EVENT, isTourDone, markTourDone } from '../../lib/tour'
import { Button } from '../ui/Button'

interface TourStep {
  id: string
  /** CSS selectors; the first one that is visible on screen is highlighted. */
  targets: string[]
  titleKey: TranslationKey
  bodyKey: TranslationKey
  /** Show a centered card with no highlight. */
  center?: boolean
  /** Only for signed-in people. */
  auth?: boolean
  /** Only for people who are not signed in. */
  guestOnly?: boolean
  role?: 'farmer' | 'owner'
}

const STEPS: TourStep[] = [
  { id: 'welcome', targets: [], titleKey: 'tour.welcomeTitle', bodyKey: 'tour.welcomeBody', center: true },
  {
    id: 'search',
    targets: ['#search-input', 'header input[type="search"]'],
    titleKey: 'tour.searchTitle',
    bodyKey: 'tour.searchBody',
  },
  {
    id: 'crops',
    targets: ['#crop-selection-section'],
    titleKey: 'tour.cropsTitle',
    bodyKey: 'tour.cropsBody',
    role: 'farmer',
  },
  {
    id: 'menu',
    targets: ['header button.lg\\:hidden', 'aside nav'],
    titleKey: 'tour.menuTitle',
    bodyKey: 'tour.menuBody',
  },
  {
    id: 'bookings',
    targets: ['a[href="/farmer/bookings"]'],
    titleKey: 'tour.bookingsTitle',
    bodyKey: 'tour.bookingsBody',
    auth: true,
    role: 'farmer',
  },
  {
    id: 'ownerMachines',
    targets: ['a[href="/owner/machines"]'],
    titleKey: 'tour.ownerMachinesTitle',
    bodyKey: 'tour.ownerMachinesBody',
    auth: true,
    role: 'owner',
  },
  {
    id: 'ownerRequests',
    targets: ['a[href="/owner/bookings"]'],
    titleKey: 'tour.ownerRequestsTitle',
    bodyKey: 'tour.ownerRequestsBody',
    auth: true,
    role: 'owner',
  },
  {
    id: 'drivers',
    targets: ['a[href="/drivers"]'],
    titleKey: 'tour.driversTitle',
    bodyKey: 'tour.driversBody',
    auth: true,
  },
  {
    id: 'notifications',
    targets: ['a[href="/notifications"]'],
    titleKey: 'tour.notificationsTitle',
    bodyKey: 'tour.notificationsBody',
    auth: true,
  },
  {
    id: 'language',
    targets: ['[data-tour="language"]'],
    titleKey: 'tour.languageTitle',
    bodyKey: 'tour.languageBody',
  },
  {
    id: 'profile',
    targets: ['header a[href="/settings"]'],
    titleKey: 'tour.profileTitle',
    bodyKey: 'tour.profileBody',
    auth: true,
  },
  {
    id: 'login',
    targets: ['header a[href="/login"]'],
    titleKey: 'tour.loginTitle',
    bodyKey: 'tour.loginBody',
    guestOnly: true,
  },
  { id: 'done', targets: [], titleKey: 'tour.doneTitle', bodyKey: 'tour.doneBody', center: true },
]

const HOME_PATHS = ['/', '/farmer', '/owner']

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return false
  if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight) {
    return false
  }
  const style = window.getComputedStyle(el)
  return style.visibility !== 'hidden' && style.display !== 'none'
}

function findTarget(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    let found: NodeListOf<HTMLElement>
    try {
      found = document.querySelectorAll<HTMLElement>(selector)
    } catch {
      continue
    }
    for (const el of Array.from(found)) {
      if (isVisible(el)) return el
    }
  }
  return null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/** First-visit guide: dims the page and points at the main places to tap. */
export function AppTour() {
  const { session, initializing, profile } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const [steps, setSteps] = useState<TourStep[] | null>(null)
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const onHome = HOME_PATHS.includes(location.pathname)
  const isOwnerPage = location.pathname.startsWith('/owner')

  const start = useCallback(
    (owner: boolean) => {
      const available = STEPS.filter((step) => {
        if (step.auth && !session) return false
        if (step.guestOnly && session) return false
        if (step.role && step.role !== (owner ? 'owner' : 'farmer')) return false
        if (step.center) return true
        return findTarget(step.targets) !== null
      })
      // Too few visible places to point at: not worth showing.
      if (available.length < 4) {
        markTourDone()
        return
      }
      setIndex(0)
      setSteps(available)
    },
    [session],
  )

  const finish = useCallback(() => {
    markTourDone()
    setSteps(null)
    setBox(null)
  }, [])

  // First visit on a home screen.
  useEffect(() => {
    if (initializing || !onHome || steps || isTourDone()) return
    const timer = window.setTimeout(() => start(isOwnerPage), 1400)
    return () => window.clearTimeout(timer)
  }, [initializing, onHome, isOwnerPage, steps, start])

  // "Show guide" button in Settings.
  useEffect(() => {
    let timer: number | undefined
    const onStart = () => {
      const owner = profile?.role === 'owner'
      navigate(owner ? '/owner' : '/')
      timer = window.setTimeout(() => start(owner), 1200)
    }
    window.addEventListener(TOUR_EVENT, onStart)
    return () => {
      window.removeEventListener(TOUR_EVENT, onStart)
      if (timer) window.clearTimeout(timer)
    }
  }, [navigate, profile?.role, start])

  const current = steps ? steps[index] : null

  const measure = useCallback(() => {
    if (!current || current.center) {
      setBox(null)
      return
    }
    const el = findTarget(current.targets)
    if (!el) {
      setBox(null)
      return
    }
    const r = el.getBoundingClientRect()
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [current])

  useEffect(() => {
    if (!current) return
    if (!current.center) {
      const el = findTarget(current.targets)
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ block: 'center', inline: 'nearest' })
        }
      }
    }
    const frame = window.requestAnimationFrame(() => {
      measure()
      nextRef.current?.focus()
    })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [current, measure])

  useEffect(() => {
    if (!steps) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [steps, finish])

  if (!steps || !current) return null

  const total = steps.length
  const isLast = index === total - 1
  const vw = typeof window !== 'undefined' ? window.innerWidth : 360
  const vh = typeof window !== 'undefined' ? window.innerHeight : 640
  const cardWidth = Math.min(340, vw - 24)
  const cardHeight = 200

  let cardStyle: CSSProperties
  if (!box) {
    cardStyle = {
      width: cardWidth,
      left: (vw - cardWidth) / 2,
      top: '50%',
      transform: 'translateY(-50%)',
    }
  } else if (box.height > vh * 0.5 && box.left + box.width + cardWidth + 28 < vw) {
    // Tall target such as the sidebar: put the card beside it.
    cardStyle = {
      width: cardWidth,
      left: box.left + box.width + 16,
      top: clamp(box.top + 16, 12, vh - cardHeight - 12),
    }
  } else if (box.top + box.height + 14 + cardHeight < vh) {
    cardStyle = {
      width: cardWidth,
      left: clamp(box.left + box.width / 2 - cardWidth / 2, 12, vw - cardWidth - 12),
      top: box.top + box.height + 14,
    }
  } else if (box.top - 14 - cardHeight > 0) {
    cardStyle = {
      width: cardWidth,
      left: clamp(box.left + box.width / 2 - cardWidth / 2, 12, vw - cardWidth - 12),
      bottom: vh - box.top + 14,
    }
  } else {
    cardStyle = { width: cardWidth, left: (vw - cardWidth) / 2, bottom: 16 }
  }

  const pad = 6

  return (
    <div className="fixed inset-0 z-[3000]" role="dialog" aria-modal="true" aria-label={t('tour.dialogLabel')}>
      {/* Blocks taps on the page behind while the guide is open. */}
      <div className="absolute inset-0" aria-hidden="true" />

      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-2xl motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: box.top - pad,
            left: box.left - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            boxShadow: '0 0 0 3px #E8B84A, 0 0 0 9999px rgba(11, 43, 30, 0.72)',
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[rgba(11,43,30,0.72)]" aria-hidden="true" />
      )}

      <div
        className="absolute rounded-2xl border border-cream-200 bg-white p-4 shadow-2xl"
        style={cardStyle}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-leaf-700">
          {t('tour.progress', { current: index + 1, total })}
        </p>
        <h2 className="mt-1 text-lg font-extrabold text-ink">{t(current.titleKey)}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t(current.bodyKey)}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={finish}>
            {t('tour.skip')}
          </Button>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setIndex(index - 1)}>
                {t('tour.back')}
              </Button>
            ) : null}
            <button
              ref={nextRef}
              type="button"
              onClick={() => (isLast ? finish() : setIndex(index + 1))}
              className="inline-flex min-h-9 items-center justify-center rounded-xl bg-leaf-700 px-4 text-xs font-semibold text-white hover:bg-leaf-800 focus-visible:outline-2 focus-visible:outline-leaf-700"
            >
              {isLast ? t('tour.finish') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
