import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  SkipForward,
  Volume2,
} from 'lucide-react'
import { useI18n } from '../../i18n'
import {
  cancelSpeech,
  hasVoiceFor,
  isListeningSupported,
  listenOnce,
  speak,
} from '../../lib/speech'
import type { ListenHandle, ListenResult } from '../../lib/speech'
import { parseDecision, parseYesNo } from '../../lib/voiceParse'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import type { VoiceStep } from './voiceSteps'

type Phase = 'speaking' | 'listening' | 'working' | 'done' | 'stopped'
type Signal = 'skip' | 'repeat'
type Heard = { kind: 'heard'; result: ListenResult } | { kind: 'signal'; signal: Signal }

const MAX_FAILURES = 3

interface VoiceFlowAssistantProps<V extends object> {
  open: boolean
  onClose: () => void
  title: string
  /** Spoken once before the first question. */
  intro?: string
  /** Snapshot taken when the assistant opens. Steps read and update their own copy of it. */
  initialValues?: V
  /** Builds the questions. Called once each time the assistant opens. */
  createSteps: (values: V) => VoiceStep[]
  /** When set, this is spoken and shown instead of starting the questions. */
  blockedMessage?: string
}

/**
 * Asks questions out loud, listens for the answer, and fills things in.
 * Works in English, Hindi and Kannada (the app language). Everything is also
 * shown on screen, and Repeat / Skip buttons work at any time.
 */
export function VoiceFlowAssistant<V extends object = Record<string, never>>({
  open,
  onClose,
  title,
  intro,
  initialValues,
  createSteps,
  blockedMessage,
}: VoiceFlowAssistantProps<V>) {
  const { t, language } = useI18n()
  const [phase, setPhase] = useState<Phase>('speaking')
  const [question, setQuestion] = useState('')
  const [heard, setHeard] = useState('')
  const [notice, setNotice] = useState('')
  const [noVoice, setNoVoice] = useState(false)

  // The conversation reads the newest props (steps close over fresh form state).
  const latest = useRef({ initialValues, createSteps, intro, blockedMessage, t, language })
  const control = useRef<((signal: Signal) => void) | null>(null)
  const listening = useRef<ListenHandle | null>(null)

  useEffect(() => {
    latest.current = { initialValues, createSteps, intro, blockedMessage, t, language }
  })

  useEffect(() => {
    if (!open) return
    const run = { cancelled: false }

    const say = async (text: string): Promise<Signal | null> => {
      setQuestion(text)
      setPhase('speaking')
      const interrupt = new Promise<Signal>((resolve) => {
        control.current = resolve
      })
      const signal = await Promise.race([
        speak(text, latest.current.language).then(() => null),
        interrupt,
      ])
      control.current = null
      if (signal) cancelSpeech()
      return signal
    }

    const listen = async (): Promise<Heard> => {
      setPhase('listening')
      setHeard('')
      const handle = listenOnce(latest.current.language, (text) => setHeard(text))
      listening.current = handle
      const interrupt = new Promise<Heard>((resolve) => {
        control.current = (signal) => resolve({ kind: 'signal', signal })
      })
      const outcome = await Promise.race([
        handle.result.then((result): Heard => ({ kind: 'heard', result })),
        interrupt,
      ])
      control.current = null
      listening.current = null
      if (outcome.kind === 'signal') handle.cancel()
      return outcome
    }

    /** Stops the whole conversation for problems that retrying cannot fix. */
    const failHard = (result: ListenResult): boolean => {
      if (result.ok) return false
      const { t: translate } = latest.current
      const message =
        result.error === 'denied'
          ? translate('vf.micDenied')
          : result.error === 'network'
            ? translate('vf.networkError')
            : result.error === 'unsupported'
              ? translate('vf.unsupported')
              : result.error === 'other'
                ? translate('vf.genericError')
                : null
      if (!message) return false
      setQuestion(message)
      setPhase('stopped')
      return true
    }

    const confirmAnswer = async (text: string): Promise<'yes' | 'no' | 'stop'> => {
      let prompt = text
      for (let attempt = 0; attempt < MAX_FAILURES; attempt++) {
        const signal = await say(prompt)
        if (run.cancelled) return 'stop'
        if (signal === 'skip') return 'no'
        if (signal === 'repeat') {
          attempt -= 1
          continue
        }
        const outcome = await listen()
        if (run.cancelled) return 'stop'
        if (outcome.kind === 'signal') {
          if (outcome.signal === 'skip') return 'no'
          attempt -= 1
          continue
        }
        if (failHard(outcome.result)) return 'stop'
        if (outcome.result.ok) {
          const answer = outcome.result.alternatives.map(parseYesNo).find((value) => value !== null)
          if (answer === 'yes') return 'yes'
          if (answer === 'no') return 'no'
          setHeard(outcome.result.alternatives[0] ?? '')
        }
        prompt = latest.current.t('vf.yesNoRetry')
      }
      return 'no'
    }

    const runStep = async (step: VoiceStep): Promise<'next' | 'stop'> => {
      const base = () => (typeof step.prompt === 'function' ? step.prompt() : step.prompt)

      if (step.kind === 'say') {
        await say(base())
        return run.cancelled ? 'stop' : 'next'
      }

      let failures = 0
      let prompt = base()
      while (!run.cancelled) {
        const { t: translate } = latest.current

        const signal = await say(prompt)
        if (run.cancelled) return 'stop'
        if (signal === 'skip') return 'next'
        if (signal === 'repeat') {
          prompt = base()
          continue
        }

        const outcome = await listen()
        if (run.cancelled) return 'stop'
        if (outcome.kind === 'signal') {
          if (outcome.signal === 'skip') return 'next'
          prompt = base()
          continue
        }
        if (failHard(outcome.result)) return 'stop'

        if (!outcome.result.ok) {
          failures += 1
          if (failures >= MAX_FAILURES) {
            await say(translate('vf.tooManyTries'))
            return run.cancelled ? 'stop' : 'next'
          }
          const lead = translate(outcome.result.error === 'no-speech' ? 'vf.noSpeech' : 'vf.notUnderstood')
          prompt = `${lead} ${base()}`
          continue
        }

        const guesses = outcome.result.alternatives
        setHeard(guesses[0] ?? '')

        if (step.allowSkip !== false && guesses.some((guess) => parseDecision(guess) === 'skip')) {
          return 'next'
        }

        let accepted: { value: unknown } | null = null
        let failureMessage: string | undefined
        for (const guess of guesses) {
          const parsed = step.parse(guess)
          if (parsed.ok) {
            accepted = { value: parsed.value }
            break
          }
          if (failureMessage === undefined) failureMessage = parsed.message
        }

        if (!accepted) {
          failures += 1
          if (failures >= MAX_FAILURES) {
            await say(translate('vf.tooManyTries'))
            return run.cancelled ? 'stop' : 'next'
          }
          prompt = failureMessage ?? `${translate('vf.notUnderstood')} ${base()}`
          continue
        }

        if (step.confirmText) {
          const answer = await confirmAnswer(step.confirmText(accepted.value))
          if (answer === 'stop' || run.cancelled) return 'stop'
          if (answer === 'no') {
            prompt = `${translate('vf.confirmRetry')} ${base()}`
            continue
          }
        }

        setPhase('working')
        let reply: void | string
        try {
          reply = await step.apply(accepted.value)
        } catch {
          reply = translate('vf.genericError')
        }
        if (run.cancelled) return 'stop'

        const hasReply = typeof reply === 'string' && reply !== ''
        if (hasReply) setNotice(reply as string)
        const spoken = hasReply
          ? (reply as string)
          : step.describe
            ? translate('vf.gotIt', { value: step.describe(accepted.value) })
            : ''
        if (spoken) await say(spoken)
        return run.cancelled ? 'stop' : 'next'
      }
      return 'stop'
    }

    const runFlow = async () => {
      const { intro: opening, blockedMessage: blocked, t: translate } = latest.current
      setNotice('')
      setHeard('')
      setNoVoice(false)

      if (!isListeningSupported()) {
        setQuestion(translate('vf.unsupported'))
        setPhase('stopped')
        return
      }
      if (blocked) {
        setQuestion(blocked)
        setPhase('stopped')
        await speak(blocked, latest.current.language)
        return
      }
      if (!hasVoiceFor(latest.current.language)) setNoVoice(true)

      if (opening) {
        await say(opening)
        if (run.cancelled) return
      }

      const values = { ...(latest.current.initialValues ?? {}) } as V
      const steps = latest.current.createSteps(values)
      for (const step of steps) {
        if (step.when && !step.when()) continue
        const outcome = await runStep(step)
        if (outcome === 'stop' || run.cancelled) return
      }
      setQuestion('')
      setPhase('done')
    }

    void runFlow()

    return () => {
      run.cancelled = true
      cancelSpeech()
      listening.current?.cancel()
      listening.current = null
      control.current = null
    }
  }, [open])

  const active = phase === 'speaking' || phase === 'listening'
  const statusText =
    phase === 'speaking'
      ? t('vf.status.speaking')
      : phase === 'listening'
        ? t('vf.status.listening')
        : phase === 'working'
          ? t('vf.status.working')
          : phase === 'done'
            ? t('vf.status.done')
            : t('vf.status.stopped')

  const circleStyle =
    phase === 'listening'
      ? 'animate-pulse bg-clay-600 ring-8 ring-clay-200'
      : phase === 'stopped'
        ? 'bg-ink-soft'
        : 'bg-leaf-700'

  const mainText = phase === 'done' ? notice || t('vf.finished') : question

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="flex flex-col items-center text-center">
        <div
          className={`flex size-24 items-center justify-center rounded-full text-white shadow-lift ${circleStyle}`}
          aria-hidden="true"
        >
          {phase === 'listening' ? (
            <Mic className="size-10" />
          ) : phase === 'working' ? (
            <Loader2 className="size-10 animate-spin" />
          ) : phase === 'done' ? (
            <CheckCircle2 className="size-10" />
          ) : phase === 'stopped' ? (
            <MicOff className="size-10" />
          ) : (
            <Volume2 className="size-10" />
          )}
        </div>

        <p className="mt-3 text-sm font-bold text-leaf-800" role="status" aria-live="polite">
          {statusText}
        </p>

        {mainText ? (
          <p className="mt-4 text-xl font-bold leading-snug text-ink">{mainText}</p>
        ) : null}

        {heard && phase !== 'done' && phase !== 'stopped' ? (
          <p className="mt-3 rounded-xl bg-cream-100 px-3 py-2 text-sm text-ink-soft">
            {t('vf.heard', { text: heard })}
          </p>
        ) : null}

        {noVoice ? <p className="mt-3 text-xs text-ink-muted">{t('vf.noVoice')}</p> : null}

        <div className="mt-6 grid w-full grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!active}
            onClick={() => control.current?.('repeat')}
            icon={<RotateCcw className="size-4" aria-hidden="true" />}
          >
            {t('vf.repeat')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!active}
            onClick={() => control.current?.('skip')}
            icon={<SkipForward className="size-4" aria-hidden="true" />}
          >
            {t('vf.skip')}
          </Button>
        </div>
        <Button
          type="button"
          fullWidth
          className="mt-2"
          variant={phase === 'done' || phase === 'stopped' ? 'primary' : 'ghost'}
          onClick={onClose}
        >
          {t('vf.close')}
        </Button>
      </div>
    </Modal>
  )
}
