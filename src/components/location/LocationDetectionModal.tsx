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

  const activeAbortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<number | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)

  const cleanup = () => {
    if (activeAbortRef.current) {
      activeAbortRef.current.abort()
      activeAbortRef.current = null
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  const startDetection = useCallback(() => {
    cleanup()
    setModalState('detecting')
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

    // Timeout watchdog
    timerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) {
        setModalState('timeout')
        cleanup()
      }
    }, timeoutMs)

    let bestFix: { coords: Coordinates; accuracy: number } | null = null

    const handlePosition = async (pos: GeolocationPosition) => {
      const acc = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 500
      const currentCoords: Coordinates = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }

      if (!bestFix || acc < bestFix.accuracy) {
        bestFix = { coords: currentCoords, accuracy: acc }
      }

      // If we have a usable fix, resolve reverse-geocoding
      if (!isMountedRef.current) return
      setCoords(bestFix.coords)
      setAccuracy(bestFix.accuracy)

      cleanup()

      try {
        const geocoded = await reverseGeocode(bestFix.coords, language, controller.signal)
        if (!isMountedRef.current) return

        if (geocoded) {
          const v = geocoded.village || ''
          const d = geocoded.district || ''
          const s = geocoded.state || ''
          setDetectedVillage(v)
          setDetectedDistrict(d)
          setDetectedState(s)
          setCustomVillage(v)
        } else {
          // Coords were found, but geocoding returned no match
          setDetectedVillage('')
          setDetectedDistrict('')
          setDetectedState('')
          setCustomVillage('')
        }
        setModalState('success')
      } catch {
        if (isMountedRef.current) {
          setModalState('success')
        }
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      if (!isMountedRef.current) return
      cleanup()
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
      setModalState('unavailable')
    }
  }, [language, timeoutMs])

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
  }, [open, startDetection])

  // Accessibility: Focus trap & Escape key
  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
      prevActive?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const handleConfirm = () => {
    if (!coords) return
    const finalVillage = (customVillage || detectedVillage).trim()
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

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-xs transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:animate-in motion-safe:fade-in sm:items-center sm:p-4"
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
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-cream-200 bg-white p-6 shadow-lift transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:animate-[apple-sheet-in_320ms_cubic-bezier(0.16,1,0.3,1)] sm:rounded-3xl sm:p-7"
      >
        {/* Header with Title and Close Button */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
              {modalState === 'detecting' && t('locModal.findingTitle')}
              {modalState === 'success' && t('locModal.foundTitle')}
              {modalState === 'denied' && t('locModal.deniedTitle')}
              {modalState === 'timeout' && t('locModal.timeoutTitle')}
              {modalState === 'unavailable' && t('farmer.locationUnsupported')}
            </h2>
            <p id={descId} className="mt-1 text-xs sm:text-sm text-ink-muted leading-relaxed">
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
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-cream-100 hover:text-ink active:scale-95 cursor-pointer"
            aria-label={t('common.cancel')}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STATE 1: DETECTING (Animated Radar GPS Tech Illustration)     */}
        {/* ------------------------------------------------------------- */}
        {modalState === 'detecting' && (
          <div className="py-6 sm:py-7 flex flex-col items-center">
            {/* Circular Radar Canvas */}
            <div className="relative flex size-52 sm:size-60 items-center justify-center rounded-full bg-gradient-to-b from-cream-100/90 via-leaf-50/50 to-cream-100/90 border border-leaf-200/80 shadow-inner overflow-hidden">
              {/* Concentric rings */}
              <div className="absolute size-[86%] rounded-full border border-dashed border-leaf-300/40" />
              <div className="absolute size-[58%] rounded-full border border-leaf-400/40" />
              <div className="absolute size-[32%] rounded-full border border-leaf-500/50 bg-leaf-50/40" />

              {/* Lat/Long Crosshair axes */}
              <div className="absolute h-px w-full bg-leaf-200/60" />
              <div className="absolute h-full w-px bg-leaf-200/60" />

              {/* Rotating Radar Sweep Cone */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full motion-safe:animate-[radar-sweep_3.5s_linear_infinite]"
                style={{
                  background:
                    'conic-gradient(from 0deg at 50% 50%, rgba(23, 107, 69, 0.22) 0deg, rgba(23, 107, 69, 0) 65deg, transparent 360deg)',
                }}
              />

              {/* Expanding Ripple Waves */}
              <div className="pointer-events-none absolute size-28 rounded-full border border-leaf-500/60 motion-safe:animate-[radar-ripple_2.8s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
              <div
                className="pointer-events-none absolute size-28 rounded-full border border-leaf-500/50 motion-safe:animate-[radar-ripple_2.8s_cubic-bezier(0.16,1,0.3,1)_infinite]"
                style={{ animationDelay: '900ms' }}
              />
              <div
                className="pointer-events-none absolute size-28 rounded-full border border-leaf-500/40 motion-safe:animate-[radar-ripple_2.8s_cubic-bezier(0.16,1,0.3,1)_infinite]"
                style={{ animationDelay: '1800ms' }}
              />

              {/* Surrounding Location Dots (Simulating nearby village points) */}
              <span
                className="absolute top-10 left-12 size-2.5 rounded-full bg-harvest-400 shadow-xs motion-safe:animate-[satellite-pulse_2.2s_ease-in-out_infinite]"
                style={{ animationDelay: '300ms' }}
                aria-hidden="true"
              />
              <span
                className="absolute bottom-11 right-12 size-2 rounded-full bg-leaf-600 shadow-xs motion-safe:animate-[satellite-pulse_2.2s_ease-in-out_infinite]"
                style={{ animationDelay: '800ms' }}
                aria-hidden="true"
              />
              <span
                className="absolute top-14 right-10 size-1.5 rounded-full bg-leaf-700 shadow-xs motion-safe:animate-[satellite-pulse_2.2s_ease-in-out_infinite]"
                style={{ animationDelay: '1400ms' }}
                aria-hidden="true"
              />
              <span
                className="absolute bottom-14 left-10 size-2 rounded-full bg-harvest-500 shadow-xs motion-safe:animate-[satellite-pulse_2.2s_ease-in-out_infinite]"
                style={{ animationDelay: '1900ms' }}
                aria-hidden="true"
              />

              {/* Center Beacon Disk with Elevation & Shadow */}
              <div className="relative flex items-center justify-center z-10">
                {/* Simulated 3D Ground Shadow */}
                <span
                  className="absolute -bottom-4 size-8 rounded-full bg-leaf-950/20 blur-xs motion-safe:animate-[pin-shadow_2.4s_ease-in-out_infinite]"
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

            {/* Live GPS Status Pill */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-leaf-50 border border-leaf-200/80 px-3.5 py-1 text-xs font-bold text-leaf-800">
              <span className="size-2 rounded-full bg-leaf-600 animate-pulse" aria-hidden="true" />
              <span>{t('locModal.gpsActive')}</span>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 2: SUCCESS (Location Resolved & Reviewable)              */}
        {/* ------------------------------------------------------------- */}
        {modalState === 'success' && (
          <div className="py-4 space-y-4 motion-safe:animate-[success-pop_380ms_cubic-bezier(0.16,1,0.3,1)]">
            {/* Visual Success Indicator */}
            <div className="flex items-center justify-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-800 ring-8 ring-leaf-50">
                <CheckCircle2 className="size-7 stroke-[2.5]" aria-hidden="true" />
              </div>
            </div>

            {/* Location Details Card */}
            <div className="rounded-2xl border border-cream-200 bg-cream-50/70 p-4.5 sm:p-5">
              <div className="flex items-start gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-leaf-700 text-white shadow-soft">
                  <MapPin className="size-5" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    {t('locModal.villageLabel')}
                  </span>

                  {detectedVillage ? (
                    <h3 className="font-display text-lg sm:text-xl font-extrabold text-ink truncate mt-0.5">
                      {detectedVillage}
                    </h3>
                  ) : (
                    <div className="mt-1">
                      <p className="text-xs font-semibold text-harvest-700">
                        {t('locModal.villageNotFound')}
                      </p>
                      <input
                        type="text"
                        value={customVillage}
                        onChange={(e) => setCustomVillage(e.target.value)}
                        placeholder={t('locModal.villagePlaceholder')}
                        className="mt-1.5 w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm font-semibold text-ink placeholder:text-ink-muted focus:border-leaf-700 focus:outline-none focus:ring-2 focus:ring-leaf-700/15"
                      />
                    </div>
                  )}

                  {(detectedDistrict || detectedState) && (
                    <p className="text-xs sm:text-sm font-medium text-ink-muted mt-1 truncate">
                      {[detectedDistrict, detectedState].filter(Boolean).join(', ')}
                    </p>
                  )}

                  {typeof accuracy === 'number' && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white border border-cream-200 px-2.5 py-0.5 text-[11px] font-semibold text-leaf-800 shadow-2xs">
                      <Compass className="size-3 text-leaf-600" aria-hidden="true" />
                      <span>{t('locModal.accuracy', { meters: Math.round(accuracy) })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
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
                className="min-h-11 border-cream-200 text-ink hover:bg-cream-100/70"
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
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-8 ring-amber-50/50 border border-amber-200/60">
                <MapPinOff className="size-7" aria-hidden="true" />
              </div>
            </div>

            {/* Step-by-step permission instructions */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-950 space-y-2">
              <p className="font-bold text-amber-900">{t('locModal.howToEnable')}</p>
              <ul className="space-y-1 text-amber-800 font-medium">
                <li>{t('locModal.enableStep1')}</li>
                <li>{t('locModal.enableStep2')}</li>
                <li>{t('locModal.enableStep3')}</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
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
                className="min-h-11 border-cream-200 text-ink hover:bg-cream-100"
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
              <div className="flex size-14 items-center justify-center rounded-2xl bg-harvest-50 text-harvest-700 ring-8 ring-harvest-50/60 border border-harvest-200/80">
                <Compass className="size-7 animate-pulse" aria-hidden="true" />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
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
                className="min-h-11 border-cream-200 text-ink hover:bg-cream-100"
              >
                {t('locModal.enterManually')}
              </Button>

              <Button
                variant="ghost"
                fullWidth
                size="sm"
                onClick={onClose}
                className="text-ink-muted hover:text-ink"
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
              <div className="flex size-14 items-center justify-center rounded-2xl bg-cream-100 text-ink-muted ring-8 ring-cream-50 border border-cream-200">
                <AlertCircle className="size-7" aria-hidden="true" />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
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
                className="min-h-11 border-cream-200 text-ink hover:bg-cream-100"
              >
                {t('locModal.tryAgain')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
