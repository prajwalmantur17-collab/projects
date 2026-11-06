import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSidebar } from '../layout/SidebarContext'
import { Mic, MicOff, Volume2, X } from 'lucide-react'
import { useI18n } from '../../i18n'
import { toast } from '../../lib/toast'
import {
  getVoiceLocale,
  isSpeechRecognitionSupported,
  parseSpokenQuery,
  speakAloud,
  stopSpeaking,
} from '../../lib/voice'
import { unlockMobileAudio } from '../../lib/speech'
import type { VoiceQueryResult } from '../../lib/voice'

export function KisanVoiceAssistant({
  onVoiceSearch,
}: {
  onVoiceSearch: (result: VoiceQueryResult) => void
}) {
  const { t, language } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const { mobileOpen } = useSidebar()

  const handleOpen = () => {
    unlockMobileAudio()
    setIsOpen(true)
    setTranscript('')

    // Play greeting prompt aloud
    let greeting = ''
    if (language === 'kn') {
      greeting = 'ನಮಸ್ಕಾರ, ನಿಮ್ಮ ಊರು ಅಥವಾ ಬೆಳೆಯ ಹೆಸರು ಹೇಳಿ.'
    } else if (language === 'hi') {
      greeting = 'नमस्ते, अपने गांव या फसल का नाम बताएं।'
    } else {
      greeting = 'Namaste, speak your village or crop name to find harvesters.'
    }
    void speakAloud(greeting, language)
  }

  const handleClose = () => {
    stopSpeaking()
    setListening(false)
    setIsOpen(false)
  }

  const startListening = () => {
    if (!isSpeechRecognitionSupported()) {
      toast.error(t('voice.notSupported'))
      return
    }

    stopSpeaking()
    setTranscript('')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.lang = getVoiceLocale(language)
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setListening(true)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const current = event.results?.[0]?.[0]?.transcript || ''
      setTranscript(current)

      if (event.results?.[0]?.isFinal) {
        const parsed = parseSpokenQuery(current)
        onVoiceSearch(parsed)
        setTimeout(() => {
          handleClose()
        }, 1200)
      }
    }

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    try {
      recognition.start()
    } catch {
      setListening(false)
    }
  }

  if (typeof document === 'undefined') return null

  // Rendered into <body> so no page transform/animation can make it scroll with the content.
  return createPortal(
    <>
      {/* Floating Action Button for Easy 1-Tap Access (always fixed to the screen) */}
      <div
        className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] right-4 z-40 transition-opacity duration-200 lg:bottom-6 lg:right-6 ${
          mobileOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={handleOpen}
          className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-leaf-700 to-leaf-900 px-4 py-3 text-sm font-bold text-cream-50 shadow-lift transition-all hover:scale-105 active:scale-95"
          aria-label={t('voice.assistantTitle')}
        >
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Mic className="size-4 text-cream-50 animate-pulse" />
          </span>
          <span className="hidden sm:inline">{t('voice.assistantTitle')}</span>
          <span className="sm:hidden">🎤 {t('voice.assistantTitle')}</span>
        </button>
      </div>

      {/* Accessible Voice Assistant Modal */}
      {isOpen ? (
        <div className="hr-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="hr-modal-dialog relative w-full max-w-md rounded-3xl bg-white p-6 shadow-lift sm:p-8">
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-full p-2 text-ink-muted hover:bg-cream-100"
              aria-label="Close"
            >
              <X className="size-6" />
            </button>

            <div className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-800">
                <Volume2 className="size-7" />
              </div>

              <h2 className="mt-4 text-2xl font-extrabold text-ink">
                {t('voice.assistantTitle')}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {language === 'kn'
                  ? 'ಮೈಕ್ರೋಫೋನ್ ಒತ್ತಿ, ನಿಮ್ಮ ಊರು ಅಥವಾ ಬೆಳೆಯ ಹೆಸರು ಹೇಳಿ.'
                  : language === 'hi'
                  ? 'माइक दबाएं और अपने गांव या फसल का नाम बोलें।'
                  : 'Tap the mic and speak your village or crop name.'}
              </p>

              {/* Big Pulsing Mic Button */}
              <div className="my-8 flex justify-center">
                <button
                  type="button"
                  onClick={startListening}
                  className={`flex size-24 items-center justify-center rounded-full transition-all active:scale-95 ${
                    listening
                      ? 'animate-pulse bg-red-600 text-white shadow-lift ring-8 ring-red-200'
                      : 'bg-leaf-700 text-white shadow-lift hover:bg-leaf-800'
                  }`}
                  aria-label={listening ? t('voice.listening') : t('voice.tapToSpeak')}
                >
                  {listening ? <MicOff className="size-10" /> : <Mic className="size-10" />}
                </button>
              </div>

              <p className="text-base font-bold text-leaf-800">
                {listening
                  ? t('voice.listening')
                  : transcript
                  ? `"${transcript}"`
                  : t('voice.tapToSpeak')}
              </p>

              <p className="mt-3 text-xs text-ink-muted">{t('voice.speechPrompt')}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  )
}
