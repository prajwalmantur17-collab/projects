import { useState, useEffect } from 'react'
import { Download, RefreshCw, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { useI18n } from '../../i18n'

// Current version embedded into the client build
export const APP_VERSION = '1.0.0'

interface VersionConfig {
  latestVersion: string
  minSupportedVersion: string
  downloadUrl: string
  releaseNotes?: {
    en?: string
    kn?: string
    hi?: string
    ta?: string
  }
  forceUpdate?: boolean
}

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number)
  const p2 = v2.split('.').map(Number)
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0
    const num2 = p2[i] || 0
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  return 0
}

export function AppUpdateModal() {
  const { language } = useI18n()
  const [updateConfig, setUpdateConfig] = useState<VersionConfig | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check for updates on startup
    const checkUpdate = async () => {
      try {
        // Fetches from public /version.json with cache busting
        const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data: VersionConfig = await res.json()
        if (data && data.latestVersion) {
          // If latestVersion is greater than our current APP_VERSION
          if (compareVersions(data.latestVersion, APP_VERSION) > 0) {
            setUpdateConfig(data)
          }
        }
      } catch {
        // Silently ignore network failures
      }
    }

    void checkUpdate()
    // Periodic check every 30 minutes
    const interval = setInterval(checkUpdate, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (!updateConfig || dismissed) return null

  const isMandatory = updateConfig.forceUpdate || compareVersions(APP_VERSION, updateConfig.minSupportedVersion || '0.0.0') < 0

  const titles: Record<string, string> = {
    en: 'New Update Available',
    kn: 'ಹೊಸ ನವೀಕರಣ ಲಭ್ಯವಿದೆ',
    hi: 'नया अपडेट उपलब्ध है',
    ta: 'புதிய புதுப்பிப்பு கிடைக்கிறது',
  }

  const messages: Record<string, string> = {
    en: `A newer version (${updateConfig.latestVersion}) of HarvestRent is available. Please update to continue using the latest features.`,
    kn: `HarvestRent ನ ಹೊಸ ಆವೃತ್ತಿ (${updateConfig.latestVersion}) ಲಭ್ಯವಿದೆ. ಇತ್ತೀಚಿನ ಸೌಲಭ್ಯಗಳನ್ನು ಬಳಸಲು ದಯವಿಟ್ಟು ಅಪ್ಲಿಕೇಶನ್ ನವೀಕರಿಸಿ.`,
    hi: `HarvestRent का नया संस्करण (${updateConfig.latestVersion}) उपलब्ध है। नवीनतम सुविधाओं का उपयोग करने के लिए कृपया अपडेट करें।`,
    ta: `HarvestRent-இன் புதிய பதிப்பு (${updateConfig.latestVersion}) கிடைக்கிறது. சமீபத்திய அம்சங்களைப் பயன்படுத்த தயவுசெய்து புதுப்பிக்கவும்.`,
  }

  const updateButtons: Record<string, string> = {
    en: 'Update Now',
    kn: 'ಈಗ ನವೀಕರಿಸಿ',
    hi: 'अभी अपडेट करें',
    ta: 'இப்போது புதுப்பிக்கவும்',
  }

  const laterButtons: Record<string, string> = {
    en: 'Later',
    kn: 'ನಂತರ',
    hi: 'बाद में',
    ta: 'பிறகு',
  }

  const currentLang = ['kn', 'hi', 'ta'].includes(language) ? language : 'en'

  const handleUpdate = () => {
    window.open(updateConfig.downloadUrl || '/download', '_blank')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#176B45]/30 bg-white p-6 shadow-2xl">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-600 via-leaf-600 to-amber-500" />

        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-700 shadow-2xs border border-leaf-200/60">
            <RefreshCw className="size-6 animate-spin duration-3000" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold text-ink">
                {titles[currentLang] || titles.en}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200/60">
                <Sparkles className="size-3 text-amber-600" />
                v{updateConfig.latestVersion}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Current version: v{APP_VERSION}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          {messages[currentLang] || messages.en}
        </p>

        {updateConfig.releaseNotes?.[currentLang as keyof typeof updateConfig.releaseNotes] && (
          <div className="mt-3 rounded-2xl bg-cream-50 p-3 text-xs text-ink-soft border border-cream-200">
            <p className="font-bold text-ink mb-1">What&apos;s new:</p>
            <p>{updateConfig.releaseNotes[currentLang as keyof typeof updateConfig.releaseNotes]}</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          {!isMandatory && (
            <Button
              variant="outline"
              size="md"
              onClick={() => setDismissed(true)}
              className="text-xs"
            >
              {laterButtons[currentLang] || laterButtons.en}
            </Button>
          )}

          <Button
            size="md"
            onClick={handleUpdate}
            className="flex items-center gap-2 text-xs font-bold"
          >
            <Download className="size-4" />
            <span>{updateButtons[currentLang] || updateButtons.en}</span>
          </Button>
        </div>

        {isMandatory && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50/80 px-2.5 py-1.5 rounded-xl border border-amber-200/50">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>This update contains critical improvements and is required to continue.</span>
          </div>
        )}
      </div>
    </div>
  )
}
