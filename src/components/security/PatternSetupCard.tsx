import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import { logError } from '../../lib/errors'
import {
  MIN_PATTERN_DOTS,
  PATTERN_CHANGED_EVENT,
  attemptsLeft,
  hasPattern,
  isPatternLockSupported,
  markUnlocked,
  removePattern,
  savePattern,
  verifyPattern,
} from '../../lib/patternLock'
import { toast } from '../../lib/toast'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'
import { PatternPad } from './PatternPad'
import type { PatternPadStatus } from './PatternPad'

type Action = 'set' | 'change' | 'remove'
type Step = 'verify' | 'draw' | 'confirm'

interface Flow {
  action: Action
  step: Step
  first?: number[]
}

/** Settings card to turn the pattern lock on, change it, or turn it off. */
export function PatternSetupCard() {
  const { profile, signOut } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const userId = profile?.id ?? null
  const supported = isPatternLockSupported()
  const busyRef = useRef(false)
  const statusTimerRef = useRef<number | undefined>(undefined)

  const [enabled, setEnabled] = useState(() => (userId ? hasPattern(userId) : false))
  const [flow, setFlow] = useState<Flow | null>(null)
  const [status, setStatus] = useState<PatternPadStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setEnabled(userId ? hasPattern(userId) : false)
    sync()
    window.addEventListener(PATTERN_CHANGED_EVENT, sync)
    return () => window.removeEventListener(PATTERN_CHANGED_EVENT, sync)
  }, [userId])

  useEffect(() => () => window.clearTimeout(statusTimerRef.current), [])

  const flash = useCallback((next: PatternPadStatus, text: string | null) => {
    setStatus(next)
    setMessage(text)
    window.clearTimeout(statusTimerRef.current)
    if (next !== 'idle') {
      statusTimerRef.current = window.setTimeout(() => setStatus('idle'), 700)
    }
  }, [])

  const closeFlow = useCallback(() => {
    setFlow(null)
    setMessage(null)
    setStatus('idle')
  }, [])

  const start = (action: Action) => {
    setMessage(null)
    setStatus('idle')
    setFlow({ action, step: action === 'set' ? 'draw' : 'verify' })
  }

  const handleComplete = async (pattern: number[]) => {
    if (!flow || !userId || busyRef.current) return
    if (pattern.length < MIN_PATTERN_DOTS) {
      flash('error', t('pattern.tooShort'))
      return
    }
    busyRef.current = true
    try {
      if (flow.step === 'verify') {
        const result = await verifyPattern(userId, pattern)
        if (result === 'ok') {
          if (flow.action === 'remove') {
            removePattern(userId)
            toast.success(t('pattern.removed'))
            closeFlow()
            return
          }
          flash('success', null)
          setFlow({ action: flow.action, step: 'draw' })
          return
        }
        if (result === 'locked_out') {
          flash('error', t('pattern.tooMany'))
          try {
            await signOut()
          } catch (caught) {
            logError('pattern.signOut', caught)
          }
          removePattern(userId)
          navigate('/login', { replace: true })
          return
        }
        flash('error', t('pattern.wrong', { count: attemptsLeft(userId) }))
        return
      }

      if (flow.step === 'draw') {
        flash('success', null)
        setFlow({ action: flow.action, step: 'confirm', first: pattern })
        return
      }

      // confirm step
      if (!flow.first || flow.first.join('') !== pattern.join('')) {
        flash('error', t('pattern.mismatch'))
        setFlow({ action: flow.action, step: 'draw' })
        return
      }
      await savePattern(userId, pattern)
      markUnlocked(userId)
      toast.success(t('pattern.saved'))
      closeFlow()
    } catch (caught) {
      logError('pattern.setup', caught)
      flash('error', t('pattern.saveError'))
    } finally {
      busyRef.current = false
    }
  }

  const prompt =
    flow?.step === 'verify'
      ? t('pattern.drawCurrent')
      : flow?.step === 'confirm'
        ? t('pattern.drawAgain')
        : t('pattern.drawNew')

  return (
    <Card className="mt-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-leaf-100 text-leaf-800">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold">{t('pattern.title')}</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            enabled ? 'bg-leaf-50 text-leaf-900' : 'bg-cream-100 text-ink-muted'
          }`}
        >
          {enabled ? t('pattern.on') : t('pattern.off')}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{t('pattern.subtitle')}</p>

      {supported ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {enabled ? (
            <>
              <Button type="button" variant="outline" onClick={() => start('change')}>
                {t('pattern.change')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-clay-300 text-clay-800 hover:bg-clay-50"
                onClick={() => start('remove')}
              >
                {t('pattern.remove')}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => start('set')}>
              {t('pattern.set')}
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">{t('pattern.unsupported')}</p>
      )}
      <p className="mt-2 text-xs text-ink-muted">{t('pattern.deviceNote')}</p>

      <Modal open={flow !== null} onClose={closeFlow} title={t('pattern.title')} description={prompt} size="sm">
        <div className="flex flex-col items-center">
          <PatternPad onComplete={(pattern) => void handleComplete(pattern)} status={status} />
          <p role="alert" className="mt-3 min-h-5 text-center text-sm font-semibold text-clay-700">
            {message}
          </p>
        </div>
      </Modal>
    </Card>
  )
}
