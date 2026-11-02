import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_MODEL_ID,
  DEFAULT_VOICES,
  MAX_TEXT_LENGTH,
  MODEL_SUPPORTED_LANGUAGES,
  resolveSpeechConfig,
} from '../../api/speechConfig'

describe('ElevenLabs speech configuration and model capabilities', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_MODEL_ID
    delete process.env.ELEVENLABS_VOICE_EN
    delete process.env.ELEVENLABS_VOICE_HI
    delete process.env.ELEVENLABS_VOICE_KN
    delete process.env.ELEVENLABS_VOICE_TA
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

  it('verifies eleven_multilingual_v2 supports English, Hindi, and Tamil but NOT Kannada', () => {
    const v2Languages = MODEL_SUPPORTED_LANGUAGES.eleven_multilingual_v2
    expect(v2Languages).toContain('en')
    expect(v2Languages).toContain('hi')
    expect(v2Languages).toContain('ta')
    expect(v2Languages).not.toContain('kn')
  })

  it('verifies eleven_v4 supports Kannada', () => {
    const v4Languages = MODEL_SUPPORTED_LANGUAGES.eleven_v4
    expect(v4Languages).toContain('kn')
  })

  it('resolves correct default voices for English, Hindi, and Tamil', () => {
    expect(DEFAULT_VOICES.en).toBe('pNInz6obpgDQGcFmaJgB') // Adam (Free tier compatible)
    expect(DEFAULT_VOICES.hi).toBe('pNInz6obpgDQGcFmaJgB') // Adam
    expect(DEFAULT_VOICES.ta).toBe('pNInz6obpgDQGcFmaJgB') // Adam
    expect(DEFAULT_VOICES.kn).toBe('')
  })

  it('detects missing API key when ELEVENLABS_API_KEY is unset', () => {
    const config = resolveSpeechConfig('en')
    expect(config.apiKey).toBeNull()
  })

  it('correctly reports Kannada as unsupported when using default model', () => {
    const config = resolveSpeechConfig('kn')
    expect(config.isModelLanguageSupported).toBe(false)
  })

  it('correctly reports Hindi and English as supported on default model', () => {
    const enConfig = resolveSpeechConfig('en')
    expect(enConfig.isModelLanguageSupported).toBe(true)

    const hiConfig = resolveSpeechConfig('hi')
    expect(hiConfig.isModelLanguageSupported).toBe(true)
  })

  it('respects model and voice environment variable overrides', () => {
    process.env.ELEVENLABS_API_KEY = 'test_key_12345'
    process.env.ELEVENLABS_MODEL_ID = 'eleven_v4'
    process.env.ELEVENLABS_VOICE_KN = 'custom_kannada_voice_id'

    const config = resolveSpeechConfig('kn')
    expect(config.apiKey).toBe('test_key_12345')
    expect(config.modelId).toBe('eleven_v4')
    expect(config.voiceId).toBe('custom_kannada_voice_id')
    expect(config.isModelLanguageSupported).toBe(true)
  })
})
