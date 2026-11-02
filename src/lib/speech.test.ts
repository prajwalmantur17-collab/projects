import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  cancelSpeech,
  getMissingVoiceMessage,
  pickBestVoice,
  speakAloudWithFeedback,
  SPEECH_LOCALES,
} from './speech'

function createMockVoice(name: string, lang: string): SpeechSynthesisVoice {
  return {
    name,
    lang,
    default: false,
    localService: true,
    voiceURI: name,
  }
}

describe('speech Web Speech API helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('defines correct speech locales for all supported languages', () => {
    expect(SPEECH_LOCALES.en).toBe('en-IN')
    expect(SPEECH_LOCALES.kn).toBe('kn-IN')
    expect(SPEECH_LOCALES.hi).toBe('hi-IN')
    expect(SPEECH_LOCALES.ta).toBe('ta-IN')
  })

  describe('pickBestVoice', () => {
    const mockVoices: SpeechSynthesisVoice[] = [
      createMockVoice('Microsoft David Desktop - English (United States)', 'en-US'),
      createMockVoice('Microsoft Zira Desktop - English (United States)', 'en-US'),
      createMockVoice('Microsoft Ravi - English (India)', 'en-IN'),
      createMockVoice('Google हिन्दी', 'hi-IN'),
      createMockVoice('Google ಕನ್ನಡ', 'kn-IN'),
      createMockVoice('Google தமிழ்', 'ta-IN'),
    ]

    it('prefers Indian English voice (en-IN) over standard US English for English', () => {
      const selected = pickBestVoice(mockVoices, 'en')
      expect(selected).not.toBeNull()
      expect(selected?.lang).toBe('en-IN')
      expect(selected?.name).toContain('Ravi')
    })

    it('selects Kannada voice for Kannada', () => {
      const selected = pickBestVoice(mockVoices, 'kn')
      expect(selected).not.toBeNull()
      expect(selected?.lang).toBe('kn-IN')
      expect(selected?.name).toContain('ಕನ್ನಡ')
    })

    it('selects Hindi voice for Hindi', () => {
      const selected = pickBestVoice(mockVoices, 'hi')
      expect(selected).not.toBeNull()
      expect(selected?.lang).toBe('hi-IN')
      expect(selected?.name).toContain('हिन्दी')
    })

    it('selects Tamil voice for Tamil', () => {
      const selected = pickBestVoice(mockVoices, 'ta')
      expect(selected).not.toBeNull()
      expect(selected?.lang).toBe('ta-IN')
      expect(selected?.name).toContain('தமிழ்')
    })

    it('crucially returns null for Kannada when device only has English voices (prevents English voice speaking Kannada)', () => {
      const englishOnlyVoices: SpeechSynthesisVoice[] = [
        createMockVoice('Microsoft David Desktop - English (United States)', 'en-US'),
        createMockVoice('Microsoft Zira Desktop - English (United States)', 'en-US'),
      ]

      const selected = pickBestVoice(englishOnlyVoices, 'kn')
      expect(selected).toBeNull()
    })

    it('crucially returns null for Hindi when device only has English voices', () => {
      const englishOnlyVoices: SpeechSynthesisVoice[] = [
        createMockVoice('Microsoft David Desktop - English (United States)', 'en-US'),
      ]

      const selected = pickBestVoice(englishOnlyVoices, 'hi')
      expect(selected).toBeNull()
    })

    it('crucially returns null for Tamil when device only has English voices', () => {
      const englishOnlyVoices: SpeechSynthesisVoice[] = [
        createMockVoice('Microsoft David Desktop - English (United States)', 'en-US'),
      ]

      const selected = pickBestVoice(englishOnlyVoices, 'ta')
      expect(selected).toBeNull()
    })

    it('falls back to standard English voice if Indian English is unavailable for English', () => {
      const usEnglishVoices: SpeechSynthesisVoice[] = [
        createMockVoice('Microsoft David - English (United States)', 'en-US'),
      ]

      const selected = pickBestVoice(usEnglishVoices, 'en')
      expect(selected).not.toBeNull()
      expect(selected?.lang).toBe('en-US')
    })
  })

  describe('getMissingVoiceMessage', () => {
    it('returns farmer-friendly localized guidance in Kannada', () => {
      const msg = getMissingVoiceMessage('kn')
      expect(msg).toContain('ಕನ್ನಡ')
      expect(msg).toContain('Google Chrome')
    })

    it('returns farmer-friendly localized guidance in Hindi', () => {
      const msg = getMissingVoiceMessage('hi')
      expect(msg).toContain('हिंदी')
    })

    it('returns farmer-friendly localized guidance in Tamil', () => {
      const msg = getMissingVoiceMessage('ta')
      expect(msg).toContain('தமிழ்')
    })

    it('returns English message for English', () => {
      const msg = getMissingVoiceMessage('en')
      expect(msg).toContain('English')
    })
  })

  describe('speakAloudWithFeedback', () => {
    it('returns success immediately for empty text', async () => {
      const result = await speakAloudWithFeedback('', 'en')
      expect(result.success).toBe(true)
    })

    it('returns unsupported when window.speechSynthesis is not available', async () => {
      const originalSynth = window.speechSynthesis
      // @ts-expect-error Mocking window
      delete window.speechSynthesis
      try {
        const result = await speakAloudWithFeedback('Hello', 'en')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.reason).toBe('unsupported')
        }
      } finally {
        window.speechSynthesis = originalSynth
      }
    })

    it('handles cancellation without throwing', () => {
      expect(() => cancelSpeech()).not.toThrow()
    })
  })
})
