/**
 * Listening and speaking helpers for the step-by-step voice assistant
 * and multilingual machine speech using ElevenLabs Text-to-Speech API
 * with browser Web Speech API as fallback.
 */
import type { Language } from '../types'
import {
  fetchElevenLabsAudio,
  playElevenLabsSpeech,
  stopElevenLabsAudio,
} from './elevenLabsSpeech'

export const SPEECH_LOCALES: Record<Language, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
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

export function isSpeechSupported(): boolean {
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

export interface VoiceListenerOptions {
  language: Language
  onResult: (transcript: string) => void
  onError?: (error: string) => void
  onEnd?: () => void
  continuous?: boolean
}

export function startVoiceListening(options: VoiceListenerOptions): () => void {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    options.onError?.('speech-not-supported')
    return () => {}
  }

  const rec = new Ctor()
  rec.lang = SPEECH_LOCALES[options.language]
  rec.continuous = Boolean(options.continuous)
  rec.interimResults = false
  rec.maxAlternatives = 1

  rec.onresult = (event) => {
    const lastResult = event.results[event.results.length - 1]
    if (!lastResult || !lastResult.length) return
    const text = lastResult[0].transcript?.trim()
    if (text) {
      options.onResult(text)
    }
  }

  rec.onerror = (e) => {
    options.onError?.(e.error)
  }

  rec.onend = () => {
    options.onEnd?.()
  }

  try {
    rec.start()
  } catch (e) {
    console.warn('SpeechRecognition failed to start:', e)
    return () => {}
  }

  return () => {
    try {
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      rec.abort()
    } catch {
      // Ignore abort errors
    }
  }
}

// ---------------------------------------------------------------- speaking (ElevenLabs & Web Speech API)

function engine(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

/**
 * Returns available voices asynchronously, listening to the voiceschanged event
 * if voices have not loaded yet (common in Chrome, Safari, and mobile Android browsers).
 */
export function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = engine()
  if (!synth) return Promise.resolve([])

  const current = synth.getVoices()
  if (current && current.length > 0) {
    return Promise.resolve(current)
  }

  const activeSynth: SpeechSynthesis = synth
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      activeSynth.removeEventListener('voiceschanged', onVoicesChanged)
      resolve(activeSynth.getVoices())
    }, 450)

    function onVoicesChanged() {
      window.clearTimeout(timer)
      activeSynth.removeEventListener('voiceschanged', onVoicesChanged)
      resolve(activeSynth.getVoices())
    }

    activeSynth.addEventListener('voiceschanged', onVoicesChanged)
  })
}

/**
 * Selects the best matching browser voice for the selected language.
 * Prefers Indian English for English, and strictly matches Kannada, Hindi, and Tamil voices.
 * Crucially returns null for non-English languages if no compatible voice is installed,
 * ensuring the browser NEVER speaks Kannada or Hindi using an English voice.
 */
export function pickBestVoice(voices: SpeechSynthesisVoice[], language: Language): SpeechSynthesisVoice | null {
  const targetLocale = SPEECH_LOCALES[language].toLowerCase().replace('_', '-')
  const langPrefix = language.toLowerCase()

  // 1. Exact locale match (e.g. en-in, kn-in, hi-in, ta-in)
  const exact = voices.find((v) => {
    const l = v.lang.toLowerCase().replace('_', '-')
    return l === targetLocale || l === langPrefix
  })
  if (exact) return exact

  // 2. Language prefix match (e.g. kn, hi, ta)
  const langMatch = voices.find((v) => {
    const l = v.lang.toLowerCase().replace('_', '-')
    return l.startsWith(`${langPrefix}-`) || l.startsWith(`${langPrefix}_`) || l === langPrefix
  })
  if (langMatch) return langMatch

  // 3. Name-based heuristics for localized voices
  if (language === 'kn') {
    return (
      voices.find((v) => {
        const nameLower = v.name.toLowerCase()
        const langLower = v.lang.toLowerCase()
        return (
          nameLower.includes('kannada') ||
          v.name.includes('ಕನ್ನಡ') ||
          langLower.includes('kn-in') ||
          langLower.includes('kn_in')
        )
      }) ?? null
    )
  }
  if (language === 'hi') {
    return (
      voices.find((v) => {
        const nameLower = v.name.toLowerCase()
        return (
          nameLower.includes('hindi') ||
          v.name.includes('हिन्दी') ||
          v.name.includes('Kalpana') ||
          v.name.includes('Hemant')
        )
      }) ?? null
    )
  }
  if (language === 'ta') {
    return (
      voices.find((v) => {
        const nameLower = v.name.toLowerCase()
        return (
          nameLower.includes('tamil') ||
          v.name.includes('தமிழ்') ||
          v.name.includes('Valluvar')
        )
      }) ?? null
    )
  }

  // 4. For English: prefer Indian English voice names, otherwise any English voice
  if (language === 'en') {
    const indianEnglish = voices.find(
      (v) =>
        v.lang.toLowerCase().includes('en-in') ||
        v.name.toLowerCase().includes('india') ||
        v.name.includes('Ravi') ||
        v.name.includes('Heera') ||
        v.name.includes('Neerja') ||
        v.name.includes('Prabhat'),
    )
    if (indianEnglish) return indianEnglish

    const generalEnglish = voices.find((v) => v.lang.toLowerCase().startsWith('en'))
    if (generalEnglish) return generalEnglish
  }

  // Strictly return null for non-English languages if no compatible voice exists.
  return null
}

/**
 * Localized, farmer-friendly message shown when a device lacks TTS voice data for a language.
 */
export function getMissingVoiceMessage(language: Language): string {
  switch (language) {
    case 'kn':
      return 'ನಿಮ್ಮ ಸಾಧನದಲ್ಲಿ ಕನ್ನಡ ಧ್ವನಿ (TTS) ಲಭ್ಯವಿಲ್ಲ. ಸಾಧನದ ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಕನ್ನಡ ಧ್ವನಿಯನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ ಅಥವಾ Google Chrome ಬಳಸಿ.'
    case 'hi':
      return 'आपके डिवाइस पर हिंदी आवाज (TTS) उपलब्ध नहीं है। कृपया डिवाइस सेटिंग में हिंदी आवाज सक्षम करें या Google Chrome का उपयोग करें।'
    case 'ta':
      return 'உங்கள் சாதனத்தில் தமிழ் குரல் (TTS) கிடைக்கவில்லை. சாதன அமைப்புகளில் தமிழ் குரலைச் சேர்க்கவும் அல்லது Google Chrome ஐப் பயன்படுத்தவும்.'
    case 'en':
    default:
      return 'No English voice found on this device. Please check your browser speech settings.'
  }
}

/** Checks whether a matching voice is currently available on the device for this language. */
export async function hasVoiceFor(language: Language): Promise<boolean> {
  const voices = await getAvailableVoices()
  return pickBestVoice(voices, language) !== null
}

/** Immediately cancels any active browser speech synthesis or ElevenLabs playback. */
export function cancelSpeech(): void {
  stopElevenLabsAudio()
  engine()?.cancel()
}

export type SpeakStatus =
  | { success: true; provider?: 'elevenlabs' | 'browser' }
  | { success: false; reason: 'unsupported' | 'no-voice' | 'error' | 'cancelled'; message?: string }

export interface SpeakCallbacks {
  onGenerating?: () => void
  onStart?: () => void
  onEnd?: () => void
  onError?: (message: string) => void
}

/**
 * Fallback Web Speech API synthesis using browser's built-in window.speechSynthesis.
 */
export async function speakViaWebSpeech(
  cleanText: string,
  language: Language,
  callbacks?: SpeakCallbacks,
): Promise<SpeakStatus> {
  const synth = engine()
  if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') {
    const message = 'Your browser does not support speech synthesis. Please use Google Chrome or Microsoft Edge.'
    callbacks?.onError?.(message)
    return { success: false, reason: 'unsupported', message }
  }

  synth.cancel()

  const voices = await getAvailableVoices()
  const voice = pickBestVoice(voices, language)

  // Strict check: if Kannada, Hindi, or Tamil has no voice on this device, do not speak gibberish
  if (!voice && language !== 'en') {
    const message = getMissingVoiceMessage(language)
    callbacks?.onError?.(message)
    return { success: false, reason: 'no-voice', message }
  }

  return new Promise<SpeakStatus>((resolve) => {
    let finished = false
    const finish = (result: SpeakStatus) => {
      if (finished) return
      finished = true
      window.clearTimeout(safetyTimeout)
      callbacks?.onEnd?.()
      resolve(result)
    }

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = SPEECH_LOCALES[language]
    utterance.rate = 0.92 // Natural, understandable cadence for farmers
    utterance.pitch = 1.0

    if (voice) {
      utterance.voice = voice
    }

    utterance.onstart = () => {
      callbacks?.onStart?.()
    }

    utterance.onend = () => {
      finish({ success: true, provider: 'browser' })
    }

    utterance.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') {
        finish({ success: false, reason: 'cancelled' })
      } else {
        console.warn('SpeechSynthesis error:', e)
        finish({ success: false, reason: 'error', message: 'Speech playback failed.' })
      }
    }

    // Safety timeout prevents UI hanging if browser fails to trigger onend
    const safetyTimeout = window.setTimeout(
      () => finish({ success: true, provider: 'browser' }),
      Math.max(6000, cleanText.length * 150),
    )

    synth.speak(utterance)
  })
}

/**
 * Speaks translated text aloud in the user's active language.
 * Primary: Uses ElevenLabs realistic AI speech via serverless API.
 * Fallback: Automatically falls back to browser's built-in Web Speech API if ElevenLabs is
 * unconfigured, rate-limited, offline, or if the language is unsupported by the ElevenLabs model.
 */
export async function speakAloudWithFeedback(
  text: string,
  language: Language,
  callbacks?: SpeakCallbacks,
  options?: { disableElevenLabs?: boolean },
): Promise<SpeakStatus> {
  const cleanText = text.trim()
  if (!cleanText) {
    return { success: true }
  }

  cancelSpeech()

  // If ElevenLabs is enabled, attempt realistic voice generation first
  if (!options?.disableElevenLabs) {
    callbacks?.onGenerating?.()
    const fetchResult = await fetchElevenLabsAudio(cleanText, language)

    if (fetchResult.ok) {
      const playResult = await playElevenLabsSpeech(fetchResult.audioUrl, {
        onStart: callbacks?.onStart,
        onEnd: callbacks?.onEnd,
        onError: callbacks?.onError,
      })

      if (playResult.success) {
        return { success: true, provider: 'elevenlabs' }
      }
    } else if (fetchResult.code === 'cancelled') {
      return { success: false, reason: 'cancelled' }
    } else {
      // Log ElevenLabs fallback reason in development console
      if (import.meta.env?.DEV) {
        console.info(`[ElevenLabs] Falling back to Web Speech: ${fetchResult.message} (${fetchResult.code})`)
      }
    }
  }

  // Graceful fallback to browser's Web Speech API
  return speakViaWebSpeech(cleanText, language, callbacks)
}

/** Simple speech helper used across the application. Always resolves cleanly. */
export async function speak(text: string, language: Language): Promise<void> {
  await speakAloudWithFeedback(text, language)
}
