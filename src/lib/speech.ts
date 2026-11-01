/**
 * Listening and speaking helpers for the step-by-step voice assistant.
 * Works best in Google Chrome. Listening sends audio to the browser vendor's
 * speech service, so it needs an internet connection.
 */
import type { Language } from '../types'

export const SPEECH_LOCALES: Record<Language, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
}

interface RecognitionAlternative {
  transcript: string
}

interface RecognitionResultLike {
  readonly length: number
  readonly isFinal: boolean
  [index: number]: RecognitionAlternative
}

interface RecognitionEventLike {
  results: { readonly length: number; [index: number]: RecognitionResultLike }
}

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionCtor = new () => RecognitionLike

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

export function isListeningSupported(): boolean {
  return getRecognitionCtor() !== null
}

export type ListenError = 'unsupported' | 'denied' | 'network' | 'no-speech' | 'aborted' | 'other'

export type ListenResult =
  | { ok: true; alternatives: string[] }
  | { ok: false; error: ListenError }

export interface ListenHandle {
  result: Promise<ListenResult>
  cancel: () => void
}

const MAX_LISTEN_MS = 12000

/** Listens for one phrase. Resolves with up to 3 transcript guesses, best first. */
export function listenOnce(language: Language, onInterim?: (text: string) => void): ListenHandle {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    return {
      result: Promise.resolve<ListenResult>({ ok: false, error: 'unsupported' }),
      cancel: () => undefined,
    }
  }

  const recognition = new Ctor()
  recognition.lang = SPEECH_LOCALES[language]
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 3

  let cancelled = false
  let finalGuesses: string[] = []
  let lastInterim = ''
  let timer: number | undefined

  const result = new Promise<ListenResult>((resolve) => {
    let settled = false
    const finish = (value: ListenResult) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve(value)
    }

    recognition.onresult = (event) => {
      const latest = event.results[event.results.length - 1]
      if (!latest) return
      const guesses: string[] = []
      for (let index = 0; index < latest.length; index++) {
        const text = latest[index].transcript.trim()
        if (text) guesses.push(text)
      }
      if (latest.isFinal) {
        finalGuesses = guesses
      } else if (guesses[0]) {
        lastInterim = guesses[0]
        onInterim?.(guesses[0])
      }
    }

    recognition.onerror = (event) => {
      const code = event.error
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        finish({ ok: false, error: 'denied' })
      } else if (code === 'network') {
        finish({ ok: false, error: 'network' })
      } else if (code === 'no-speech') {
        finish({ ok: false, error: 'no-speech' })
      } else if (code === 'aborted') {
        finish({ ok: false, error: 'aborted' })
      } else {
        finish({ ok: false, error: 'other' })
      }
    }

    recognition.onend = () => {
      if (finalGuesses.length > 0) {
        finish({ ok: true, alternatives: finalGuesses })
      } else if (lastInterim) {
        finish({ ok: true, alternatives: [lastInterim] })
      } else {
        finish({ ok: false, error: cancelled ? 'aborted' : 'no-speech' })
      }
    }

    timer = window.setTimeout(() => {
      try {
        recognition.stop()
      } catch {
        // Already stopped.
      }
    }, MAX_LISTEN_MS)

    try {
      recognition.start()
    } catch {
      finish({ ok: false, error: 'other' })
    }
  })

  return {
    result,
    cancel: () => {
      cancelled = true
      try {
        recognition.abort()
      } catch {
        // Already stopped.
      }
    },
  }
}

// ---------------------------------------------------------------- speaking

function engine(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

function sameLocale(voiceLang: string, locale: string, exact: boolean): boolean {
  const a = voiceLang.toLowerCase().replace('_', '-')
  const b = locale.toLowerCase()
  return exact ? a === b : a.split('-')[0] === b.split('-')[0]
}

function pickVoice(locale: string): SpeechSynthesisVoice | null {
  const synth = engine()
  if (!synth) return null
  const voices = synth.getVoices()
  return (
    voices.find((voice) => sameLocale(voice.lang, locale, true)) ??
    voices.find((voice) => sameLocale(voice.lang, locale, false)) ??
    null
  )
}

/** False when the device has no voice for this language (text is still shown on screen). */
export function hasVoiceFor(language: Language): boolean {
  return pickVoice(SPEECH_LOCALES[language]) !== null
}

export function cancelSpeech() {
  engine()?.cancel()
}

/** Speaks text aloud. Always resolves, even if the device cannot speak. */
export function speak(text: string, language: Language): Promise<void> {
  const synth = engine()
  if (!synth || !text.trim()) return Promise.resolve()
  return new Promise<void>((resolve) => {
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = SPEECH_LOCALES[language]
    utterance.rate = 0.9
    const voice = pickVoice(SPEECH_LOCALES[language])
    if (voice) utterance.voice = voice

    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      window.clearTimeout(fallback)
      resolve()
    }
    // Some browsers never fire "end"; do not let the conversation hang.
    const fallback = window.setTimeout(done, Math.max(5000, text.length * 160))
    utterance.onend = done
    utterance.onerror = done
    synth.speak(utterance)
  })
}
