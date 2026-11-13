import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import { logError } from '../../lib/errors'
import {
  MIN_PATTERN_DOTS,
  PATTERN_CHANGED_EVENT,
  RELOCK_AFTER_MS,
  attemptsLeft,
  hasPattern,
  isPatternLockSupported,
  isUnlocked,
  markLocked,
  markUnlocked,
  removePattern,
  verifyPattern,
} from '../../lib/patternLock'
import { PatternPad } from './PatternPad'
import type { PatternPadStatus } from './PatternPad'

/**
 * Full-screen lock shown when the signed-in user has a pattern on this device.
 * It opens once per browser tab and again after the app was in the background
 * for a few minutes. It is a quick unlock; the password is still the real login.
 */
export function PatternLockGate() {
  const { profile, session, signOut } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const statusTimerRef = useRef<number | undefined>(undefined)
  const userId = session && profile ? profile.id : null

  const [locked, setLocked] = useState(false)
  const [status, setStatus] = useState<PatternPadStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => {
      if (!userId || !isPatternLockSupported() || !hasPattern(userId)) {
        setLocked(false)
        return
      }
      setLocked(!isUnlocked(userId))
    }
    sync()
    window.addEventListener(PATTERN_CHANGED_EVENT, sync)
    return () => window.removeEventListener(PATTERN_CHANGED_EVENT, sync)
  }, [userId])

  // Lock again after the app was hidden for a while.
  useEffect(() => {
    if (!userId) return
    let hiddenAt: number | null = null
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt !== null && Date.now() - hiddenAt > RELOCK_AFTER_MS && hasPattern(userId)) {
        markLocked(userId)
        setLocked(true)
      }
      hiddenAt = null
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [userId])

  // While locked: block the app behind the lock and its scrolling.
  useEffect(() => {
    if (!locked) return
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      root?.removeAttribute('inert')
      document.body.style.overflow = previousOverflow
    }
  }, [locked])

  useEffect(() => () => window.clearTimeout(statusTimerRef.current), [])

  const flash = useCallback((next: PatternPadStatus, text: string | null) => {
    setStatus(next)
    setMessage(text)
    window.clearTimeout(statusTimerRef.current)
    if (next !== 'idle') {
      statusTimerRef.current = window.setTimeout(() => setStatus('idle'), 700)
    }
  }, [])

  const signInAgain = useCallback(
    async (id: string) => {
      try {
        await signOut()
      } catch (caught) {
        logError('pattern.signOut', caught)
      }
      removePattern(id)
      navigate('/login', { replace: true })
    },
    [signOut, navigate],
  )

  const handleComplete = useCallback(
    async (pattern: number[]) => {
      if (!userId || busyRef.current) return
      if (pattern.length < MIN_PATTERN_DOTS) {
        flash('error', t('pattern.tooShort'))
        return
      }
      busyRef.current = true
      try {
        const result = await verifyPattern(userId, pattern)
        if (result === 'ok') {
          markUnlocked(userId)
          flash('success', null)
          setLocked(false)
          return
        }
        if (result === 'locked_out') {
          flash('error', t('pattern.tooMany'))
          await signInAgain(userId)
          return
        }
        flash('error', t('pattern.wrong', { count: attemptsLeft(userId) }))
      } catch (caught) {
        logError('pattern.verify', caught)
        flash('error', t('error.generic'))
      } finally {
        busyRef.current = false
      }
    },
    [userId, flash, signInAgain, t],
  )

  if (!locked || !userId) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/95 p-4 backdrop-blur-md">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-lift outline-none"
      >
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-800">
          <Lock className="size-7" aria-hidden="true" />
        </span>
        <h2 id={titleId} className="mt-4 text-xl font-extrabold">
          {t('pattern.lockedTitle')}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{t('pattern.lockedBody')}</p>

        <div className="mt-5">
          <PatternPad onComplete={(pattern) => void handleComplete(pattern)} status={status} />
        </div>

        <p role="alert" className="mt-3 min-h-5 text-sm font-semibold text-clay-700">
          {message}
        </p>

        <button
          type="button"
          onClick={() => void signInAgain(userId)}
          className="mt-2 cursor-pointer text-sm font-bold text-leaf-800 underline underline-offset-2"
        >
          {t('pattern.forgot')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
