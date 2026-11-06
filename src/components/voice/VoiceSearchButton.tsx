import { useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useI18n } from '../../i18n'
import {
  getVoiceLocale,
  isSpeechRecognitionSupported,
  parseSpokenQuery,
  speakAloud,
  stopSpeaking,
} from '../../lib/voice'
import { unlockMobileAudio } from '../../lib/speech'
import type { VoiceQueryResult } from '../../lib/voice'

export function VoiceSearchButton({
  onVoiceResult,
  className = '',
}: {
  onVoiceResult: (result: VoiceQueryResult) => void
  className?: string
}) {
  const { t, language } = useI18n()
  const [listening, setListening] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleStartListening = () => {
    unlockMobileAudio()
    setErrorMessage(null)

    if (!isSpeechRecognitionSupported()) {
      alert(t('voice.notSupported'))
      return
    }

    if (listening) {
      setListening(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.lang = getVoiceLocale(language)
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setListening(true)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript
      if (transcript) {
        const parsed = parseSpokenQuery(transcript)
        onVoiceResult(parsed)

        // Give quick spoken confirmation
        const ack = language === 'kn' ? 'ಹುಡುಕಲಾಗುತ್ತಿದೆ...' : language === 'hi' ? 'खोज रहे हैं...' : 'Searching...'
        void speakAloud(ack, language)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error)
      setListening(false)
      if (event.error !== 'no-speech') {
        setErrorMessage(t('voice.notSupported'))
      }
    }

    recognition.onend = () => {
      setListening(false)
    }

    try {
      stopSpeaking()
      recognition.start()
    } catch {
      setListening(false)
    }
  }

  return (
    <div className="relative flex w-full items-center">
      <button
        type="button"
        onClick={handleStartListening}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors transition-transform transition-shadow active:scale-95 ${
          listening
            ? 'animate-pulse bg-red-600 text-white shadow-lift ring-4 ring-red-200'
            : 'border-2 border-leaf-700 bg-leaf-50 text-leaf-900 hover:bg-leaf-100'
        } ${className}`}
        title={listening ? t('voice.listening') : t('voice.tapToSpeak')}
        aria-label={listening ? t('voice.listening') : t('voice.tapToSpeak')}
      >
        {listening ? (
          <>
            <MicOff className="size-5 text-white" aria-hidden="true" />
            <span className="animate-bounce">{t('voice.listening')}</span>
          </>
        ) : (
          <>
            <Mic className="size-5 text-leaf-800" aria-hidden="true" />
            <span>{t('voice.tapToSpeak')}</span>
          </>
        )}
      </button>

      {errorMessage ? (
        <span className="absolute -bottom-6 left-0 whitespace-nowrap text-xs text-red-600">
          {errorMessage}
        </span>
      ) : null}
    </div>
  )
}
