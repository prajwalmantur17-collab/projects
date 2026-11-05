/**
 * Client-side ElevenLabs Text-to-Speech service.
 * Handles server-side API requests (with the signed-in user's token), in-memory audio caching,
 * sentence chunking with next-chunk prefetch, and audio playback.
 */
import type { Language } from '../types'
import { supabase } from './supabase'

export interface ElevenLabsErrorResponse {
  error: string
  message: string
  language?: string
  model?: string
}

export type ElevenLabsFetchResult =
  | { ok: true; audioUrl: string; fromCache: boolean }
  | { ok: false; code: string; message: string; status?: number }

// In-memory audio URL cache: key is `${language}:${text}` -> blob object URL
const audioCache = new Map<string, string>()

// Every in-flight generation request, so stopping can abort all of them (including prefetches).
const inflight = new Set<AbortController>()
let activeAudio: HTMLAudioElement | null = null
// Settles the currently pending play promise as "cancelled" when playback is stopped.
let cancelActivePlay: (() => void) | null = null
// Bumped on every stop so a running chunk loop knows it has been cancelled.
let generation = 0

function getCacheKey(language: Language, text: string): string {
  return `${language}:${text.trim()}`
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {}
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

/**
 * Checks whether audio for this text and language is already cached in memory.
 */
export function hasCachedAudio(language: Language, text: string): boolean {
  return audioCache.has(getCacheKey(language, text))
}

/**
 * Clears in-memory audio cache and revokes all created object URLs.
 */
export function clearElevenLabsCache(): void {
  for (const url of audioCache.values()) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Ignore cleanup error
    }
  }
  audioCache.clear()
}

/** Stops only the audio that is playing now. Pending play promises resolve as cancelled. */
function stopCurrentAudio(): void {
  const cancel = cancelActivePlay
  cancelActivePlay = null

  if (activeAudio) {
    try {
      activeAudio.pause()
      activeAudio.currentTime = 0
      activeAudio.onplay = null
      activeAudio.onended = null
      activeAudio.onerror = null
    } catch {
      // Ignore pause errors
    }
    activeAudio = null
  }

  cancel?.()
}

/**
 * Immediately stops any playing ElevenLabs audio and aborts every in-flight speech generation
 * request. Anything waiting on playback resolves as cancelled instead of hanging.
 */
export function stopElevenLabsAudio(): void {
  generation += 1

  for (const controller of inflight) {
    try {
      controller.abort()
    } catch {
      // Ignore abort errors
    }
  }
  inflight.clear()

  stopCurrentAudio()
}

/**
 * Requests speech audio from the server-side /api/speech endpoint.
 * Returns a playable object URL (either from in-memory cache or freshly generated).
 * Does not interrupt audio that is already playing, so the next chunk can be prefetched.
 */
export async function fetchElevenLabsAudio(
  text: string,
  language: Language,
): Promise<ElevenLabsFetchResult> {
  const cleanText = text.trim()
  if (!cleanText) {
    return { ok: false, code: 'empty_text', message: 'No text provided for speech.' }
  }

  const cacheKey = getCacheKey(language, cleanText)
  const cachedUrl = audioCache.get(cacheKey)
  if (cachedUrl) {
    return { ok: true, audioUrl: cachedUrl, fromCache: true }
  }

  const controller = new AbortController()
  inflight.add(controller)

  try {
    const authHeaders = await getAuthHeaders()
    const response = await fetch('/api/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        text: cleanText,
        language,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      let code = 'request_failed'
      let message = `Server returned status ${response.status}`

      try {
        const errorJson = (await response.json()) as ElevenLabsErrorResponse
        if (errorJson.error) code = errorJson.error
        if (errorJson.message) message = errorJson.message
      } catch {
        // Fallback to default message
      }

      return {
        ok: false,
        code,
        message,
        status: response.status,
      }
    }

    const blob = await response.blob()
    const audioUrl = URL.createObjectURL(blob)

    // Save in in-memory cache to save ElevenLabs credits on replays
    audioCache.set(cacheKey, audioUrl)

    return {
      ok: true,
      audioUrl,
      fromCache: false,
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        code: 'cancelled',
        message: 'Speech generation was cancelled.',
      }
    }

    return {
      ok: false,
      code: 'network_error',
      message: err instanceof Error ? err.message : 'Network error while generating speech.',
    }
  } finally {
    inflight.delete(controller)
  }
}

export interface PlaySpeechCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onError?: (message: string) => void
}

export interface PlaySpeechResult {
  success: boolean
  error?: string
  /** True when playback was stopped by the user or by newer speech. */
  cancelled?: boolean
}

/**
 * Plays one audio URL. Resolves when it ends, fails, or is stopped (cancelled).
 */
export function playElevenLabsSpeech(
  audioUrl: string,
  callbacks?: PlaySpeechCallbacks,
): Promise<PlaySpeechResult> {
  stopCurrentAudio()

  return new Promise((resolve) => {
    let settled = false
    const settle = (result: PlaySpeechResult) => {
      if (settled) return
      settled = true
      if (cancelActivePlay === cancel) cancelActivePlay = null
      resolve(result)
    }
    const cancel = () => settle({ success: false, cancelled: true })

    try {
      const audio = new Audio(audioUrl)
      activeAudio = audio
      cancelActivePlay = cancel

      audio.onplay = () => {
        callbacks?.onStart?.()
      }

      audio.onended = () => {
        if (activeAudio === audio) activeAudio = null
        callbacks?.onEnd?.()
        settle({ success: true })
      }

      audio.onerror = () => {
        if (activeAudio === audio) activeAudio = null
        const errorMsg = 'Audio playback error.'
        callbacks?.onError?.(errorMsg)
        settle({ success: false, error: errorMsg })
      }

      audio.play().catch((err: unknown) => {
        if (settled) return
        if (activeAudio === audio) activeAudio = null
        const errorMsg = err instanceof Error ? err.message : 'Failed to play audio.'
        callbacks?.onError?.(errorMsg)
        settle({ success: false, error: errorMsg })
      })
    } catch (err: unknown) {
      activeAudio = null
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize audio.'
      callbacks?.onError?.(errorMsg)
      settle({ success: false, error: errorMsg })
    }
  })
}

// ---------------------------------------------------------------- sentence chunking

const MAX_CHUNK_CHARS = 200
const HARD_CHUNK_CHARS = 450 // the server accepts at most 500 characters per request

function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= HARD_CHUNK_CHARS) return [sentence]
  const parts: string[] = []
  let current = ''
  for (const word of sentence.split(/\s+/)) {
    if (current && current.length + 1 + word.length > HARD_CHUNK_CHARS) {
      parts.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) parts.push(current)
  return parts
}

/**
 * Splits text into speakable chunks on sentence ends (. ? ! and the Hindi danda).
 * The first sentence stands alone so speech starts quickly; the rest are grouped up to
 * about 200 characters to keep the number of requests low.
 */
export function splitIntoSpeechChunks(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []

  const sentences = (clean.match(/[^.?!।]+[.?!।]*\s*/g) ?? [clean])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .flatMap(splitLongSentence)

  if (sentences.length === 0) return []

  const chunks: string[] = [sentences[0]]
  let current = ''
  for (const sentence of sentences.slice(1)) {
    if (current && current.length + 1 + sentence.length > MAX_CHUNK_CHARS) {
      chunks.push(current)
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  if (current) chunks.push(current)
  return chunks
}

export type ElevenLabsSpeakResult =
  | { ok: true }
  | { ok: false; code: string; message: string }

/**
 * Speaks text chunk by chunk, in order. While one chunk plays, the next one is already
 * being generated. Resolves with code "cancelled" if stopped part way.
 */
export async function speakWithElevenLabs(
  text: string,
  language: Language,
  callbacks?: { onStart?: () => void; onEnd?: () => void },
): Promise<ElevenLabsSpeakResult> {
  const chunks = splitIntoSpeechChunks(text)
  if (chunks.length === 0) return { ok: true }

  stopElevenLabsAudio()
  const run = generation
  const cancelled: ElevenLabsSpeakResult = {
    ok: false,
    code: 'cancelled',
    message: 'Speech was cancelled.',
  }

  let pending: Promise<ElevenLabsFetchResult | null> = fetchElevenLabsAudio(chunks[0], language)

  for (let index = 0; index < chunks.length; index++) {
    const fetched = await pending
    if (run !== generation) return cancelled
    if (!fetched) return { ok: true }
    if (!fetched.ok) {
      if (fetched.code === 'cancelled') return cancelled
      return { ok: false, code: fetched.code, message: fetched.message }
    }

    // Start generating the next chunk while this one plays.
    pending =
      index + 1 < chunks.length
        ? fetchElevenLabsAudio(chunks[index + 1], language)
        : Promise.resolve(null)

    const played = await playElevenLabsSpeech(fetched.audioUrl, {
      onStart: index === 0 ? callbacks?.onStart : undefined,
    })
    if (played.cancelled || run !== generation) return cancelled
    if (!played.success) {
      return { ok: false, code: 'playback_error', message: played.error ?? 'Audio playback error.' }
    }
  }

  callbacks?.onEnd?.()
  return { ok: true }
}
