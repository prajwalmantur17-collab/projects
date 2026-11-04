import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_MODEL_ID,
  DEFAULT_VOICES,
  MAX_TEXT_LENGTH,
  MODEL_SUPPORTED_LANGUAGES,
  resolveSpeechConfig,
  isOriginAllowed,
} from '../../api/speechConfig'

describe('ElevenLabs speech configuration and model capabilities', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_MODEL_ID
    delete process.env.ELEVENLABS_VOICE_ID
    delete process.env.ELEVENLABS_VOICE_EN
    delete process.env.ELEVENLABS_VOICE_HI
    delete process.env.ELEVENLABS_VOICE_KN
    delete process.env.ELEVENLABS_VOICE_TA
    delete process.env.ALLOWED_ORIGINS
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('defines max text length limit to conserve quota', () => {
    expect(MAX_TEXT_LENGTH).toBe(500)
  })

  it('sets eleven_multilingual_v2 as the default model', () => {
    expect(DEFAULT_MODEL_ID).toBe('eleven_multilingual_v2')
  })

  it('verifies eleven_multilingual_v2 supports English, Hindi, Kannada, and Tamil', () => {
    const v2Languages = MODEL_SUPPORTED_LANGUAGES.eleven_multilingual_v2
    expect(v2Languages).toContain('en')
    expect(v2Languages).toContain('hi')
    expect(v2Languages).toContain('ta')
    expect(v2Languages).toContain('kn')
  })

  it('verifies eleven_v4 supports all languages including Kannada', () => {
    const v4Languages = MODEL_SUPPORTED_LANGUAGES.eleven_v4
    expect(v4Languages).toContain('en')
    expect(v4Languages).toContain('hi')
    expect(v4Languages).toContain('ta')
    expect(v4Languages).toContain('kn')
  })

  it('resolves correct default voices for English, Hindi, Kannada, and Tamil', () => {
    expect(DEFAULT_VOICES.en).toBe('LHMvGhXWZPfzCiDpiEc1')
    expect(DEFAULT_VOICES.hi).toBe('LHMvGhXWZPfzCiDpiEc1')
    expect(DEFAULT_VOICES.kn).toBe('LHMvGhXWZPfzCiDpiEc1')
    expect(DEFAULT_VOICES.ta).toBe('LHMvGhXWZPfzCiDpiEc1')
  })

  it('detects missing API key when ELEVENLABS_API_KEY is unset', () => {
    const config = resolveSpeechConfig('en')
    expect(config.apiKey).toBeNull()
  })

  it('reports Kannada as supported on eleven_multilingual_v2', () => {
    expect(resolveSpeechConfig('en').isModelLanguageSupported).toBe(true)
    expect(resolveSpeechConfig('hi').isModelLanguageSupported).toBe(true)
    expect(resolveSpeechConfig('ta').isModelLanguageSupported).toBe(true)
    expect(resolveSpeechConfig('kn').isModelLanguageSupported).toBe(true)
  })

  it('validates allowed CORS origins against default and env origins', () => {
    expect(isOriginAllowed('https://harvestrent.vercel.app')).toBe(true)
    expect(isOriginAllowed('http://localhost:5173')).toBe(true)
    expect(isOriginAllowed('https://malicious-site.com')).toBe(false)
    expect(isOriginAllowed(null)).toBe(false)

    process.env.ALLOWED_ORIGINS = 'https://custom-preview.vercel.app,https://staging.harvestrent.app'
    expect(isOriginAllowed('https://custom-preview.vercel.app')).toBe(true)
    expect(isOriginAllowed('https://staging.harvestrent.app')).toBe(true)
  })
})
