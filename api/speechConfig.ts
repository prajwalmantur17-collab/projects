/**
 * Server-side configuration for ElevenLabs Text-to-Speech integration.
 * Centralizes voice mapping, model capability checks, and request boundaries.
 */

export type SupportedLanguage = 'en' | 'hi' | 'kn' | 'ta'

export const MAX_TEXT_LENGTH = 500

export const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'

/**
 * Known model language support matrix.
 * Eleven Multilingual v2 supports 29 languages including Hindi (hi), Tamil (ta), and English (en),
 * but does NOT support Kannada (kn).
 * Kannada requires newer ElevenLabs models such as Eleven v4 (eleven_v4).
 */
export const MODEL_SUPPORTED_LANGUAGES: Record<string, SupportedLanguage[]> = {
  eleven_multilingual_v2: ['en', 'hi', 'ta'],
  eleven_turbo_v2_5: ['en', 'hi', 'ta'],
  eleven_flash_v2_5: ['en', 'hi', 'ta'],
  eleven_v4: ['en', 'hi', 'kn', 'ta'],
}

/**
 * Standard premade ElevenLabs voices:
 * - Rachel (21m00Tcm4TlvDq8ikWAM): Clean, natural English narration
 * - Adam (pNInz6obpgDQGcFmaJgB): Expressive multilingual voice with Hindi/Tamil support
 */
export const DEFAULT_VOICES: Record<SupportedLanguage, string> = {
  en: '21m00Tcm4TlvDq8ikWAM', // Rachel
  hi: 'pNInz6obpgDQGcFmaJgB', // Adam
  ta: 'pNInz6obpgDQGcFmaJgB', // Adam
  kn: '',                     // Requires custom voice or eleven_v4 compatible voice
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

  let voiceId = ''
  switch (language) {
    case 'en':
      voiceId = process.env.ELEVENLABS_VOICE_EN?.trim() || DEFAULT_VOICES.en
      break
    case 'hi':
      voiceId = process.env.ELEVENLABS_VOICE_HI?.trim() || DEFAULT_VOICES.hi
      break
    case 'ta':
      voiceId = process.env.ELEVENLABS_VOICE_TA?.trim() || DEFAULT_VOICES.ta
      break
    case 'kn':
      voiceId = process.env.ELEVENLABS_VOICE_KN?.trim() || DEFAULT_VOICES.kn
      break
  }

  const supportedLanguages = MODEL_SUPPORTED_LANGUAGES[modelId]
  // If model is unknown, default to false for kn unless explicitly mapped
  const isModelLanguageSupported = supportedLanguages
    ? supportedLanguages.includes(language)
    : language !== 'kn'

  return {
    apiKey,
    modelId,
    voiceId,
    isModelLanguageSupported,
    language,
  }
}
