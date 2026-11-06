import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  LocateFixed,
  MapPin,
  PhoneCall,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Tractor,
  Users,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { toast } from '../../lib/toast'
import { CROP_KEYS, MACHINE_TYPES } from '../../lib/constants'
import { normalizeWhitespace } from '../../lib/validation'
import type { FieldErrors } from '../../lib/validation'
import { distanceKm } from '../../lib/geo'
import { POOR_ACCURACY_M, useGeolocation } from '../../hooks/useGeolocation'
import { getMachineImageUrl, isMachineDeleted, searchMachines, subscribeToMachineDeletions } from '../../services/machines'
import { executeSmartSearch } from '../../services/smartSearch'
import { fetchPlatformStats, fetchLatestMachineActivity } from '../../services/platformStats'
import type { PlatformStats, LatestActivity } from '../../services/platformStats'
import { getBusyMachines } from '../../services/workStatus'
import { deduplicateMachines } from '../../services/store'
import { resolveVillageCoordinates, reverseGeocode } from '../../services/geocode'
import { searchPlaces } from '../../services/placeSearch'
import type { PlaceSuggestion } from '../../services/placeSearch'
import type { Coordinates, CropKey, MachineCard as MachineCardType } from '../../types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/Feedback'
import { Input, Select } from '../../components/ui/Input'
import { PlaceAutocomplete } from '../../components/ui/PlaceAutocomplete'
import { MachineCard } from '../../components/machine/MachineCard'
import { MachineCardSkeleton } from '../../components/ui/Skeleton'
import { CropIcon } from '../../components/crop/CropIcon'
import { CropPhotoDetector } from '../../components/crop/CropPhotoDetector'
import { CropPickerModal } from '../../components/crop/CropPickerModal'
import { CROP_CONFIGS } from '../../lib/cropConfig'
import { VoiceSearchButton } from '../../components/voice/VoiceSearchButton'
import type { MapMachine } from '../../components/map/LiveMap'

const LiveMap = lazy(() => import('../../components/map/LiveMap').then((m) => ({ default: m.LiveMap })))

function MapSkeleton({ className = 'h-72 sm:h-96' }: { className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center bg-gray-50/80 animate-pulse text-emerald-800 rounded-3xl ${className}`}
      aria-label="Loading interactive map"
    >
      <div className="flex flex-col items-center gap-2">
        <MapPin className="size-8 text-emerald-600/70 animate-bounce" />
        <span className="text-xs font-semibold text-gray-500">Loading interactive map...</span>
      </div>
    </div>
  )
}
import { machineTypeLabelKey } from '../../lib/labels'
import { KisanVoiceAssistant } from '../../components/voice/KisanVoiceAssistant'
import type { VoiceQueryResult } from '../../lib/voice'

interface SearchSnapshot {
  village: string
  crop: string
  machineType: string
  acreage: string
}

function formatRelativeTime(
  isoString?: string | null,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  if (!isoString) return ''
  try {
    const diffMs = Date.now() - new Date(isoString).getTime()
    if (Number.isNaN(diffMs)) return ''
    const diffSec = Math.max(0, Math.floor(diffMs / 1000))
    if (diffSec < 60) return t ? t('ui.justNow') : 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return t ? t('ui.minutesAgo', { n: diffMin }) : `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return t ? t('ui.hoursAgo', { n: diffHours }) : `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return t ? t('ui.yesterday') : 'Yesterday'
    if (diffDays < 7) return t ? t('ui.daysAgo', { n: diffDays }) : `${diffDays}d ago`
    return new Date(isoString).toLocaleDateString()
  } catch {
    return ''
  }
}

export function FarmerHomePage() {
  const { profile } = useAuth()
  const { t, language } = useI18n()
  const geo = useGeolocation()

  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null)
  const [latestActivity, setLatestActivity] = useState<LatestActivity | null>(null)

  // Defer non-critical statistics and latest activity until after main UI mounts and idle time
  useEffect(() => {
    let active = true
    let cancelIdle: (() => void) | null = null

    const loadDeferred = () => {
      void fetchPlatformStats().then((data) => {
        if (active && data) setPlatformStats(data)
      })
      void fetchLatestMachineActivity().then((data) => {
        if (active && data) setLatestActivity(data)
      })
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
        loadDeferred,
        { timeout: 2000 },
      )
      cancelIdle = () => {
        if ('cancelIdleCallback' in window) {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id)
        }
      }
    } else {
      const timer = setTimeout(loadDeferred, 800)
      cancelIdle = () => clearTimeout(timer)
    }

    return () => {
      active = false
      if (cancelIdle) cancelIdle()
    }
  }, [])

  // Always start completely blank
  const [village, setVillage] = useState('')
  const [district, setDistrict] = useState('')
  const [, setState] = useState('')
  // The place picked from the suggestion list, with its map position when known.
  const [picked, setPicked] = useState<{ name: string; coords: Coordinates | null } | null>(null)
  // "Nearest" is measured from live GPS first, otherwise from the place that was picked.
  const originCoords: Coordinates | null = geo.coordinates ?? picked?.coords ?? null
  const [crop, setCrop] = useState<string>('')
  const [acreage, setAcreage] = useState<string>('')
  const [machineType, setMachineType] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [searching, setSearching] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [detectedPlace, setDetectedPlace] = useState<{ place: string; district: string } | null>(null)
  const [locationWarning, setLocationWarning] = useState(false)
  const [searchError, setSearchError] = useState<TranslationKey | null>(null)
  const [isOfflineResults, setIsOfflineResults] = useState(false)
  const [results, setResults] = useState<MachineCardType[] | null>(null)
  const [busyMachines, setBusyMachines] = useState<Map<string, string | null>>(() => new Map())

  // Fetch busy-machine status ONLY after search results exist, avoiding useless mount requests
  useEffect(() => {
    if (!results || results.length === 0) return
    let active = true
    void getBusyMachines().then((map) => {
      if (active) setBusyMachines(map)
    })
    return () => {
      active = false
    }
  }, [results])
  const [snapshot, setSnapshot] = useState<SearchSnapshot | null>(null)
  const [smartSummary, setSmartSummary] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const searchCardRef = useRef<HTMLDivElement>(null)
  const villageInputRef = useRef<HTMLInputElement>(null)
  const [sortBy, setSortBy] = useState<'nearest' | 'cheapest'>('nearest')
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  const searchSequenceRef = useRef(0)
  const searchAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      searchAbortControllerRef.current?.abort()
    }
  }, [])

  const hasSearched = results !== null
  const parsedAcreage = parseFloat(acreage) > 0 ? parseFloat(acreage) : null

  const activeUserLocation =
    snapshot?.village || village || district || profile?.district || profile?.village || ''

  // Resolve effective district (explicitly entered or inferred from village)
  const effectiveDistrict = useMemo(() => {
    const rawDistrict = (district || detectedPlace?.district || '').trim().toLowerCase()
    if (rawDistrict) return rawDistrict

    const targetVillage = (snapshot?.village || village || '').trim().toLowerCase()
    if (!targetVillage || !results) return ''

    const matchedMachine = results.find((m) => {
      const v = (m.village || '').trim().toLowerCase()
      const svs = Array.isArray(m.service_villages)
        ? m.service_villages.map((s) => (typeof s === 'string' ? s.toLowerCase() : ''))
        : []
      const d = (m.district || '').trim().toLowerCase()
      return v === targetVillage || svs.includes(targetVillage) || d === targetVillage
    })

    return matchedMachine?.district ? matchedMachine.district.trim().toLowerCase() : ''
  }, [district, detectedPlace, snapshot, village, results])

  // Sort search results strictly by proximity:
  // Mode A (GPS Active): GPS distance (closest in km first)
  // Mode B (Manual Typing - No GPS):
  //   Level 1: In Your Village (0 to 5 km) - exact village or service village match
  //   Level 2: Same District (~10 to 40 km) - same revenue district match
  const sortedResults = useMemo(() => {
    if (!results) return null
    const deduped = deduplicateMachines(results)
    const targetVillage = (snapshot?.village || village || '').trim().toLowerCase()

    const getTier = (m: MachineCardType): number => {
      const mVillage = (m.village || '').trim().toLowerCase()
      const mVillages = Array.isArray(m.service_villages)
        ? m.service_villages.map((v) => (typeof v === 'string' ? v.toLowerCase() : ''))
        : []

      // Mode B - Level 1: In Your Village (0 to 5 km)
      if (
        Boolean(targetVillage) &&
        (mVillage === targetVillage ||
          mVillages.includes(targetVillage) ||
          (targetVillage.length >= 3 && mVillage.includes(targetVillage)))
      ) {
        return 1
      }

      // Mode B - Level 2: Same District (~10 to 40 km)
      return 2
    }

    return [...deduped].sort((a, b) => {
      // 1. Proximity by GPS distance (closest in km first) if GPS is active
      if (originCoords) {
        const da =
          a.latitude !== null && a.longitude !== null
            ? distanceKm(originCoords, { latitude: a.latitude, longitude: a.longitude })
            : Number.POSITIVE_INFINITY
        const db =
          b.latitude !== null && b.longitude !== null
            ? distanceKm(originCoords, { latitude: b.latitude, longitude: b.longitude })
            : Number.POSITIVE_INFINITY
        if (da !== db) return da - db
      }

      // 2. Mode B Proximity Tier: Level 1 (In Village) -> Level 2 (Same District)
      const tierA = getTier(a)
      const tierB = getTier(b)
      if (tierA !== tierB) return tierA - tierB

      return 0
    })
  }, [results, originCoords, snapshot, village])

  const displayResults = useMemo(() => {
    if (!sortedResults) return null
    if (sortBy === 'cheapest') {
      const unitRank = (unit?: string) => {
        if (!unit || unit === 'per_acre') return 1
        if (unit === 'per_hour') return 2
        if (unit === 'per_day') return 3
        return 4
      }
      return [...sortedResults].sort((a, b) => {
        const rankA = unitRank(a.pricing_unit)
        const rankB = unitRank(b.pricing_unit)
        if (rankA !== rankB) return rankA - rankB
        return a.price_per_acre - b.price_per_acre
      })
    }
    return sortedResults
  }, [sortedResults, sortBy])

  const distanceFor = (machine: MachineCardType): number | null => {
    if (!originCoords || machine.latitude === null || machine.longitude === null) return null
    return distanceKm(originCoords, {
      latitude: machine.latitude,
      longitude: machine.longitude,
    })
  }

  const runSearch = async (
    overrideCrop?: string,
    overrideVillage?: string,
    overrideDistrict?: string,
  ) => {
    const seq = ++searchSequenceRef.current
    searchAbortControllerRef.current?.abort()
    const controller = new AbortController()
    searchAbortControllerRef.current = controller

    setErrors({})
    setSearchError(null)
    setIsOfflineResults(false)
    setSearching(true)
    const targetVillage = overrideVillage !== undefined ? overrideVillage : village
    const targetDistrict = overrideDistrict !== undefined ? overrideDistrict : district
    const cleanedVillage = normalizeWhitespace(targetVillage)
    const cleanedDistrict = normalizeWhitespace(targetDistrict)
    const activeCrop = overrideCrop !== undefined ? overrideCrop : crop

    try {
      const found = await searchMachines({
        village: cleanedVillage || undefined,
        district: cleanedDistrict || undefined,
        crop: activeCrop || undefined,
        machineType: machineType || undefined,
        limit: 48,
        signal: controller.signal,
      })
      if (seq !== searchSequenceRef.current) return

      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
      setIsOfflineResults(isOffline && (found || []).length > 0)
      setResults((found || []).filter((m) => m && m.is_active !== false))
      setSnapshot({
        village: cleanedVillage || cleanedDistrict || t('ui.nearby'),
        crop: activeCrop,
        machineType,
        acreage,
      })
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      }, 60)
    } catch (caught: unknown) {
      if (seq !== searchSequenceRef.current || controller.signal.aborted) return
      logError('farmer.search', caught)
      const key = mapErrorToKey(caught, 'farmer.searchError')
      setSearchError(key)
      toast.error(t(key))
    } finally {
      if (seq === searchSequenceRef.current) {
        setSearching(false)
      }
    }
  }

  const handleSmartSearch = async (rawQuery: string) => {
    const seq = ++searchSequenceRef.current
    searchAbortControllerRef.current?.abort()
    const controller = new AbortController()
    searchAbortControllerRef.current = controller

    setSearching(true)
    setSearchError(null)
    try {
      const res = await executeSmartSearch(rawQuery, controller.signal)
      if (seq !== searchSequenceRef.current) return

      setResults(res.machines)
      setSmartSummary(res.summaryKey ? t(res.summaryKey, res.summaryParams) : res.summary)
      if (res.detectedLocation) {
        setVillage(res.detectedLocation)
      }
      if (res.detectedCrop) {
        setCrop(res.detectedCrop)
      }
      setSnapshot({
        village: res.detectedLocation || rawQuery,
        crop: res.detectedCrop || '',
        machineType: res.detectedMachineType || '',
        acreage: '',
      })
      setTimeout(() => {
        resultsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      }, 150)
    } catch (caught: unknown) {
      if (seq !== searchSequenceRef.current || controller.signal.aborted) return
      logError('farmer.smartSearch', caught)
      const errKey = mapErrorToKey(caught)
      setSearchError(errKey)
      toast.error(t(errKey))
    } finally {
      if (seq === searchSequenceRef.current) {
        setSearching(false)
      }
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
      const qParam = params.get('q')
      if (qParam) {
        void handleSmartSearch(qParam)
      } else if (params.get('section') === 'crops') {
        window.setTimeout(() => {
          document.getElementById('crop-selection-section')?.scrollIntoView({ behavior: 'smooth' })
        }, 200)
      }

      const onSmartSearchEvent = (e: Event) => {
        const detail = (e as CustomEvent<{ query: string }>).detail
        if (detail?.query) {
          void handleSmartSearch(detail.query)
        }
      }
      window.addEventListener('harvest-smart-search', onSmartSearchEvent)
      return () => window.removeEventListener('harvest-smart-search', onSmartSearchEvent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cross-device synchronization & Realtime deletion listener
  useEffect(() => {
    // 1. Supabase Realtime table changes
    const unsubscribe = subscribeToMachineDeletions((deletedId) => {
      setResults((prev) => (prev ? prev.filter((m) => m.id !== deletedId) : null))
    })

    // 2. Window focus & visibility revalidation: re-filter when returning to the tab
    const handleRevalidate = () => {
      setResults((prev) => (prev ? prev.filter((m) => !isMachineDeleted(m.id)) : null))
    }

    window.addEventListener('focus', handleRevalidate)
    document.addEventListener('visibilitychange', handleRevalidate)

    return () => {
      unsubscribe()
      window.removeEventListener('focus', handleRevalidate)
      document.removeEventListener('visibilitychange', handleRevalidate)
    }
  }, [])

  const handleVoiceResult = (result: VoiceQueryResult) => {
    if (result.village) setVillage(result.village)
    if (result.crop) setCrop(result.crop)
    if (result.acreage) setAcreage(result.acreage)

    void runSearch(result.crop, result.village)
  }

  // Person tapped a place in the suggestion list (Uber / Rapido style).
  const handlePlaceSelect = (place: PlaceSuggestion) => {
    setDetectedPlace(null)
    geo.clear()
    setVillage(place.village)
    setDistrict(place.district)
    setState(place.state.toLowerCase())
    setPicked({ name: place.village, coords: place.coords })
    setErrors({})
    void runSearch(crop, place.village, place.district)
  }

  // Person spoke a place name into the village box: find the real place and search it.
  const handleVoicePlace = async (guesses: string[]) => {
    setDetectedPlace(null)
    setPicked(null)
    setDistrict('')
    setState('')
    // Speech can mishear, so try each guess until one matches a real place.
    for (const guess of guesses) {
      try {
        const [top] = await searchPlaces(guess, language, undefined, originCoords)
        if (top) {
          handlePlaceSelect(top)
          return
        }
      } catch {
        // Try the next guess.
      }
    }
    const typed = normalizeWhitespace(guesses[0] ?? '')
    if (typed) void runSearch(crop, typed, '')
  }

  const submitTypedSearch = async () => {
    const typed = normalizeWhitespace(village)
    // Typed a name but did not pick from the list: use the best matching place
    // instead of searching the raw text (e.g. "Bengaluru" becomes the real city).
    if (typed.length >= 2 && !picked && !geo.coordinates && !detectedPlace && !district.trim()) {
      try {
        const [top] = await searchPlaces(typed, language, undefined, originCoords)
        if (top && top.village.toLowerCase().startsWith(typed.toLowerCase())) {
          handlePlaceSelect(top)
          return
        }
      } catch {
        // Fall back to searching the typed text.
      }
    }
    void runSearch()
  }

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    if (!village.trim() && !district.trim() && !crop.trim() && !machineType.trim() && !geo.coordinates) {
      setErrors({ village: 'validation.required' })
      return
    }
    void submitTypedSearch()
  }

  const [cropPickerOpen, setCropPickerOpen] = useState(false)

  const handleQuickCrop = (selectedKey: string) => {
    const nextCrop = crop === selectedKey ? '' : selectedKey
    setCrop(nextCrop)
    if (village.trim() || district.trim() || geo.coordinates) {
      void runSearch(nextCrop)
    }
  }

  const clearSearch = () => {
    searchSequenceRef.current++
    searchAbortControllerRef.current?.abort()
    searchAbortControllerRef.current = null
    setSearching(false)
    setIsOfflineResults(false)
    setResults(null)
    setSnapshot(null)
    setSmartSummary(null)
    setSearchError(null)
    setVillage('')
    setDistrict('')
    setState('')
    setCrop('')
    setAcreage('')
    setMachineType('')
    setErrors({})
    setDetectedPlace(null)
    setPicked(null)
  }

  // Keep detected place synchronized when the user switches interface language
  useEffect(() => {
    if (geo.coordinates && detectedPlace) {
      let active = true
      void reverseGeocode(geo.coordinates, language).then((geocoded) => {
        if (active && geocoded) {
          if (geocoded.village) setVillage(geocoded.village)
          if (geocoded.district) setDistrict(geocoded.district)
        }
      })
      return () => {
        active = false
      }
    }
  }, [geo.coordinates, detectedPlace, language])

  const locateSequenceRef = useRef(0)
  const locateAbortControllerRef = useRef<AbortController | null>(null)

  const locate = async () => {
    const seq = ++locateSequenceRef.current
    locateAbortControllerRef.current?.abort()
    const controller = new AbortController()
    locateAbortControllerRef.current = controller

    // Forget every earlier place so an old result can never be reused.
    setDetectedPlace(null)
    setPicked(null)
    setVillage('')
    setDistrict('')
    setState('')
    setLocationWarning(false)
    setGeocoding(true)
    try {
      const fix = await geo.request()
      if (!fix || seq !== locateSequenceRef.current) return

      const coords = { latitude: fix.latitude, longitude: fix.longitude }
      setPicked({ name: t('ui.nearby'), coords })

      // A very coarse fix (Wi-Fi/IP based) would show the wrong area, so ask the
      // person to check it instead of searching with it.
      const poor = fix.accuracy > POOR_ACCURACY_M
      setLocationWarning(poor)

      const geocoded = await reverseGeocode(coords, language, controller.signal)
      if (seq !== locateSequenceRef.current) return

      if (geocoded) {
        setVillage(geocoded.village || '')
        setDistrict(geocoded.district || '')
        setState(geocoded.state || '')
        setDetectedPlace({
          place: geocoded.village,
          district: geocoded.district,
        })
        setPicked({ name: geocoded.village, coords })

        // Auto-scan only when the position is trustworthy.
        if (!poor) {
          void runSearch(crop, geocoded.village, geocoded.district)
        }
      } else {
        // Geocoding timed out or failed, but GPS coords were found:
        // Do not block the farmer! Provide a generic location found state and search.
        const fallbackPlace = t('ui.nearby')
        setVillage(fallbackPlace)
        setDetectedPlace({
          place: fallbackPlace,
          district: '',
        })
        setPicked({ name: fallbackPlace, coords })
        if (!poor) {
          void runSearch(crop, '', '')
        }
      }
    } finally {
      if (seq === locateSequenceRef.current) {
        setGeocoding(false)
      }
    }
  }

  const mapMachines = useMemo<MapMachine[]>(() => {
    if (!hasSearched || !sortedResults) return []
    return sortedResults.flatMap((machine) =>
      machine.latitude !== null && machine.longitude !== null
        ? [
            {
              id: machine.id,
              position: { latitude: machine.latitude, longitude: machine.longitude },
              title: t(machineTypeLabelKey(machine.machine_type)),
              subtitle: machine.model ?? machine.village,
            },
          ]
        : [],
    )
  }, [hasSearched, sortedResults, t])

  const name = profile?.full_name?.split(' ')[0] || t('farmer.fallbackName')

  return (
    <div className="space-y-6">
      {/* 1. Hero Banner Matching Reference Mockup */}
      <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0a2312] via-[#0f341b] to-[#184e2a] p-6 sm:p-8 text-white shadow-xl border border-white/10">
        {/* Right-Side Indian Farmer Portrait with Smooth Edge Blending */}
        <div
          className="hr-hero-wrap farmer-hero-mask pointer-events-none absolute bottom-0 right-0 z-0 h-full w-[48%] sm:w-[42%] md:w-[38%] select-none overflow-hidden"
          aria-hidden="true"
        >
          <img
            src="/hero/farmer.webp"
            alt=""
            width={400}
            height={400}
            loading="eager"
            fetchPriority="high"
            className="h-full w-full object-cover object-[center_top]"
            onError={(e) => {
              const target = e.currentTarget
              target.onerror = null
              if (!target.src.endsWith('/images/farmer-hero.webp')) {
                target.src = '/images/farmer-hero.webp'
              }
            }}
          />
          {/* Edge blending is done with a CSS mask (see .farmer-hero-mask) so no colour strip shows */}

        </div>

        {/* Left-Side Content */}
        <div className="relative z-10 max-w-full sm:max-w-[65%]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1 text-xs font-semibold text-emerald-200 backdrop-blur-md">
            <Tractor className="size-3.5 text-emerald-400" aria-hidden="true" />
            <span>{t('ui.heroBadge')}</span>
          </div>

          <h1 className="mt-3 text-2xl sm:text-4xl font-black tracking-tight text-white">
            {t('ui.namaste')} <span className="text-[#38e08a] uppercase">{name}</span>
          </h1>

          <p className="mt-1 text-sm sm:text-base text-emerald-100/90 font-normal">
            {t('farmer.subtitle')}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#102d18]/85 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span>{t('ui.verified')}</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#102d18]/85 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
              <PhoneCall className="size-3.5 text-emerald-400" />
              <span>{t('ui.directCall')}</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#102d18]/85 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
              <Sprout className="size-3.5 text-emerald-400" />
              <span>{t('ui.zeroCommission')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Search Summary Bar (after search) */}
      {hasSearched ? (
        <aside
          aria-label="Search summary"
          className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/90 px-4 py-2.5 shadow-md backdrop-blur-md"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 font-bold text-ink">
              <MapPin className="size-4 text-emerald-700" aria-hidden="true" />
              <span>{snapshot?.village || village || district || t('ui.nearby')}</span>
            </span>
            {snapshot?.crop || crop ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-900 ring-1 ring-emerald-300">
                <CropIcon crop={(snapshot?.crop || crop) as CropKey} size={14} />
                <span>{t(`crop.${snapshot?.crop || crop}` as TranslationKey)}</span>
              </span>
            ) : null}
            {parsedAcreage ? (
              <span className="text-xs font-medium text-ink-muted">
                {t('ui.forAcres', { n: parsedAcreage })}
              </span>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => searchCardRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            {t('ui.changeSearch')}
          </Button>
        </aside>
      ) : null}

      {/* 2. Find a Machine Card Matching Reference Mockup */}
      <div ref={searchCardRef} className="rounded-3xl bg-white/95 backdrop-blur-md p-6 sm:p-7 shadow-xl border border-white/70 space-y-6">
        {/* Top Split Section: Find a Machine & Actions (Left) vs Popular Crops (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Find a Machine & Quick Action Buttons */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-[#e8f7ee] flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                <Tractor className="size-6" />
              </div>
              <div>
                <h2 id="search-heading" className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">
                  {t('farmer.findTitle')}
                </h2>
                <p className="text-xs font-medium text-gray-500">{t('farmer.findSubtitle')}</p>
              </div>
            </div>

            {/* Location & Voice Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => void locate()}
                disabled={geo.loading || geocoding}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1c4d28] hover:bg-[#153b1e] text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-70 cursor-pointer"
              >
                <LocateFixed className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <span>{geo.loading || geocoding ? t('farmer.locationFinding') : t('farmer.useLocation')}</span>
              </button>

              <span className="text-xs font-semibold text-gray-400 px-1">or</span>

              <div className="w-auto">
                <VoiceSearchButton
                  onVoiceResult={handleVoiceResult}
                  className="!rounded-full !border !border-[#cbe9d4] !bg-[#eef8f1] !text-[#1c4d28] hover:!bg-[#e1f3e6] px-5 py-2.5 text-xs sm:text-sm font-bold shadow-xs min-h-11 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right: Popular Crops Carousel Row */}
          <div className="lg:col-span-5 lg:border-l lg:border-gray-200/80 lg:pl-6">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 uppercase tracking-wider">
                <Sprout className="size-4 text-emerald-700" />
                <span>{t('ui.popularCrops')}</span>
              </div>

              <div className="flex items-center gap-2">
                <CropPhotoDetector
                  allCrops={CROP_KEYS}
                  onConfirm={(selected) => {
                    setCrop(selected)
                    if (village.trim() || district.trim() || geo.coordinates) {
                      void runSearch(selected)
                    }
                  }}
                />
              </div>
            </div>

            {/* 4 Popular Crops Chips + Right Chevron */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {(['rice', 'wheat', 'sugarcane', 'maize'] as CropKey[]).map((key) => {
                const cfg = CROP_CONFIGS[key]
                const isSelected = crop === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleQuickCrop(key)}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-emerald-600 bg-emerald-50 shadow-xs'
                        : 'bg-gray-50/90 hover:bg-emerald-50/50 border border-gray-100 hover:border-emerald-200'
                    }`}
                  >
                    <img
                      src={cfg.image}
                      alt={cfg.alt}
                      className="size-11 sm:size-12 rounded-xl object-cover"
                      onError={(e) => {
                        e.currentTarget.src = cfg.fallbackImage
                      }}
                    />
                    <span className="text-[11px] font-bold text-gray-700">
                      {t(`crop.${key}` as TranslationKey)}
                    </span>
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => setCropPickerOpen(true)}
                className="size-8 rounded-full border border-gray-200 bg-white hover:bg-gray-100 shadow-2xs flex items-center justify-center text-gray-600 shrink-0 cursor-pointer transition-colors"
                title={t('ui.showAllCrops')}
                aria-label={t('ui.showAllCrops')}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Section: Enter Your Village Input */}
        <div className="pt-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
            <MapPin className="size-3.5 text-gray-500" />
            <span>{t('ui.enterYourVillage')}</span>
          </div>

          <form onSubmit={onSearch} className="relative">
            <PlaceAutocomplete
              inputRef={villageInputRef}
              value={village}
              placeholder={t('ui.typeVillagePlaceholder')}
              locating={geo.loading || geocoding}
              nearTo={originCoords}
              onVoiceResult={(guesses) => void handleVoicePlace(guesses)}
              onUseCurrentLocation={() => void locate()}
              onSelect={handlePlaceSelect}
              onChange={(val) => {
                setVillage(val)
                // Typing away from a picked place drops its district and map position.
                if (picked && val.trim().toLowerCase() !== picked.name.toLowerCase()) {
                  setPicked(null)
                  setDistrict('')
                  setState('')
                }
                // If user modifies village away from detected place, clear detected place and stale district
                if (detectedPlace && val.trim().toLowerCase() !== detectedPlace.place.toLowerCase()) {
                  setDetectedPlace(null)
                  setDistrict('')
                  setState('')
                  geo.clear()
                }
                if (errors.village) {
                  setErrors((prev) => {
                    const next = { ...prev }
                    delete next.village
                    return next
                  })
                }
              }}
            />
            <button
              type="submit"
              disabled={searching}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-9 sm:size-10 rounded-full bg-gray-200 hover:bg-[#1c4d28] hover:text-white text-gray-700 flex items-center justify-center transition-all shadow-xs cursor-pointer"
              aria-label={t('farmer.searchButton')}
            >
              <ArrowRight className="size-4.5" />
            </button>
          </form>

          <p className="mt-2 pl-3 text-xs text-gray-400">
            {t('ui.villageExample')}
          </p>

          {/* Quick select agricultural hubs */}
          <div className="mt-2 pl-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">
              Popular:
            </span>
            {[
              { name: 'Vijayapura', dist: 'vijaypura' },
              { name: 'Toravi', dist: 'vijaypura' },
              { name: 'Tikota', dist: 'vijaypura' },
              { name: 'ANINAPUR', dist: 'vijaypura' },
              { name: 'Hubballi', dist: 'dharwad' },
              { name: 'Mandya', dist: 'mandya' },
            ].map((loc) => (
              <button
                key={loc.name}
                type="button"
                onClick={() => {
                  setDetectedPlace(null)
                  setVillage(loc.name)
                  setDistrict(loc.dist)
                  setState('karnataka')
                  setPicked({ name: loc.name, coords: null })
                  void resolveVillageCoordinates(loc.name, loc.dist).then((coords) =>
                    setPicked((prev) => (prev && prev.name === loc.name ? { ...prev, coords } : prev)),
                  )
                  void runSearch(crop, loc.name, loc.dist)
                }}
                className="rounded-full border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 transition-colors shadow-2xs cursor-pointer"
              >
                {loc.name}
              </button>
            ))}
          </div>

          {/* Optional Filter Toggle */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowFilters((open) => !open)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 cursor-pointer"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              <span>{showFilters ? t('farmer.hideFilters') : t('farmer.showFilters')}</span>
              <ChevronDown
                className={`size-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>

          <div className={`mt-3 grid gap-3 sm:grid-cols-3 ${showFilters ? 'hr-tab-content' : 'hidden'}`}>
            <Select
              label={t('farmer.cropLabel')}
              value={crop}
              onChange={(event) => setCrop(event.target.value)}
            >
              <option value="">{t('farmer.anyCrop')}</option>
              {CROP_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`crop.${key}`)}
                </option>
              ))}
            </Select>

            <Select
              label={t('farmer.machineTypeLabel')}
              value={machineType}
              onChange={(event) => setMachineType(event.target.value)}
            >
              <option value="">{t('farmer.anyMachine')}</option>
              {MACHINE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(machineTypeLabelKey(type))}
                </option>
              ))}
            </Select>

            <Input
              label={t('farmer.districtLabel')}
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              autoComplete="address-level2"
              placeholder={t('ui.districtPlaceholder')}
            />
          </div>

          {geo.error ? <Alert variant="warning" className="mt-3">{t(geo.error)}</Alert> : null}
          {locationWarning ? (
            <Alert variant="warning" className="mt-3">{t('ui.locPoor')}</Alert>
          ) : null}
          {detectedPlace ? (
            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-emerald-800 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200/60">
              <span className="flex items-center gap-1.5 truncate">
                <span>✓</span>
                <span>
                  {t('farmer.locationDetected', {
                    place: detectedPlace.place,
                    district: detectedPlace.district,
                  })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setDetectedPlace(null)
                  setVillage('')
                  setDistrict('')
                  setState('')
                  geo.clear()
                  villageInputRef.current?.focus()
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-950 underline shrink-0 ml-2 cursor-pointer"
              >
                {t('ui.clearSearch')}
              </button>
            </div>
          ) : geo.coordinates ? (
            <p className="mt-2 text-xs font-medium text-emerald-800">{t('farmer.locationAdded')}</p>
          ) : null}
        </div>

        <CropPickerModal
          open={cropPickerOpen}
          onClose={() => setCropPickerOpen(false)}
          selected={crop}
          allowAny
          onSelect={(selected) => {
            setCrop(selected)
            if (village.trim() || district.trim() || geo.coordinates) {
              void runSearch(selected)
            }
          }}
        />
      </div>

      {/* 3. Dashboard Metrics & Recent Activity Row with Real Database Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Real Available Machines Count from Database */}
        <div className="rounded-3xl bg-[#eaf7ee] border border-[#cbe9d4] p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
          <div className="size-10 rounded-2xl bg-white/80 flex items-center justify-center text-emerald-700 mb-3 shadow-2xs">
            <Tractor className="size-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">
              {platformStats !== null ? platformStats.available_machines : '—'}
            </div>
            <div className="text-xs font-semibold text-gray-600">{t('ui.machinesAvailable')}</div>
          </div>
        </div>

        {/* 2. Real Registered Farmers / Users Count from Database */}
        <div className="rounded-3xl bg-[#eaf3fc] border border-[#cde2f8] p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
          <div className="size-10 rounded-2xl bg-white/80 flex items-center justify-center text-blue-600 mb-3 shadow-2xs">
            <Users className="size-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">
              {platformStats !== null ? (platformStats.total_farmers || platformStats.total_users) : '—'}
            </div>
            <div className="text-xs font-semibold text-gray-600">{t('ui.happyFarmers')}</div>
          </div>
        </div>

        {/* 3. 100% Trusted Platform */}
        <div className="rounded-3xl bg-[#fdf7ea] border border-[#f7e6c0] p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
          <div className="size-10 rounded-2xl bg-white/80 flex items-center justify-center text-amber-600 mb-3 shadow-2xs">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">
              {platformStats !== null ? platformStats.confirmed_bookings : '—'}
            </div>
            <div className="text-xs font-semibold text-gray-600">{t('ui.confirmedBookings')}</div>
          </div>
        </div>

        {/* 4. Recent Activity: Real Latest Machine from Database */}
        <div className="rounded-3xl bg-white/95 backdrop-blur-md border border-white/70 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
              <Activity className="size-4 text-emerald-600" />
              <span>{t('ui.recentActivity')}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                villageInputRef.current?.focus()
              }}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-0.5 cursor-pointer"
            >
              <span>{t('ui.viewAll')}</span>
              <ArrowRight className="size-3" />
            </button>
          </div>

          {latestActivity ? (
            <Link
              to={`/farmer/machines/${latestActivity.id}`}
              className="mt-3 flex items-center gap-3 group text-left cursor-pointer"
            >
              <div className="size-11 rounded-full overflow-hidden border border-gray-100 shrink-0 bg-emerald-50 flex items-center justify-center text-emerald-700 shadow-2xs">
                {latestActivity.image_path ? (
                  <img
                    src={getMachineImageUrl(latestActivity.image_path) || undefined}
                    alt={latestActivity.model || 'Machine'}
                    className="size-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <Tractor className="size-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                  {latestActivity.village
                    ? `${t('ui.newMachineAdded')} · ${latestActivity.village}`
                    : t('ui.newMachineAdded')}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {latestActivity.model || t(machineTypeLabelKey(latestActivity.machine_type))}
                  {formatRelativeTime(latestActivity.created_at, t) ? ` • ${formatRelativeTime(latestActivity.created_at, t)}` : ''}
                </p>
              </div>
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-label="Live update" />
            </Link>
          ) : (
            <div className="mt-3 flex items-center gap-3 py-1 text-xs text-gray-500 font-medium">
              <div className="size-11 rounded-full overflow-hidden border border-gray-100 shrink-0 bg-emerald-50 flex items-center justify-center text-emerald-700 shadow-2xs">
                <Tractor className="size-6 opacity-60" />
              </div>
              <p className="text-xs text-gray-500 italic">{t('ui.noActivityYet')}</p>
            </div>
          )}
        </div>
      </div>
      {/* Mobile: List / Map Toggle when map is shown */}
      {hasSearched && (geo.coordinates || mapMachines.length > 0) ? (
        <div className="flex justify-center lg:hidden">
          <div className="inline-flex rounded-xl bg-white/80 backdrop-blur-md p-1 shadow-xs border border-white/60" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mobileView === 'list'}
              onClick={() => setMobileView('list')}
              className={`rounded-lg px-4 py-1.5 text-sm font-bold transition-colors ${
                mobileView === 'list'
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('ui.viewList')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileView === 'map'}
              onClick={() => setMobileView('map')}
              className={`rounded-lg px-4 py-1.5 text-sm font-bold transition-colors ${
                mobileView === 'map'
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('ui.viewMap')}
            </button>
          </div>
        </div>
      ) : null}

      {/* Map: Stacked on lg+, toggled on mobile */}
      {hasSearched && (geo.coordinates || mapMachines.length > 0) ? (
        <div className={`hr-tab-content ${mobileView === 'map' ? 'block' : 'hidden lg:block'}`}>
          <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/95 backdrop-blur-md p-0 shadow-lg">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
              <div>
                <h2 className="text-lg font-extrabold text-ink">{t('ui.mapTitle')}</h2>
                <p className="text-sm text-ink-muted">
                  {geo.coordinates ? t('ui.mapSubGps') : t('ui.mapSubTap')}
                </p>
              </div>
            </div>
            <Suspense fallback={<MapSkeleton className="h-72 sm:h-96" />}>
              <LiveMap me={geo.coordinates} machines={mapMachines} className="h-72 sm:h-96" />
            </Suspense>
          </div>
        </div>
      ) : null}

      {/* Results / Scanner Section */}
      <section ref={resultsRef} aria-live="polite" className="space-y-5">
        {isOfflineResults ? (
          <Alert variant="warning">
            {t('farmer.offlineResultsNotice')}
          </Alert>
        ) : null}
        {searchError ? <Alert variant="warning">{t(searchError)}</Alert> : null}

        {smartSummary ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-emerald-50 border border-emerald-200/90 p-4 text-emerald-950 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-2xs">
                <Sparkles className="size-5" />
              </span>
              <div>
                <p className="text-base font-black text-emerald-950">{smartSummary}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSmartSummary(null)
                clearSearch()
              }}
              className="rounded-xl border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
            >
              {t('farmer.clearSearch')}
            </button>
          </div>
        ) : null}

        {searching || geocoding ? (
          /* Live Scanning State: Skeletons replacing radar block */
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 rounded-full border border-leaf-200 bg-white px-4 py-1.5 text-sm font-bold text-leaf-800 shadow-sm w-fit">
                <Radio className="size-3.5 animate-pulse text-leaf-600" aria-hidden="true" />
                <span>{t('ui.scanning')}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                {t('farmer.clearSearch')}
              </Button>
            </div>
            <div
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              aria-busy="true"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <MachineCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : hasSearched ? (
          /* Search Results: Showing Nearby Rental Machines */
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cream-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 animate-pulse rounded-full bg-leaf-600" />
                  <h2 className="text-2xl font-extrabold tracking-tight">
                    {t('farmer.nearbyRentalMachines')}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {snapshot?.village
                    ? t('farmer.resultsFor', { village: snapshot.village })
                    : t('ui.readyArea')}
                  {sortedResults ? ` • ${t('farmer.resultsCount', { count: sortedResults.length })}` : ''}
                  {parsedAcreage ? ` • ${t('ui.forAcres', { n: parsedAcreage })}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Segmented control: Nearest | Cheapest */}
                <div className="inline-flex rounded-xl bg-cream-200/80 p-1" role="group" aria-label="Sort options">
                  <button
                    type="button"
                    onClick={() => setSortBy('nearest')}
                    className={`rounded-lg px-3 py-1 text-sm font-bold transition-colors ${
                      sortBy === 'nearest'
                        ? 'bg-white text-leaf-800 shadow-2xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {t('ui.sortNearest')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('cheapest')}
                    className={`rounded-lg px-3 py-1 text-sm font-bold transition-colors ${
                      sortBy === 'cheapest'
                        ? 'bg-white text-leaf-800 shadow-2xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {t('ui.sortCheapest')}
                  </button>
                </div>

                <Button variant="ghost" size="sm" onClick={clearSearch}>
                  {t('farmer.clearSearch')}
                </Button>
              </div>
            </div>

            {/* List View: Hidden on mobile when Map view is selected, always visible on lg+ */}
            <div className={`hr-tab-content ${mobileView === 'list' ? 'block' : 'hidden lg:block'}`}>
              {displayResults && displayResults.length > 0 ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {displayResults.map((machine, idx) => (
                    <MachineCard
                      key={machine.id}
                      index={idx}
                      machine={machine}
                      distanceKm={distanceFor(machine)}
                      acreage={parsedAcreage}
                      selectedCrop={crop}
                      userLocation={activeUserLocation}
                      userVillage={snapshot?.village || village}
                      userDistrict={effectiveDistrict || district}
                      isBusy={busyMachines.has(machine.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-6">
                  <EmptyState
                    icon={Search}
                    title={t('farmer.noResultsTitle')}
                    description={t('farmer.noResultsBody')}
                    action={
                      <Button variant="outline" onClick={clearSearch}>
                        {t('farmer.clearSearch')}
                      </Button>
                    }
                  />
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Initial Display: Ready to Scan (NO machines shown before entering details) */
          <div className="rounded-2xl border border-cream-200 bg-gradient-to-b from-white to-cream-50 p-6 text-center shadow-soft sm:p-10">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-700 shadow-sm">
              <Tractor className="size-8" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-2xl font-extrabold text-ink">
              {t('farmer.readyToScanTitle')}
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-muted">
              {t('farmer.enterDetailsToScan')}
            </p>

            <div className="mx-auto mt-8 grid max-w-2xl gap-4 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-xs">
                <div className="flex size-8 items-center justify-center rounded-lg bg-leaf-50 text-sm font-bold text-leaf-700">
                  1
                </div>
                <h4 className="mt-2 text-sm font-bold text-ink">{t('ui.step1Title')}</h4>
                <p className="mt-1 text-sm text-ink-muted">
                  {t('ui.step1Body')}
                </p>
              </div>

              <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-xs">
                <div className="flex size-8 items-center justify-center rounded-lg bg-leaf-50 text-sm font-bold text-leaf-700">
                  2
                </div>
                <h4 className="mt-2 text-sm font-bold text-ink">{t('ui.step2Title')}</h4>
                <p className="mt-1 text-sm text-ink-muted">
                  {t('ui.step2Body')}
                </p>
              </div>

              <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-xs">
                <div className="flex size-8 items-center justify-center rounded-lg bg-leaf-50 text-sm font-bold text-leaf-700">
                  3
                </div>
                <h4 className="mt-2 text-sm font-bold text-ink">{t('ui.step3Title')}</h4>
                <p className="mt-1 text-sm text-ink-muted">
                  {t('ui.step3Body')}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Floating Kisan Voice Assistant for uneducated farmers & renters */}
      <KisanVoiceAssistant onVoiceSearch={handleVoiceResult} />
    </div>
  )
}
