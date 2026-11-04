import type { IncomingMessage, ServerResponse } from 'node:http'

export type SupportedLanguage = 'en' | 'hi' | 'kn' | 'ta'

export const MAX_TEXT_LENGTH = 500

export const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'

/**
 * Known model language support matrix.
 * Eleven Multilingual v2, Eleven Turbo v2.5, Eleven Flash v2.5, Eleven v3, and Eleven v4
 * all support multilingual synthesis including English (en), Hindi (hi), Kannada (kn), and Tamil (ta).
 */
export const MODEL_SUPPORTED_LANGUAGES: Record<string, SupportedLanguage[]> = {
  eleven_multilingual_v2: ['en', 'hi', 'kn', 'ta'],
  eleven_turbo_v2_5: ['en', 'hi', 'kn', 'ta'],
  eleven_flash_v2_5: ['en', 'hi', 'kn', 'ta'],
  eleven_v3: ['en', 'hi', 'kn', 'ta'],
  eleven_v4: ['en', 'hi', 'kn', 'ta'],
}

/**
 * Standard ElevenLabs voice configuration:
 * - LHMvGhXWZPfzCiDpiEc1: Default voice
 */
export const DEFAULT_VOICES: Record<SupportedLanguage, string> = {
  en: 'LHMvGhXWZPfzCiDpiEc1',
  hi: 'LHMvGhXWZPfzCiDpiEc1',
  kn: 'LHMvGhXWZPfzCiDpiEc1',
  ta: 'LHMvGhXWZPfzCiDpiEc1',
}

export interface SpeechResolution {
  apiKey: string | null
  modelId: string
  voiceId: string
  isModelLanguageSupported: boolean
  language: SupportedLanguage
}

/**
 * Resolves the active model ID, voice ID, and language capability from environment variables
 * and defaults.
 */
export function resolveSpeechConfig(language: SupportedLanguage): SpeechResolution {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() || null
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID
  const genericVoice = process.env.ELEVENLABS_VOICE_ID?.trim()

  let voiceId = ''
  switch (language) {
    case 'en':
      voiceId = process.env.ELEVENLABS_VOICE_EN?.trim() || genericVoice || DEFAULT_VOICES.en
      break
    case 'hi':
      voiceId = process.env.ELEVENLABS_VOICE_HI?.trim() || genericVoice || DEFAULT_VOICES.hi
      break
    case 'ta':
      voiceId = process.env.ELEVENLABS_VOICE_TA?.trim() || genericVoice || DEFAULT_VOICES.ta
      break
    case 'kn':
      voiceId = process.env.ELEVENLABS_VOICE_KN?.trim() || genericVoice || DEFAULT_VOICES.kn
      break
  }

  const supportedLanguages = MODEL_SUPPORTED_LANGUAGES[modelId]
  const isModelLanguageSupported = supportedLanguages
    ? supportedLanguages.includes(language)
    : true

  return {
    apiKey,
    modelId,
    voiceId,
    isModelLanguageSupported,
    language,
  }
}

/**
 * CORS Origin Validation:
 * Uses ALLOWED_ORIGINS env variable (comma-separated), defaulting to production and local dev.
 */
export function isOriginAllowed(origin?: string | null): boolean {
  if (!origin) return false
  const defaultAllowed = ['https://harvestrent.vercel.app', 'http://localhost:5173']
  const envAllowed = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : []
  const allowed = new Set([...defaultAllowed, ...envAllowed])
  return allowed.has(origin)
}

/**
 * Extracts Client IP securely:
 * Prioritizes x-vercel-forwarded-for and x-real-ip, then takes the LAST trusted hop of x-forwarded-for.
 */
export function getClientIp(req: IncomingMessage): string {
  const vercelFwd = req.headers['x-vercel-forwarded-for']
  if (typeof vercelFwd === 'string' && vercelFwd.trim()) {
    return vercelFwd.split(',')[0].trim()
  }

  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim()
  }

  const fwdFor = req.headers['x-forwarded-for']
  if (typeof fwdFor === 'string' && fwdFor.trim()) {
    const hops = fwdFor.split(',').map((h) => h.trim()).filter(Boolean)
    if (hops.length > 0) {
      return hops[hops.length - 1]
    }
  }

  return req.socket?.remoteAddress || 'unknown'
}

interface SpeechRequestBody {
  text?: unknown
  language?: unknown
}

// In-memory rate limiter with periodic cleanup: max 20 req/min per IP, max 300 req/min global
const rateLimitMap = new Map<string, number[]>()
let globalTimestamps: number[] = []
let lastCleanup = Date.now()
const WINDOW_MS = 60_000
const MAX_PER_IP = 20
const MAX_GLOBAL_PER_MIN = 300

function cleanupOldRateLimits(now: number): void {
  if (now - lastCleanup < 60_000 && rateLimitMap.size < 500) return
  lastCleanup = now

  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((time) => now - time < WINDOW_MS)
    if (valid.length === 0) {
      rateLimitMap.delete(ip)
    } else {
      rateLimitMap.set(ip, valid)
    }
  }

  globalTimestamps = globalTimestamps.filter((time) => now - time < WINDOW_MS)
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  cleanupOldRateLimits(now)

  // 1. Check global rate limit cap
  globalTimestamps = globalTimestamps.filter((time) => now - time < WINDOW_MS)
  if (globalTimestamps.length >= MAX_GLOBAL_PER_MIN) {
    return false
  }

  // 2. Check per-IP limit
  const timestamps = rateLimitMap.get(ip) || []
  const validTimestamps = timestamps.filter((time) => now - time < WINDOW_MS)

  if (validTimestamps.length >= MAX_PER_IP) {
    return false
  }

  validTimestamps.push(now)
  rateLimitMap.set(ip, validTimestamps)
  globalTimestamps.push(now)
  return true
}

async function parseRequestBody(req: IncomingMessage & { body?: unknown }): Promise<SpeechRequestBody | null> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as SpeechRequestBody
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as SpeechRequestBody
    } catch {
      return null
    }
  }

  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8')) as SpeechRequestBody
    } catch {
      return null
    }
  }

  if (req.readableEnded) {
    return null
  }

  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 50_000) {
        req.destroy()
        resolve(null)
      }
    })
    req.on('end', () => {
      if (!raw) return resolve(null)
      try {
        const parsed = JSON.parse(raw) as SpeechRequestBody
        resolve(parsed)
      } catch {
        resolve(null)
      }
    })
    req.on('error', () => resolve(null))

    setTimeout(() => {
      if (!raw) resolve(null)
    }, 2000)
  })
}

function sendJson(res: ServerResponse, status: number, data: Record<string, unknown>): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(data))
}

/**
 * Vercel Serverless Function handler for ElevenLabs Text-to-Speech.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = (req.headers.origin as string) || ''
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed', message: 'Only POST requests are supported.' })
    return
  }

  // Validate Content-Type
  const contentType = (req.headers['content-type'] as string) || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    sendJson(res, 415, {
      error: 'unsupported_media_type',
      message: 'Content-Type must be application/json.',
    })
    return
  }

  // Rate limiting check
  const clientIp = getClientIp(req)
  if (!checkRateLimit(clientIp)) {
    sendJson(res, 429, {
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please wait a minute before requesting audio again.',
    })
    return
  }

  const body = await parseRequestBody(req)
  if (!body) {
    sendJson(res, 400, { error: 'invalid_json', message: 'Request body must be valid JSON.' })
    return
  }

  const { text, language } = body

  if (typeof text !== 'string' || !text.trim()) {
    sendJson(res, 400, { error: 'missing_text', message: 'Text string is required.' })
    return
  }

  const trimmedText = text.trim()
  if (trimmedText.length > MAX_TEXT_LENGTH) {
    sendJson(res, 400, {
      error: 'text_too_long',
      message: `Text length exceeds maximum allowed length of ${MAX_TEXT_LENGTH} characters.`,
    })
    return
  }

  const validLanguages: SupportedLanguage[] = ['en', 'hi', 'kn', 'ta']
  if (typeof language !== 'string' || !validLanguages.includes(language as SupportedLanguage)) {
    sendJson(res, 400, {
      error: 'unsupported_language',
      message: `Unsupported language. Valid options: ${validLanguages.join(', ')}`,
    })
    return
  }

  const lang = language as SupportedLanguage
  const config = resolveSpeechConfig(lang)

  if (!config.apiKey) {
    sendJson(res, 503, {
      error: 'elevenlabs_not_configured',
      message: 'ElevenLabs API key is not configured. Set ELEVENLABS_API_KEY in server environment variables.',
    })
    return
  }

  if (!config.isModelLanguageSupported) {
    sendJson(res, 422, {
      error: 'language_unsupported_by_model',
      language: lang,
      model: config.modelId,
      message: `${lang === 'kn' ? 'Kannada' : lang} is not supported by ElevenLabs model ${config.modelId}. To enable speech for this language, configure an ElevenLabs model that supports it (such as eleven_v4).`,
    })
    return
  }

  if (!config.voiceId) {
    sendJson(res, 422, {
      error: 'no_voice_configured',
      language: lang,
      message: `No ElevenLabs voice ID is configured for language "${lang}".`,
    })
    return
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)

  try {
    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_44100_128`

    const requestPayload: Record<string, unknown> = {
      text: trimmedText,
      model_id: config.modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }

    if (lang === 'ta' || lang === 'hi' || lang === 'en') {
      requestPayload.language_code = lang
    }

    const response = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': config.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 401) {
        sendJson(res, 401, {
          error: 'invalid_api_key',
          message: 'The configured ElevenLabs API key is invalid or expired.',
        })
        return
      }

      if (response.status === 429) {
        sendJson(res, 429, {
          error: 'quota_exceeded',
          message: 'ElevenLabs generation quota exceeded or rate limit reached.',
        })
        return
      }

      let errorDetail = 'Upstream ElevenLabs generation failed.'
      try {
        const errorJson = (await response.json()) as { detail?: { message?: string } | string }
        if (typeof errorJson?.detail === 'string') {
          errorDetail = errorJson.detail
        } else if (errorJson?.detail?.message) {
          errorDetail = errorJson.detail.message
        }
      } catch {
        // Fallback
      }

      sendJson(res, response.status, {
        error: 'upstream_error',
        message: errorDetail,
      })
      return
    }

    const audioArrayBuffer = await response.arrayBuffer()
    const audioBuffer = Buffer.from(audioArrayBuffer)

    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
      'X-Speech-Provider': 'ElevenLabs',
      'X-Speech-Model': config.modelId,
      'X-Speech-Voice': config.voiceId,
    })
    res.end(audioBuffer)
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    const isAbort = err instanceof Error && err.name === 'AbortError'
    sendJson(res, isAbort ? 504 : 502, {
      error: isAbort ? 'gateway_timeout' : 'network_error',
      message: isAbort
        ? 'Speech generation timed out.'
        : 'Failed to communicate with ElevenLabs speech service.',
    })
  }
}
