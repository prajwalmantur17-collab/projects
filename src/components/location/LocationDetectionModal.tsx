import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  MapPin,
  MapPinOff,
  Navigation2,
  RefreshCw,
  X,
} from 'lucide-react'
import { useI18n } from '../../i18n'
import { USABLE_ACCURACY_M } from '../../hooks/useGeolocation'
import { reverseGeocode } from '../../services/geocode'
import type { Coordinates } from '../../types'
import { Button } from '../ui/Button'

export interface LocationDetectionResult {
  village: string
  district: string
  state: string
  coords: Coordinates
  accuracy?: number
}

export interface LocationDetectionModalProps {
  open: boolean
  onClose: () => void
  /** Triggered only when the farmer confirms the detected location */
  onConfirm: (result: LocationDetectionResult) => void
  /** Triggered when the farmer chooses to type their village manually */
  onEnterManually?: () => void
  /** Optional timeout budget in milliseconds (defaults to 10,000ms) */
  timeoutMs?: number
}

type ModalState = 'detecting' | 'success' | 'denied' | 'timeout' | 'unavailable'

const SEARCH_STATUS_STEPS: Record<string, [string, string, string]> = {
  en: ['Finding satellites…', 'Getting your location…', 'Finding your village…'],
  kn: ['ಉಪಗ್ರಹಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ…', 'ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಪಡೆಯಲಾಗುತ್ತಿದೆ…', 'ನಿಮ್ಮ ಗ್ರಾಮವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ…'],
  hi: ['उपग्रह खोज रहे हैं…', 'आपका स्थान प्राप्त कर रहे हैं…', 'आपका गांव खोज रहे हैं…'],
  ta: ['செயற்கைக்கோள்களைத் தேடுகிறது…', 'உங்கள் இருப்பிடத்தைப் பெறுகிறது…', 'உங்கள் கிராமத்தைத் தேடுகிறது…'],
}

export function LocationDetectionModal({
  open,
  onClose,
  onConfirm,
  onEnterManually,
  timeoutMs = 10_000,
}: LocationDetectionModalProps) {
  const { t, language } = useI18n()
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const [modalState, setModalState] = useState<ModalState>('detecting')
  const [coords, setCoords] = useState<Coordinates | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [detectedVillage, setDetectedVillage] = useState('')
  const [detectedDistrict, setDetectedDistrict] = useState('')
  const [detectedState, setDetectedState] = useState('')
  const [customVillage, setCustomVillage] = useState('')

  // Visual enhancements state
  const [bgError, setBgError] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)

  const activeAbortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<number | null>(null)
  const refineTimerRef = useRef<number | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)
  // Each detection run gets a number so late callbacks from an older run are ignored.
  const runIdRef = useRef(0)
  // Keep the latest values in refs so the detection callbacks stay stable between renders.
  const languageRef = useRef(language)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    languageRef.current = language
    onCloseRef.current = onClose
  })

  // Cycle search status text during detecting state
  useEffect(() => {
    if (modalState !== 'detecting') return
    const interval = window.setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % 3)
    }, 2200)
    return () => window.clearInterval(interval)
  }, [modalState])

  const stopGps = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (refineTimerRef.current !== null) {
      window.clearTimeout(refineTimerRef.current)
      refineTimerRef.current = null
    }
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const cleanup = useCallback(() => {
    stopGps()
    if (activeAbortRef.current) {
      activeAbortRef.current.abort()
      activeAbortRef.current = null
    }
  }, [stopGps])

  const startDetection = useCallback(() => {
    cleanup()
    setModalState('detecting')
    setStatusIndex(0)
    setCoords(null)
    setAccuracy(null)
    setDetectedVillage('')
    setDetectedDistrict('')
    setDetectedState('')
    setCustomVillage('')

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setModalState('unavailable')
      return
    }

    const controller = new AbortController()
    activeAbortRef.current = controller

    const runId = ++runIdRef.current
    const isCurrent = () => isMountedRef.current && runIdRef.current === runId
    // Becomes true once this run has produced its final answer (found, denied, timed out...).
    let settled = false
    let bestFix: { coords: Coordinates; accuracy: number } | null = null

    // Timeout watchdog: no GPS fix at all within the time budget.
    timerRef.current = window.setTimeout(() => {
      if (!isCurrent() || settled || bestFix) return
      settled = true
      stopGps()
      setModalState('timeout')
    }, timeoutMs)

    // Use the best fix we have, look up the place name, then show the result.
    const finalize = async () => {
      if (!isCurrent() || settled || !bestFix) return
      settled = true
      stopGps()
      const fix = bestFix
      setCoords(fix.coords)
      setAccuracy(fix.accuracy)

      try {
        const geocoded = await reverseGeocode(fix.coords, languageRef.current, controller.signal)
        if (!isCurrent()) return

        if (geocoded) {
          const v = (geocoded.village || geocoded.district || '').trim()
          setDetectedVillage(v)
          setDetectedDistrict((geocoded.district || '').trim())
          setDetectedState((geocoded.state || '').trim())
          setCustomVillage(v)
        } else {
          // No place name found: keep the GPS position and search by distance only.
          setDetectedVillage('')
          setDetectedDistrict('')
          setDetectedState('')
          setCustomVillage('')
        }
      } catch {
        if (!isCurrent()) return
        setDetectedVillage('')
        setDetectedDistrict('')
        setDetectedState('')
        setCustomVillage('')
      }
      if (isCurrent()) setModalState('success')
    }

    const handlePosition = (pos: GeolocationPosition) => {
      if (!isCurrent() || settled) return
      const acc = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 500
      const currentCoords: Coordinates = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }
      if (!bestFix || acc < bestFix.accuracy) {
        bestFix = { coords: currentCoords, accuracy: acc }
      }

      if (bestFix.accuracy <= USABLE_ACCURACY_M) {
        void finalize()
      } else if (refineTimerRef.current === null) {
        // A rough fix: wait a moment for a better one, then use the best we have.
        refineTimerRef.current = window.setTimeout(() => {
          refineTimerRef.current = null
          void finalize()
        }, 3000)
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      if (!isCurrent() || settled) return
      if (bestFix) {
        void finalize()
        return
      }
      settled = true
      stopGps()
      if (error.code === 1) {
        // User denied geolocation permission
        setModalState('denied')
      } else if (error.code === 3) {
        setModalState('timeout')
      } else {
        setModalState('unavailable')
      }
    }

    try {
      navigator.geolocation.getCurrentPosition(
        handlePosition,
        handleError,
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
      )

      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
      )
    } catch {
      settled = true
      setModalState('unavailable')
    }
  }, [cleanup, stopGps, timeoutMs])

  // Trigger detection when modal opens
  useEffect(() => {
    isMountedRef.current = true
    if (open) {
      startDetection()
    } else {
      cleanup()
    }
    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [open, startDetection, cleanup])

  // Accessibility: Focus trap & Escape key
  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
      prevActive?.focus()
    }
    // Only depends on `open`: the parent passes a new onClose every render, and re-running this
    // effect would restore the wrong body overflow and leave the page unable to scroll.
  }, [open])

  if (!open) return null

  const handleConfirm = () => {
    if (!coords) return
    // May be empty when no place name was found; the page then searches by GPS distance only.
    const finalVillage = (customVillage || detectedVillage || detectedDistrict).trim()
    onConfirm({
      village: finalVillage,
      district: detectedDistrict,
      state: detectedState,
      coords,
      accuracy: accuracy ?? undefined,
    })
    onClose()
  }

  const handleEnterManually = () => {
    onClose()
    onEnterManually?.()
  }

  const accuracyTier: 'none' | 'good' | 'okay' | 'poor' =
    accuracy == null
      ? 'none'
      : accuracy <= 50
        ? 'good'
        : accuracy <= 150
          ? 'okay'
          : 'poor'

  const accuracyRingPx =
    accuracy != null
      ? Math.min(124, Math.max(38, Math.round(36 + (accuracy / 150) * 76)))
      : 96

  const imgDataState =
    modalState === 'detecting'
      ? 'detecting'
      : modalState === 'success'
        ? 'success'
        : 'error'

  return createPortal(
    <div
      role="presentation"
      className="hr-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-leaf-900/60 bg-ink p-6 shadow-lift transition-all motion-safe:animate-[modal-mobile-in_340ms_cubic-bezier(0.16,1,0.3,1)_both] sm:rounded-3xl sm:p-7 sm:motion-safe:animate-[modal-desktop-in_250ms_cubic-bezier(0.16,1,0.3,1)_both]"
      >
        {/* Background layer as FIRST child behind all content */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[inherit]">
          {!bgError && (
            <img
              src="/location-map-bg.webp"
              alt=""
              loading="eager"
              decoding="async"
              data-state={imgDataState}
              onError={() => setBgError(true)}
              className="hr-map-bg h-full w-full object-cover opacity-40"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/60 to-ink/85" />
        </div>

        {/* Existing content wrapped in relative z-10 */}
        <div className="relative z-10">
          {/* Header with Title and Close Button */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white"
              >
                {modalState === 'detecting' && t('locModal.findingTitle')}
                {modalState === 'success' && t('locModal.foundTitle')}
                {modalState === 'denied' && t('locModal.deniedTitle')}
                {modalState === 'timeout' && t('locModal.timeoutTitle')}
                {modalState === 'unavailable' && t('farmer.locationUnsupported')}
              </h2>
              <p
                id={descId}
                className="mt-1 text-xs sm:text-sm text-cream-200 leading-relaxed"
              >
                {modalState === 'detecting' && t('locModal.findingDesc')}
                {modalState === 'success' && t('locModal.foundSubtitle')}
                {modalState === 'denied' && t('locModal.deniedDesc')}
                {modalState === 'timeout' && t('locModal.timeoutDesc')}
                {modalState === 'unavailable' && t('farmer.locationUnsupported')}
              </p>
            </div>

            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-cream-200 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
              aria-label={t('common.cancel')}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* STATE 1: DETECTING (Animated Radar GPS Tech Illustration)     */}
          {/* ------------------------------------------------------------- */}
          {modalState === 'detecting' && (
            <div className="py-5 sm:py-6 flex flex-col items-center">
              {/* Circular Radar Canvas */}
              <div className="relative flex size-52 sm:size-58 items-center justify-center rounded-full bg-gradient-to-b from-leaf-950/80 via-leaf-900/50 to-leaf-950/80 border border-leaf-700/60 shadow-inner overflow-hidden">
                {/* Concentric grid lines */}
                <div className="pointer-events-none absolute size-[86%] rounded-full border border-dashed border-leaf-700/40" />
                <div className="pointer-events-none absolute size-[58%] rounded-full border border-leaf-600/40" />
                <div className="pointer-events-none absolute size-[32%] rounded-full border border-leaf-500/40 bg-leaf-900/30" />

                {/* Lat/Long Crosshair axes */}
                <div className="pointer-events-none absolute h-px w-full bg-leaf-800/60" />
                <div className="pointer-events-none absolute h-full w-px bg-leaf-800/60" />

                {/* 3 Soft Pulsing Radar Rings */}
                <div className="pointer-events-none absolute size-28 rounded-full border border-leaf-500/60 motion-safe:animate-[radar-ripple_2.8s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
                <div
                  className="pointer-events-none absolute size-28 rounded-full border border-leaf-500/50 motion-safe:animate-[radar-ripple_2.8s_cubic-bezier(0.16,1,0.3,1)_infinite]"
                  style={{ animationDelay: '900ms' }}
                />
                <div
                  className="pointer-events-none absolute size-28 rounded-full border border-leaf-500/40 motion-safe:animate-[radar-ripple_2.8s_cubic-bezier(0.16,1,0.3,1)_infinite]"
                  style={{ animationDelay: '1800ms' }}
                />

                {/* Rotating Radar Sweep Cone */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-full motion-safe:animate-[radar-sweep_4s_linear_infinite]"
                  style={{
                    background:
                      'conic-gradient(from 0deg at 50% 50%, rgba(23, 107, 69, 0.28) 0deg, rgba(23, 107, 69, 0) 65deg, transparent 360deg)',
                  }}
                />

                {/* Dynamic Accuracy Ring shrinking smoothly as GPS fix sharpens */}
                <div
                  className="pointer-events-none absolute rounded-full border border-dashed transition-[width,height,border-color,background-color] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    width: `${accuracyRingPx}px`,
                    height: `${accuracyRingPx}px`,
                    borderColor:
                      accuracyTier === 'good'
                        ? 'rgba(34, 128, 83, 0.7)'
                        : accuracyTier === 'okay'
                          ? 'rgba(232, 184, 74, 0.75)'
                          : accuracyTier === 'poor'
                            ? 'rgba(239, 68, 68, 0.65)'
                            : 'rgba(34, 128, 83, 0.45)',
                    backgroundColor:
                      accuracyTier === 'good'
                        ? 'rgba(34, 128, 83, 0.08)'
                        : accuracyTier === 'okay'
                          ? 'rgba(232, 184, 74, 0.08)'
                          : accuracyTier === 'poor'
                            ? 'rgba(239, 68, 68, 0.08)'
                            : 'transparent',
                  }}
                />

                {/* Staggered Nearby Village Dots appearing one by one */}
                <span
                  className="absolute top-10 left-12 size-2.5 rounded-full bg-harvest-400 shadow-xs motion-safe:animate-[village-dot-appear_3.2s_ease-in-out_infinite]"
                  style={{ animationDelay: '400ms' }}
                  aria-hidden="true"
                />
                <span
                  className="absolute top-14 right-11 size-2 rounded-full bg-leaf-500 shadow-xs motion-safe:animate-[village-dot-appear_3.2s_ease-in-out_infinite]"
                  style={{ animationDelay: '1200ms' }}
                  aria-hidden="true"
                />
                <span
                  className="absolute bottom-12 right-14 size-2.5 rounded-full bg-harvest-500 shadow-xs motion-safe:animate-[village-dot-appear_3.2s_ease-in-out_infinite]"
                  style={{ animationDelay: '2000ms' }}
                  aria-hidden="true"
                />
                <span
                  className="absolute bottom-14 left-10 size-2 rounded-full bg-leaf-600 shadow-xs motion-safe:animate-[village-dot-appear_3.2s_ease-in-out_infinite]"
                  style={{ animationDelay: '2800ms' }}
                  aria-hidden="true"
                />
                <span
                  className="absolute top-24 left-7 size-1.5 rounded-full bg-leaf-400 shadow-xs motion-safe:animate-[village-dot-appear_3.2s_ease-in-out_infinite]"
                  style={{ animationDelay: '3600ms' }}
                  aria-hidden="true"
                />

                {/* Center Beacon Disk with Elevation & Shadow */}
                <div className="relative flex items-center justify-center z-10">
                  {/* Simulated Ground Shadow that expands and contracts */}
                  <span
                    className="absolute -bottom-4 size-8 rounded-full bg-leaf-950/60 blur-xs motion-safe:animate-[pin-shadow_2.4s_ease-in-out_infinite]"
                    aria-hidden="true"
                  />

                  {/* Floating GPS Teardrop Pin */}
                  <div className="motion-safe:animate-[pin-float_2.4s_ease-in-out_infinite] flex flex-col items-center">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-leaf-700 to-leaf-900 text-white shadow-lift ring-4 ring-leaf-600/30">
                      <Navigation2 className="size-5 text-harvest-300" aria-hidden="true" />
                    </div>
                    <div className="size-2 rounded-full bg-leaf-800 -mt-1" />
                  </div>
                </div>
              </div>

              {/* Status & Accuracy Feedback */}
              <div className="mt-5 flex flex-col items-center gap-2">
                {/* Live GPS / Accuracy Badge */}
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-bold transition-colors duration-300 ${
                    accuracyTier === 'good'
                      ? 'border-leaf-500/50 bg-leaf-950/80 text-leaf-200'
                      : accuracyTier === 'okay'
                        ? 'border-harvest-500/50 bg-harvest-950/80 text-harvest-200'
                        : accuracyTier === 'poor'
                          ? 'border-clay-500/50 bg-clay-950/80 text-clay-200'
                          : 'border-leaf-600/50 bg-leaf-950/80 text-leaf-200'
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
                      accuracyTier === 'good'
                        ? 'bg-leaf-500 animate-pulse'
                        : accuracyTier === 'okay'
                          ? 'bg-harvest-500 animate-pulse'
                          : accuracyTier === 'poor'
                            ? 'bg-clay-500 animate-pulse'
                            : 'bg-leaf-500 animate-pulse'
                    }`}
                    aria-hidden="true"
                  />
                  <span>
                    {accuracy != null
                      ? `Accuracy ±${Math.round(accuracy)} m`
                      : t('locModal.gpsActive')}
                  </span>
                </div>

                {/* Status Text Fading Smoothly Between Steps */}
                <div aria-live="polite" className="h-5 flex items-center justify-center">
                  <p
                    key={statusIndex}
                    className="text-xs font-semibold tracking-wide text-leaf-200 motion-safe:animate-[status-fade_2200ms_ease-in-out_both]"
                  >
                    {(SEARCH_STATUS_STEPS[language] || SEARCH_STATUS_STEPS.en)[statusIndex]}
                  </p>
                </div>

                {/* Smooth Filling Progress Bar */}
                <div
                  className="mt-1 w-48 sm:w-56 h-1 rounded-full bg-leaf-950/90 border border-leaf-800/50 overflow-hidden"
                  role="progressbar"
                  aria-label="Detection progress"
                >
                  <div className="h-full rounded-full bg-gradient-to-r from-leaf-500 via-harvest-400 to-leaf-600 motion-safe:animate-[radar-progress_9s_cubic-bezier(0.1,0.5,0.2,1)_forwards]" />
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STATE 2: SUCCESS (Location Resolved & Reviewable)              */}
          {/* ------------------------------------------------------------- */}
          {modalState === 'success' && (
            <div className="py-4 space-y-4">
              {/* Visual Success Indicator with Spring Bounce, Ring Burst, and Confetti Dots */}
              <div className="relative flex items-center justify-center py-2">
                {/* Short Ring Burst */}
                <div
                  className="pointer-events-none absolute size-16 rounded-full border-2 border-leaf-300/80 motion-safe:animate-[ring-burst_600ms_cubic-bezier(0.16,1,0.3,1)_both]"
                  aria-hidden="true"
                />

                {/* Confetti Dots Burst */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <span
                    className="confetti-particle absolute size-2 rounded-full bg-leaf-500 motion-safe:animate-[confetti-burst_650ms_cubic-bezier(0.16,1,0.3,1)_both]"
                    style={{ '--confetti-xy': 'translate(30px, -24px)' } as React.CSSProperties}
                  />
                  <span
                    className="confetti-particle absolute size-1.5 rounded-full bg-harvest-400 motion-safe:animate-[confetti-burst_650ms_cubic-bezier(0.16,1,0.3,1)_both]"
                    style={{ '--confetti-xy': 'translate(-32px, -22px)' } as React.CSSProperties}
                  />
                  <span
                    className="confetti-particle absolute size-2 rounded-full bg-leaf-400 motion-safe:animate-[confetti-burst_650ms_cubic-bezier(0.16,1,0.3,1)_both]"
                    style={{ '--confetti-xy': 'translate(32px, 18px)' } as React.CSSProperties}
                  />
                  <span
                    className="confetti-particle absolute size-1.5 rounded-full bg-harvest-500 motion-safe:animate-[confetti-burst_650ms_cubic-bezier(0.16,1,0.3,1)_both]"
                    style={{ '--confetti-xy': 'translate(-28px, 20px)' } as React.CSSProperties}
                  />
                  <span
                    className="confetti-particle absolute size-2 rounded-full bg-leaf-300 motion-safe:animate-[confetti-burst_650ms_cubic-bezier(0.16,1,0.3,1)_both]"
                    style={{ '--confetti-xy': 'translate(0px, -36px)' } as React.CSSProperties}
                  />
                  <span
                    className="confetti-particle absolute size-1.5 rounded-full bg-harvest-300 motion-safe:animate-[confetti-burst_650ms_cubic-bezier(0.16,1,0.3,1)_both]"
                    style={{ '--confetti-xy': 'translate(0px, 34px)' } as React.CSSProperties}
                  />
                  <span
                    className="confetti-particle absolute size-2 rounded-full bg-leaf-600 motion-safe:animate-[confetti-burst_650ms_cubic-bezier(0.16,1,0.3,1)_both]"
                    style={{ '--confetti-xy': 'translate(22px, 30px)' } as React.CSSProperties}
                  />
                  <span
                    className="confetti-particle absolute size-1.5 rounded-full bg-harvest-600 motion-safe:animate-[confetti-burst_650ms_cubic-bezier(0.16,1,0.3,1)_both]"
                    style={{ '--confetti-xy': 'translate(-24px, -32px)' } as React.CSSProperties}
                  />
                </div>

                {/* Spring Bounce Check Circle */}
                <div className="relative flex size-15 items-center justify-center rounded-2xl bg-leaf-900/70 text-leaf-300 ring-8 ring-leaf-950/50 border border-leaf-700/70 shadow-soft motion-safe:animate-[check-bounce_520ms_cubic-bezier(0.34,1.56,0.64,1)_both]">
                  <CheckCircle2 className="size-8 stroke-[2.5]" aria-hidden="true" />
                </div>
              </div>

              {/* Location Details Card */}
              <div className="rounded-2xl border border-leaf-800/60 bg-leaf-950/70 backdrop-blur-xs p-4.5 sm:p-5 motion-safe:animate-[content-slide-up_450ms_cubic-bezier(0.16,1,0.3,1)_120ms_both]">
                <div className="flex items-start gap-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-leaf-700 text-white shadow-soft">
                    <MapPin className="size-5" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-cream-300">
                      {t('locModal.villageLabel')}
                    </span>

                    <h3 className="font-display text-lg sm:text-xl font-extrabold text-white truncate mt-0.5">
                      {customVillage || detectedVillage || t('ui.nearby')}
                    </h3>

                    {(detectedDistrict || detectedState) && (
                      <p className="text-xs sm:text-sm font-medium text-cream-200 mt-1 truncate">
                        {[detectedDistrict, detectedState].filter(Boolean).join(', ')}
                      </p>
                    )}

                    {typeof accuracy === 'number' && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-leaf-900/90 border border-leaf-700 px-2.5 py-0.5 text-[11px] font-semibold text-leaf-200 shadow-2xs">
                        <Compass className="size-3 text-leaf-400" aria-hidden="true" />
                        <span>{t('locModal.accuracy', { meters: Math.round(accuracy) })}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 motion-safe:animate-[content-slide-up_450ms_cubic-bezier(0.16,1,0.3,1)_200ms_both]">
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={handleConfirm}
                  className="min-h-12 text-base font-bold shadow-soft"
                >
                  {t('locModal.confirm')}
                </Button>

                <Button
                  variant="outline"
                  fullWidth
                  size="md"
                  onClick={handleEnterManually}
                  className="min-h-11 border-cream-200/30 text-white hover:bg-white/10 hover:border-cream-200/50"
                >
                  {t('locModal.changeLocation')}
                </Button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STATE 3: PERMISSION DENIED                                    */}
          {/* ------------------------------------------------------------- */}
          {modalState === 'denied' && (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-950/60 text-amber-300 ring-8 ring-amber-950/30 border border-amber-800/60 motion-safe:animate-[soft-shake_400ms_ease-in-out_both]">
                  <MapPinOff className="size-7" aria-hidden="true" />
                </div>
              </div>

              {/* Step-by-step permission instructions */}
              <div className="rounded-2xl border border-amber-800/60 bg-amber-950/50 p-4 text-xs text-amber-200 space-y-2 motion-safe:animate-[content-slide-up_350ms_cubic-bezier(0.16,1,0.3,1)_80ms_both]">
                <p className="font-bold text-amber-200">{t('locModal.howToEnable')}</p>
                <ul className="space-y-1 text-amber-100/90 font-medium">
                  <li>{t('locModal.enableStep1')}</li>
                  <li>{t('locModal.enableStep2')}</li>
                  <li>{t('locModal.enableStep3')}</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 motion-safe:animate-[content-slide-up_350ms_cubic-bezier(0.16,1,0.3,1)_160ms_both]">
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={startDetection}
                  icon={<RefreshCw className="size-4" />}
                  className="min-h-12 text-base font-bold shadow-soft"
                >
                  {t('locModal.tryAgain')}
                </Button>

                <Button
                  variant="outline"
                  fullWidth
                  size="md"
                  onClick={handleEnterManually}
                  className="min-h-11 border-cream-200/30 text-white hover:bg-white/10 hover:border-cream-200/50"
                >
                  {t('locModal.enterManually')}
                </Button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STATE 4: TIMEOUT                                              */}
          {/* ------------------------------------------------------------- */}
          {modalState === 'timeout' && (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-harvest-950/60 text-harvest-300 ring-8 ring-harvest-950/30 border border-harvest-800/60 motion-safe:animate-[soft-shake_400ms_ease-in-out_both]">
                  <Compass className="size-7 animate-pulse" aria-hidden="true" />
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 motion-safe:animate-[content-slide-up_350ms_cubic-bezier(0.16,1,0.3,1)_120ms_both]">
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={startDetection}
                  icon={<RefreshCw className="size-4" />}
                  className="min-h-12 text-base font-bold shadow-soft"
                >
                  {t('locModal.tryAgain')}
                </Button>

                <Button
                  variant="outline"
                  fullWidth
                  size="md"
                  onClick={handleEnterManually}
                  className="min-h-11 border-cream-200/30 text-white hover:bg-white/10 hover:border-cream-200/50"
                >
                  {t('locModal.enterManually')}
                </Button>

                <Button
                  variant="ghost"
                  fullWidth
                  size="sm"
                  onClick={onClose}
                  className="text-cream-200 hover:text-white hover:bg-white/10"
                >
                  {t('locModal.cancel')}
                </Button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STATE 5: UNAVAILABLE                                          */}
          {/* ------------------------------------------------------------- */}
          {modalState === 'unavailable' && (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-leaf-950/60 text-cream-200 ring-8 ring-leaf-950/30 border border-leaf-800/60 motion-safe:animate-[soft-shake_400ms_ease-in-out_both]">
                  <AlertCircle className="size-7" aria-hidden="true" />
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 motion-safe:animate-[content-slide-up_350ms_cubic-bezier(0.16,1,0.3,1)_120ms_both]">
                <Button
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={handleEnterManually}
                  className="min-h-12 text-base font-bold shadow-soft"
                >
                  {t('locModal.enterManually')}
                </Button>

                <Button
                  variant="outline"
                  fullWidth
                  size="md"
                  onClick={startDetection}
                  icon={<RefreshCw className="size-4" />}
                  className="min-h-11 border-cream-200/30 text-white hover:bg-white/10 hover:border-cream-200/50"
                >
                  {t('locModal.tryAgain')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
