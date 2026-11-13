import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight } from 'lucide-react'
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
}: {
  variant?: 'card' | 'sidebar'
  collapsed?: boolean
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
        <button
          type="button"
          onClick={openDialog}
          title={switchLabel}
          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#8BCB73] transition-colors hover:bg-[#133A26] hover:text-white ${
            collapsed ? 'lg:justify-center' : ''
          }`}
        >
          <ArrowLeftRight className="size-4 shrink-0" aria-hidden="true" />
          <span className={collapsed ? 'lg:hidden' : 'block'}>{switchLabel}</span>
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
