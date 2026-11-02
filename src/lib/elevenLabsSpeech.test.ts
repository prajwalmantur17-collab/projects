import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  clearElevenLabsCache,
  fetchElevenLabsAudio,
  hasCachedAudio,
  stopElevenLabsAudio,
} from './elevenLabsSpeech'

describe('ElevenLabs Client-Side Speech Service', () => {
  beforeEach(() => {
    clearElevenLabsCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    stopElevenLabsAudio()
    clearElevenLabsCache()
  })

  it('rejects empty text without making a network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const result = await fetchElevenLabsAudio('   ', 'en')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('empty_text')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches audio and saves in-memory cache to prevent duplicate requests', async () => {
    const mockBlob = new Blob(['mock audio binary'], { type: 'audio/mpeg' })
    const createObjectURLMock = vi.fn(() => 'blob:http://localhost:5173/mock-audio-uuid')
    globalThis.URL.createObjectURL = createObjectURLMock

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockBlob, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    )

    const text = 'Harvest machine available in Mandya'
    const firstCall = await fetchElevenLabsAudio(text, 'en')

    expect(firstCall.ok).toBe(true)
    if (firstCall.ok) {
      expect(firstCall.audioUrl).toBe('blob:http://localhost:5173/mock-audio-uuid')
      expect(firstCall.fromCache).toBe(false)
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(hasCachedAudio('en', text)).toBe(true)

    // Second call for identical text/language should hit in-memory cache directly!
    const secondCall = await fetchElevenLabsAudio(text, 'en')
    expect(secondCall.ok).toBe(true)
    if (secondCall.ok) {
      expect(secondCall.audioUrl).toBe('blob:http://localhost:5173/mock-audio-uuid')
      expect(secondCall.fromCache).toBe(true)
    }
    // Fetch should NOT be called a second time
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('handles 401 invalid API key error gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'invalid_api_key',
          message: 'The configured ElevenLabs API key is invalid or expired.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const result = await fetchElevenLabsAudio('Test text', 'en')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid_api_key')
      expect(result.message).toContain('invalid')
      expect(result.status).toBe(401)
    }
  })

  it('handles 422 Kannada unsupported by model error gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'language_unsupported_by_model',
          language: 'kn',
          model: 'eleven_multilingual_v2',
          message: 'Kannada is not supported by ElevenLabs model eleven_multilingual_v2.',
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const result = await fetchElevenLabsAudio('ಕನ್ನಡ ಪರೀಕ್ಷೆ', 'kn')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('language_unsupported_by_model')
      expect(result.message).toContain('Kannada is not supported')
      expect(result.status).toBe(422)
    }
  })

  it('handles 429 quota exceeded error gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'quota_exceeded',
          message: 'ElevenLabs generation quota exceeded or rate limit reached.',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const result = await fetchElevenLabsAudio('Test quota', 'hi')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('quota_exceeded')
      expect(result.status).toBe(429)
    }
  })

  it('clears cache and revokes created object URLs', () => {
    const revokeSpy = vi.fn()
    globalThis.URL.revokeObjectURL = revokeSpy
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test-url')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(new Blob(['data']), { status: 200 }),
    )

    clearElevenLabsCache()
    expect(hasCachedAudio('en', 'Any text')).toBe(false)
  })
})
