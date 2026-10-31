import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  LocateFixed,
  PhoneCall,
  Radar,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { CROP_KEYS, MACHINE_TYPES } from '../../lib/constants'
import { normalizeWhitespace } from '../../lib/validation'
import type { FieldErrors } from '../../lib/validation'
import { distanceKm } from '../../lib/geo'
import { useGeolocation } from '../../hooks/useGeolocation'
import { searchMachines } from '../../services/machines'
import { deduplicateMachines } from '../../services/store'
import { updateProfile } from '../../services/profiles'
import { reverseGeocode } from '../../services/geocode'
import type { CropKey, MachineCard as MachineCardType } from '../../types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/Feedback'
import { Input, Select } from '../../components/ui/Input'
import { MachineCard } from '../../components/machine/MachineCard'
import { VoiceSearchButton } from '../../components/voice/VoiceSearchButton'
import { LiveMap } from '../../components/map/LiveMap'
import type { MapMachine } from '../../components/map/LiveMap'
import { machineTypeLabelKey } from '../../lib/labels'
import { KisanVoiceAssistant } from '../../components/voice/KisanVoiceAssistant'
import type { VoiceQueryResult } from '../../lib/voice'

const POPULAR_CROPS: { key: CropKey; emoji: string }[] = [
  { key: 'rice', emoji: '🌾' },
  { key: 'wheat', emoji: '🌾' },
  { key: 'sugarcane', emoji: '🎋' },
  { key: 'maize', emoji: '🌽' },
  { key: 'soybean', emoji: '🌱' },
  { key: 'cotton', emoji: '☁️' },
]

interface SearchSnapshot {
  village: string
  crop: string
  machineType: string
  acreage: string
}

export function FarmerHomePage() {
  const { profile, refreshProfile } = useAuth()
  const { t, language } = useI18n()
  const geo = useGeolocation()

  // Always start completely blank
  const [village, setVillage] = useState('')
  const [district, setDistrict] = useState('')
  const [state, setState] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('harvest-rentals-last-village')
    }
  }, [])
  const [crop, setCrop] = useState<string>('')
  const [acreage, setAcreage] = useState<string>('')
  const [machineType, setMachineType] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [searching, setSearching] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [detectedPlace, setDetectedPlace] = useState<{ place: string; district: string } | null>(null)
  const [searchError, setSearchError] = useState<TranslationKey | null>(null)
  const [results, setResults] = useState<MachineCardType[] | null>(null)
  const [snapshot, setSnapshot] = useState<SearchSnapshot | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

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
      if (geo.coordinates) {
        const da =
          a.latitude !== null && a.longitude !== null
            ? distanceKm(geo.coordinates, { latitude: a.latitude, longitude: a.longitude })
            : Number.POSITIVE_INFINITY
        const db =
          b.latitude !== null && b.longitude !== null
            ? distanceKm(geo.coordinates, { latitude: b.latitude, longitude: b.longitude })
            : Number.POSITIVE_INFINITY
        if (da !== db) return da - db
      }

      // 2. Mode B Proximity Tier: Level 1 (In Village) -> Level 2 (Same District)
      const tierA = getTier(a)
      const tierB = getTier(b)
      if (tierA !== tierB) return tierA - tierB

      return 0
    })
  }, [results, geo.coordinates, snapshot, village])

  const distanceFor = (machine: MachineCardType): number | null => {
    if (!geo.coordinates || machine.latitude === null || machine.longitude === null) return null
    return distanceKm(geo.coordinates, {
      latitude: machine.latitude,
      longitude: machine.longitude,
    })
  }

  const runSearch = async (
    overrideCrop?: string,
    overrideVillage?: string,
    overrideDistrict?: string,
    overrideState?: string,
  ) => {
    setErrors({})
    setSearchError(null)
    setSearching(true)
    const targetVillage = overrideVillage !== undefined ? overrideVillage : village
    const targetDistrict = overrideDistrict !== undefined ? overrideDistrict : district
    const targetState = overrideState !== undefined ? overrideState : state
    const cleanedVillage = normalizeWhitespace(targetVillage)
    const cleanedDistrict = normalizeWhitespace(targetDistrict)
    const cleanedState = normalizeWhitespace(targetState)
    const activeCrop = overrideCrop !== undefined ? overrideCrop : crop

    try {
      const found = await searchMachines({
        village: cleanedVillage || undefined,
        district: cleanedDistrict || undefined,
        crop: activeCrop || undefined,
        machineType: machineType || undefined,
        limit: 48,
      })
      setResults(found)
      setSnapshot({
        village: cleanedVillage || cleanedDistrict || 'Nearby',
        crop: activeCrop,
        machineType,
        acreage,
      })
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)

      if (profile && cleanedVillage && profile.village !== cleanedVillage) {
        try {
          await updateProfile(profile.id, {
            village: cleanedVillage,
            district: cleanedDistrict || undefined,
            state: cleanedState || undefined,
          })
          await refreshProfile()
        } catch (caught) {
          logError('farmer.saveVillage', caught)
        }
      }
    } catch (caught) {
      logError('farmer.search', caught)
      setSearchError(mapErrorToKey(caught, 'farmer.searchError'))
    } finally {
      setSearching(false)
    }
  }

  const handleVoiceResult = (result: VoiceQueryResult) => {
    if (result.village) setVillage(result.village)
    if (result.crop) setCrop(result.crop)
    if (result.acreage) setAcreage(result.acreage)

    void runSearch(result.crop, result.village)
  }

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    if (!village.trim() && !district.trim() && !crop.trim() && !machineType.trim() && !geo.coordinates) {
      setErrors({ village: 'validation.required' })
      return
    }
    void runSearch()
  }

  const handleQuickCrop = (selectedKey: string) => {
    const nextCrop = crop === selectedKey ? '' : selectedKey
    setCrop(nextCrop)
    if (village.trim() || district.trim() || geo.coordinates) {
      void runSearch(nextCrop)
    }
  }

  const clearSearch = () => {
    setResults(null)
    setSnapshot(null)
    setSearchError(null)
    setVillage('')
    setDistrict('')
    setState('')
    setCrop('')
    setAcreage('')
    setMachineType('')
    setErrors({})
    setDetectedPlace(null)
  }

  // Keep detected place synchronized when the user switches interface language
  useEffect(() => {
    if (geo.coordinates && detectedPlace) {
      void reverseGeocode(geo.coordinates, language).then((geocoded) => {
        if (geocoded) {
          if (geocoded.village) setVillage(geocoded.village)
          if (geocoded.district) setDistrict(geocoded.district)
          setDetectedPlace({
            place: geocoded.village,
            district: geocoded.district,
          })
        }
      })
    }
  }, [language])

  const locate = async () => {
    setDetectedPlace(null)
    setGeocoding(true)
    try {
      const coords = await geo.request()
      if (!coords) return

      const geocoded = await reverseGeocode(coords, language)
      if (geocoded) {
        if (geocoded.village) {
          setVillage(geocoded.village)
        }
        if (geocoded.district) {
          setDistrict(geocoded.district)
        }
        if (geocoded.state) {
          setState(geocoded.state)
        }
        setDetectedPlace({
          place: geocoded.village,
          district: geocoded.district,
        })

        if (profile && !profile.village && geocoded.village) {
          void updateProfile(profile.id, {
            village: geocoded.village,
            district: geocoded.district || undefined,
            state: geocoded.state || undefined,
          }).catch(() => undefined)
        }

        // Auto-scan for nearby machines immediately!
        void runSearch(crop, geocoded.village, geocoded.district, geocoded.state)
      }
    } finally {
      setGeocoding(false)
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
      {/* Hero Banner with Clean Value Props */}
      <div className="rounded-card bg-gradient-to-br from-leaf-800 via-leaf-700 to-leaf-900 p-6 text-white shadow-soft sm:p-8">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-leaf-100 backdrop-blur-xs">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Direct Farmer-to-Owner Rental Platform
          </span>

          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t('farmer.greeting', { name })}
          </h1>

          <p className="mt-2 text-base text-leaf-100/90 sm:text-lg">
            {t('farmer.subtitle')}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 p-2.5 backdrop-blur-xs">
              <CheckCircle2 className="size-5 shrink-0 text-leaf-300" />
              <span className="text-xs font-medium sm:text-sm">Verified Machines</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/10 p-2.5 backdrop-blur-xs">
              <PhoneCall className="size-5 shrink-0 text-leaf-300" />
              <span className="text-xs font-medium sm:text-sm">Direct Owner Call</span>
            </div>
            <div className="col-span-2 flex items-center gap-2 rounded-xl bg-white/10 p-2.5 backdrop-blur-xs sm:col-span-1">
              <ShieldCheck className="size-5 shrink-0 text-leaf-300" />
              <span className="text-xs font-medium sm:text-sm">Zero Commission</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Search Panel */}
      <Card as="section" aria-labelledby="search-heading" className="p-5 sm:p-7 shadow-soft">
        <form onSubmit={onSearch} noValidate className="space-y-5">
          <div className="flex items-center justify-between border-b border-cream-200 pb-3">
            <div>
              <h2 id="search-heading" className="text-xl font-extrabold text-ink sm:text-2xl">
                {t('farmer.findTitle')}
              </h2>
              <p className="text-xs text-ink-muted sm:text-sm">{t('farmer.findSubtitle')}</p>
            </div>
            <VoiceSearchButton onVoiceResult={handleVoiceResult} />
          </div>

          {/* Primary Village Input */}
          <div>
            <Input
              label={t('farmer.villageLabel')}
              hint={t('farmer.villageHint')}
              placeholder={t('farmer.villagePlaceholder')}
              value={village}
              onChange={(event) => {
                setVillage(event.target.value)
                if (errors.village) {
                  setErrors((prev) => {
                    const next = { ...prev }
                    delete next.village
                    return next
                  })
                }
              }}
              error={errors.village ? t(errors.village) : null}
              autoComplete="address-level2"
              className="text-base font-semibold"
            />
          </div>

          {/* Popular Crops Quick Select Chips */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
              Select Crop
            </label>
            <div className="flex flex-wrap gap-2">
              {POPULAR_CROPS.map((item) => {
                const active = crop === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleQuickCrop(item.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                      active
                        ? 'bg-leaf-700 text-white shadow-xs'
                        : 'bg-cream-100 text-ink-soft hover:bg-cream-200'
                    }`}
                  >
                    <span>{item.emoji}</span>
                    <span>{t(`crop.${item.key}`)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Collapsible More Filters */}
          <div>
            <button
              type="button"
              onClick={() => setShowFilters((open) => !open)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-leaf-800 hover:text-leaf-950"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              <span>{showFilters ? t('farmer.hideFilters') : t('farmer.showFilters')}</span>
              <ChevronDown
                className={`size-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            <div className={`mt-4 grid gap-3 sm:grid-cols-3 ${showFilters ? '' : 'hidden'}`}>
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
                placeholder="e.g. Mandya / Vijayapura"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="submit"
              size="lg"
              loading={searching}
              className="sm:flex-1"
              icon={<Search className="size-5" aria-hidden="true" />}
            >
              {searching ? t('common.searching') : t('farmer.searchButton')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => void locate()}
              loading={geo.loading || geocoding}
              icon={<LocateFixed className="size-5" aria-hidden="true" />}
            >
              {geo.loading || geocoding ? t('farmer.locationFinding') : t('farmer.useLocation')}
            </Button>
          </div>

          {geo.error ? <Alert variant="warning">{t(geo.error)}</Alert> : null}
          {detectedPlace ? (
            <p className="text-sm font-semibold text-leaf-800">
              ✓ {t('farmer.locationDetected', {
                place: detectedPlace.place,
                district: detectedPlace.district,
              })}
            </p>
          ) : geo.coordinates ? (
            <p className="text-sm font-medium text-leaf-800">{t('farmer.locationAdded')}</p>
          ) : null}
        </form>
      </Card>

      {/* Map: Only shown when location is active and machines are searched */}
      {hasSearched && (geo.coordinates || mapMachines.length > 0) ? (
        <Card as="section" className="overflow-hidden border-2 border-leaf-100 p-0 shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-5 py-3">
            <div>
              <h2 className="text-lg font-extrabold text-ink">Nearby Harvesters Map</h2>
              <p className="text-sm text-ink-muted">
                {geo.coordinates
                  ? 'Blue dot is your farm. Green pins show harvesters near you.'
                  : 'Tap on any machine pin to view details and booking.'}
              </p>
            </div>
          </div>
          <LiveMap me={geo.coordinates} machines={mapMachines} className="h-72 sm:h-96" />
        </Card>
      ) : null}

      {/* Results / Scanner Section */}
      <section ref={resultsRef} aria-live="polite" className="space-y-5">
        {searchError ? <Alert variant="warning">{t(searchError)}</Alert> : null}

        {searching || geocoding ? (
          /* Live Scanning State */
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-leaf-300 bg-gradient-to-b from-leaf-50/70 to-white px-4 py-16 text-center shadow-inner">
            <div className="relative mb-6 flex size-20 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf-400 opacity-40" />
              <span className="relative flex size-16 items-center justify-center rounded-full bg-leaf-700 text-white shadow-lg">
                <Radar className="size-8 animate-spin" style={{ animationDuration: '3s' }} aria-hidden="true" />
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-ink">
              {t('farmer.scanningNearby', {
                location: snapshot?.village || village || district || 'your farm area',
              })}
            </h3>
            <p className="mt-2 max-w-md text-sm text-ink-muted">
              {t('farmer.scanningSubtitle')}
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-full border border-leaf-200 bg-white px-4 py-1.5 text-xs font-bold text-leaf-800 shadow-sm">
              <Radio className="size-3.5 animate-pulse text-leaf-600" />
              <span>Scanning registered machines & live availability…</span>
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
                    : 'Machines ready for booking in your area'}
                  {sortedResults ? ` • ${t('farmer.resultsCount', { count: sortedResults.length })}` : ''}
                  {parsedAcreage ? ` • For ~${parsedAcreage} acres` : ''}
                </p>
              </div>

              <Button variant="ghost" size="sm" onClick={clearSearch}>
                {t('farmer.clearSearch')}
              </Button>
            </div>

            {sortedResults && sortedResults.length > 0 ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {sortedResults.map((machine) => (
                  <MachineCard
                    key={machine.id}
                    machine={machine}
                    distanceKm={distanceFor(machine)}
                    acreage={parsedAcreage}
                    selectedCrop={crop}
                    userLocation={activeUserLocation}
                    userVillage={snapshot?.village || village}
                    userDistrict={effectiveDistrict || district}
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
        ) : (
          /* Initial Display: Ready to Scan (NO machines shown before entering details) */
          <div className="rounded-2xl border border-cream-200 bg-gradient-to-b from-white to-cream-50 p-6 text-center shadow-soft sm:p-10">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-700 shadow-sm">
              <Radar className="size-8" aria-hidden="true" />
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
                <h4 className="mt-2 text-sm font-bold text-ink">Enter Location</h4>
                <p className="mt-1 text-xs text-ink-muted">
                  Type your village or tap "Use My Location" for instant GPS auto-fill.
                </p>
              </div>

              <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-xs">
                <div className="flex size-8 items-center justify-center rounded-lg bg-leaf-50 text-sm font-bold text-leaf-700">
                  2
                </div>
                <h4 className="mt-2 text-sm font-bold text-ink">Scan Harvesters</h4>
                <p className="mt-1 text-xs text-ink-muted">
                  We scan and sort verified harvesters operating in your village & district.
                </p>
              </div>

              <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-xs">
                <div className="flex size-8 items-center justify-center rounded-lg bg-leaf-50 text-sm font-bold text-leaf-700">
                  3
                </div>
                <h4 className="mt-2 text-sm font-bold text-ink">Direct Contact</h4>
                <p className="mt-1 text-xs text-ink-muted">
                  Call or WhatsApp machine owners directly with transparent hourly/acre rates.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="primary"
                size="lg"
                icon={<LocateFixed className="size-5" aria-hidden="true" />}
                onClick={() => void locate()}
                loading={geo.loading || geocoding}
              >
                {t('farmer.useLocation')}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Floating Kisan Voice Assistant for uneducated farmers & renters */}
      <KisanVoiceAssistant onVoiceSearch={handleVoiceResult} />
    </div>
  )
}
