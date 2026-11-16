import { useState, useEffect } from 'react'
import { Download, X, Smartphone, CheckCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { useI18n } from '../../i18n'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function InstallAppBanner() {
  const { language } = useI18n()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already in standalone (installed) mode safely
    const isStandalone =
      (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof window !== 'undefined' && (window.navigator as unknown as { standalone?: boolean })?.standalone)

    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (isInstalled || dismissed) return null

  const texts: Record<string, { title: string; subtitle: string; button: string }> = {
    en: {
      title: 'Install HarvestRent App',
      subtitle: 'Add to phone screen for fast, 1-tap direct access without app store',
      button: 'Install App',
    },
    kn: {
      title: 'HarvestRent ಅಪ್ಲಿಕೇಶನ್ ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಿ',
      subtitle: 'ಆ್ಯಪ್ ಸ್ಟೋರ್ ಇಲ್ಲದೆ ನೇರವಾಗಿ ಮೊಬೈಲ್‌ನಲ್ಲಿ ಬಳಸಲು ಸೇರಿಸಿ',
      button: 'ಆ್ಯಪ್ ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಿ',
    },
    hi: {
      title: 'HarvestRent ऐप इंस्टॉल करें',
      subtitle: 'बिना ऐप स्टोर के फ़ोन स्क्रीन पर तुरंत इस्तेमाल के लिए जोड़ें',
      button: 'ऐप इंस्टॉल करें',
    },
    ta: {
      title: 'HarvestRent செயலியை நிறுவுங்கள்',
      subtitle: 'ஆப் ஸ்டோர் இன்றி நேரடியாக போனில் பயன்படுத்த சேர்க்கவும்',
      button: 'செயலியை நிறுவுங்கள்',
    },
  }

  const currentLang = ['kn', 'hi', 'ta'].includes(language) ? language : 'en'
  const tInfo = texts[currentLang] || texts.en

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } else {
      // If browser doesn't support automatic prompt (like iOS Safari or older browsers), show instructions
      alert(
        language === 'kn'
          ? 'ನಿಮ್ಮ ಬ್ರೌಸರ್ ಮೆನುವಿನಲ್ಲಿ (3 ಚುಕ್ಕೆಗಳು) "Add to Home screen" ಅಥವಾ "Install app" ಒತ್ತಿ.'
          : language === 'hi'
          ? 'अपने ब्राउज़र मेनू (3 डॉट्स) में "Add to Home screen" या "Install app" दबाएँ।'
          : 'Tap your browser menu (3 dots) and select "Add to Home screen" or "Install App".'
      )
    }
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 sm:left-auto sm:right-6 sm:w-96 animate-in slide-in-from-bottom duration-300">
      <div className="relative overflow-hidden rounded-2xl border border-leaf-600/40 bg-[#0B2B1E] p-4 text-white shadow-2xl backdrop-blur-md">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 size-24 rounded-full bg-emerald-500/20 blur-xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#168052] text-white shadow-sm border border-emerald-400/30">
              <Smartphone className="size-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-display text-sm font-bold text-white tracking-tight leading-tight">
                  {tInfo.title}
                </h4>
                <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[11px] text-[#A9C7B6] mt-0.5 leading-snug">
                {tInfo.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-[#A9C7B6] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2 pt-2 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
            <CheckCircle className="size-3.5" />
            <span>Fast & Free</span>
          </div>

          <Button
            size="sm"
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-leaf-600 hover:from-emerald-600 hover:to-leaf-700 text-white font-bold text-xs py-1.5 px-3.5 rounded-xl shadow-md cursor-pointer border border-emerald-300/30"
          >
            <Download className="size-3.5" />
            <span>{tInfo.button}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
