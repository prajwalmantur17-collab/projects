import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Sprout, Tractor } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError } from '../../lib/errors'
import {
  MIN_PATTERN_DOTS,
  attemptsLeft,
  hasPattern,
  isPatternLockSupported,
  removePattern,
  verifyPattern,
} from '../../lib/patternLock'
import { toast } from '../../lib/toast'
import { setUserRole } from '../../services/profiles'
import type { UserRole } from '../../types'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { PatternPad } from '../security/PatternPad'
import type { PatternPadStatus } from '../security/PatternPad'

/**
 * Lets one account switch between Farmer and Owner mode.
 * If a pattern lock is on, the user draws it before the switch.
 */
export function ModeSwitchButton({
  variant = 'card',
  collapsed = false,
  onAfterSwitch,
}: {
  variant?: 'card' | 'sidebar' | 'menu-item'
  collapsed?: boolean
  onAfterSwitch?: () => void
}) {
  const { profile, refreshProfile, signOut } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const busyRef = useRef(false)
  const statusTimerRef = useRef<number | undefined>(undefined)

  const [open, setOpen] = useState(false)
  const [needsPattern, setNeedsPattern] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [padStatus, setPadStatus] = useState<PatternPadStatus>('idle')
  const [padMessage, setPadMessage] = useState<string | null>(null)

  const close = useCallback(() => {
    if (busyRef.current) return
    setOpen(false)
    setError(null)
    setPadMessage(null)
    setPadStatus('idle')
  }, [])

  if (!profile?.role) return null

  const userId = profile.id
  const target: UserRole = profile.role === 'owner' ? 'farmer' : 'owner'
  const currentLabel = t(profile.role === 'owner' ? 'role.owner' : 'role.farmer')
  const targetLabel = t(target === 'owner' ? 'role.owner' : 'role.farmer')
  const switchLabel = t('mode.switchTo', { role: targetLabel })

  const openDialog = () => {
    setError(null)
    setPadMessage(null)
    setPadStatus('idle')
    setNeedsPattern(isPatternLockSupported() && hasPattern(userId))
    setOpen(true)
  }

  const flashPad = (status: PatternPadStatus, text: string | null) => {
    setPadStatus(status)
    setPadMessage(text)
    window.clearTimeout(statusTimerRef.current)
    if (status !== 'idle') {
      statusTimerRef.current = window.setTimeout(() => setPadStatus('idle'), 700)
    }
  }

  const doSwitch = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setSwitching(true)
    setError(null)
    try {
      await setUserRole(target)
      const updated = await refreshProfile()
      // setUserRole can fall back silently, so confirm with the server's copy.
      if (updated?.role !== target) {
        setError('mode.error')
        return
      }
      toast.success(t('mode.switched', { role: targetLabel }))
      busyRef.current = false
      setSwitching(false)
      setOpen(false)
      onAfterSwitch?.()
      navigate(target === 'owner' ? '/owner' : '/farmer', { replace: true })
    } catch (caught) {
      logError('mode.switch', caught)
      setError('mode.error')
    } finally {
      busyRef.current = false
      setSwitching(false)
    }
  }

  const handlePattern = async (pattern: number[]) => {
    if (busyRef.current) return
    if (pattern.length < MIN_PATTERN_DOTS) {
      flashPad('error', t('pattern.tooShort'))
      return
    }
    try {
      const result = await verifyPattern(userId, pattern)
      if (result === 'ok') {
        flashPad('success', null)
        await doSwitch()
        return
      }
      if (result === 'locked_out') {
        flashPad('error', t('pattern.tooMany'))
        try {
          await signOut()
        } catch (caught) {
          logError('pattern.signOut', caught)
        }
        removePattern(userId)
        navigate('/login', { replace: true })
        return
      }
      flashPad('error', t('pattern.wrong', { count: attemptsLeft(userId) }))
    } catch (caught) {
      logError('mode.pattern', caught)
      flashPad('error', t('error.generic'))
    }
  }

  return (
    <>
      {variant === 'sidebar' ? (
        collapsed ? (
          <div className="relative group flex justify-center">
            <button
              type="button"
              onClick={openDialog}
              title={switchLabel}
              className="flex size-11 items-center justify-center rounded-2xl bg-[#143d26] border border-[#235338] text-white hover:bg-[#1a4d30] hover:scale-105 transition-all shadow-md active:scale-95 cursor-pointer"
              aria-label={switchLabel}
            >
              <ArrowLeftRight className="size-5 text-[#E8B84A]" aria-hidden="true" />
            </button>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden rounded-md bg-[#0a180f] px-2.5 py-1 text-xs font-semibold text-white shadow-xl ring-1 ring-[#234D2C] whitespace-nowrap group-hover:lg:block"
            >
              {switchLabel}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#214f32] bg-gradient-to-br from-[#103520] to-[#0a2215] p-3 text-white shadow-md">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex size-7 items-center justify-center rounded-xl bg-emerald-500/20 text-[#8BCB73] ring-1 ring-emerald-500/30 shrink-0">
                  {profile.role === 'owner' ? (
                    <Tractor className="size-4 text-[#E8B84A]" aria-hidden="true" />
                  ) : (
                    <Sprout className="size-4 text-[#8BCB73]" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A9C7B6]">
                    {t('mode.current')}
                  </p>
                  <p className="truncate text-xs font-black text-white">
                    {currentLabel}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-600/50 px-2 py-0.5 text-[10px] font-bold text-[#8BCB73]">
                <span className="size-1.5 rounded-full bg-[#4ade80] animate-pulse" aria-hidden="true" />
                Active
              </span>
            </div>

            <button
              type="button"
              onClick={openDialog}
              className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#176B45] hover:bg-[#1a7a4f] text-white px-3 py-2 text-xs font-bold transition-all shadow-sm active:scale-98 border border-white/10 hover:border-white/20"
            >
              <ArrowLeftRight className="size-3.5 text-[#E8B84A] shrink-0" aria-hidden="true" />
              <span className="truncate">{switchLabel}</span>
            </button>
          </div>
        )
      ) : variant === 'menu-item' ? (
        <button
          type="button"
          onClick={openDialog}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#c5d5c5] hover:bg-[#1c3f25] hover:text-white cursor-pointer"
        >
          <ArrowLeftRight className="size-3.5 text-[#8BCB73]" />
          <span>{switchLabel}</span>
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={openDialog}
          icon={<ArrowLeftRight className="size-4" aria-hidden="true" />}
        >
          {switchLabel}
        </Button>
      )}

      <Modal
        open={open}
        onClose={close}
        title={t('mode.confirmTitle', { role: targetLabel })}
        description={t('mode.confirmBody', { role: targetLabel })}
        size="sm"
        footer={
          needsPattern ? undefined : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={close} disabled={switching}>
                {t('common.cancel')}
              </Button>
              <Button type="button" loading={switching} onClick={() => void doSwitch()}>
                {t('mode.confirm')}
              </Button>
            </div>
          )
        }
      >
        {error ? (
          <Alert variant="error" className="mb-3">
            {t(error)}
          </Alert>
        ) : null}
        {needsPattern ? (
          <div className="flex flex-col items-center">
            <p className="mb-3 text-center text-sm font-semibold text-ink">
              {t('mode.drawToConfirm')}
            </p>
            <PatternPad
              onComplete={(pattern) => void handlePattern(pattern)}
              status={padStatus}
              disabled={switching}
            />
            <p role="alert" className="mt-3 min-h-5 text-center text-sm font-semibold text-clay-700">
              {padMessage}
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
