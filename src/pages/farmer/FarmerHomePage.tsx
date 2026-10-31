import { useCallback, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  LocateFixed,
  PhoneCall,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tractor,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError, mapErrorToKey } from '../../lib/errors'
import { CROP_KEYS, MACHINE_TYPES } from '../../lib/constants'
import { normalizeWhitespace } from '../../lib/validation'
import type { FieldErrors } from '../../lib/validation'
import { distanceKm } from '../../lib/geo'
import { useAsync } from '../../hooks/useAsync'
import { useGeolocation } from '../../hooks/useGeolocation'
import { searchMachines } from '../../services/machines'
import { deduplicateMachines } from '../../services/store'
import { updateProfile } from '../../services/profiles'
import { reverseGeocode } from '../../services/geocode'
import type { CropKey, MachineCard as MachineCardType, MachineType } from '../../types'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { Input, Select } from '../../components/ui/Input'
import { MachineCard } from '../../components/machine/MachineCard'
import { VoiceSearchButton } from '../../components/voice/VoiceSearchButton'
import { LiveMap } from '../../components/map/LiveMap'
import type { MapMachine } from '../../components/map/LiveMap'
import { machineTypeLabelKey } from '../../lib/labels'
import { KisanVoiceAssistant } from '../../components/voice/KisanVoiceAssistant'
import type { VoiceQueryResult } from '../../lib/voice'

const LAST_VILLAGE_KEY = 'harvest-rentals-last-village'

const POPULAR_CROPS: { key: CropKey; emoji: string }[] = [
  { key: 'rice', emoji: 'ðŸŒ¾' },
  { key: 'wheat', emoji: 'ðŸŒ¾' },
  { key: 'sugarcane', emoji: 'ðŸŽ‹' },
  { key: 'maize', emoji: 'ðŸŒ½' },
  { key: 'soybean', emoji: 'ðŸŒ±' },
  { key: 'cotton', emoji: 'â˜ï¸' },
]

interface SearchSnapshot {
  village: string
  crop: string
  machineType: string
  acreage: string
}

export function FarmerHomePage() {
  const { profile, refreshProfile } = useAuth()
  const { t } = useI18n()
  const geo = useGeolocation()

  const [village, setVillage] = useState(
    () => profile?.village ?? readLastVillage() ?? '',
  )
  const [district, setDistrict] = useState(profile?.district ?? '')
  const [state, setState] = useState(profile?.state ?? '')
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

  // Initial load: show recommended or all active machines immediately
  const recommendedLoader = useCallback(async () => {
    return searchMachines({
      village: profile?.village || undefined,
      limit: 12,
    })
  }, [profile?.village])

  const recommended = useAsync(recommendedLoader, {
    enabled: !hasSearched,
    fallback: 'farmer.searchError',
  })

  const activeUserLocation =
    snapshot?.village || village || district || profile?.district || profile?.village || ''

  const sortedResults = useMemo(() => {
    if (!results) return null
    const deduped = deduplicateMachines(results)
    const target = activeUserLocation.trim().toLowerCase()

    return [...deduped].sort((a, b) => {
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

      if (target) {
        const aDistrict = (a.district || '').toLowerCase()
        const aVillage = (a.village || '').toLowerCase()
        const aVillages = Array.isArray(a.service_villages) ? a.service_villages : []

        const aSame =
          Boolean(aDistrict && (aDistrict.includes(target) || target.includes(aDistrict))) ||
          Boolean(aVillage && (aVillage.includes(target) || target.includes(aVillage))) ||
          aVillages.some((v) => typeof v === 'string' && v.toLowerCase().includes(target))

        const bDistrict = (b.district || '').toLowerCase()
        const bVillage = (b.village || '').toLowerCase()
        const bVillages = Array.isArray(b.service_villages) ? b.service_villages : []

        const bSame =
          Boolean(bDistrict && (bDistrict.includes(target) || target.includes(bDistrict))) ||
          Boolean(bVillage && (bVillage.includes(target) || target.includes(bVillage))) ||
          bVillages.some((v) => typeof v === 'string' && v.toLowerCase().includes(target))

        if (aSame && !bSame) return -1
        if (!aSame && bSame) return 1
      }

      return 0
    })
  }, [results, geo.coordinates, activeUserLocation])

  const sortedRecommended = useMemo(() => {
    if (!recommended.data) return []
    const deduped = deduplicateMachines(recommended.data)
    const target = activeUserLocation.trim().toLowerCase()

    return [...deduped].sort((a, b) => {
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

      if (target) {
        const aDistrict = (a.district || '').toLowerCase()
        const aVillage = (a.village || '').toLowerCase()
        const aVillages = Array.isArray(a.service_villages) ? a.service_villages : []

        const aSame =
          Boolean(aDistrict && (aDistrict.includes(target) || target.includes(aDistrict))) ||
          Boolean(aVillage && (aVillage.includes(target) || target.includes(aVillage))) ||
          aVillages.some((v) => typeof v === 'string' && v.toLowerCase().includes(target))

        const bDistrict = (b.district || '').toLowerCase()
        const bVillage = (b.village || '').toLowerCase()
        const bVillages = Array.isArray(b.service_villages) ? b.service_villages : []

        const bSame =
          Boolean(bDistrict && (bDistrict.includes(target) || target.includes(bDistrict))) ||
          Boolean(bVillage && (bVillage.includes(target) || target.includes(bVillage))) ||
          bVillages.some((v) => typeof v === 'string' && v.toLowerCase().includes(target))

        if (aSame && !bSame) return -1
        if (!aSame && bSame) return 1
      }

      return 0
    })
  }, [recommended.data, geo.coordinates, activeUserLocation])

  const distanceFor = (machine: MachineCardType): number | null => {
    if (!geo.coordinates || machine.latitude === null || machine.longitude === null) return null
    return distanceKm(geo.coordinates, {
      latitude: machine.latitude,
      longitude: machine.longitude,
    })
  }

  const runSearch = async (overrideCrop?: string, overrideVillage?: string) => {
    setErrors({})
    setSearchError(null)
    setSearching(true)
    const targetVillage = overrideVillage !== undefined ? overrideVillage : village
    const cleanedVillage = normalizeWhitespace(targetVillage)
    const activeCrop = overrideCrop !== undefined ? overrideCrop : crop

    try {
      const found = await searchMachines({
        village: cleanedVillage || undefined,
        district: normalizeWhitespace(district) || undefined,
        state: normalizeWhitespace(state) || undefined,
        crop: activeCrop || undefined,
        machineType: machineType || undefined,
        limit: 48,
      })
      setResults(found)
      setSnapshot({
        village: cleanedVillage,
        crop: activeCrop,
        machineType,
        acreage,
      })
      if (cleanedVillage) {
        writeLastVillage(cleanedVillage)
      }
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)

      if (profile && cleanedVillage && profile.village !== cleanedVillage) {
        try {
          await updateProfile(profile.id, { village: cleanedVillage })
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
    void runSearch()
  }

  const handleQuickCrop = (selectedKey: string) => {
    const nextCrop = crop === selectedKey ? '' : selectedKey
    setCrop(nextCrop)
    void runSearch(nextCrop)
  }

  const clearSearch = () => {
    setResults(null)
    setSnapshot(null)
    setSearchError(null)
    setVillage('')
    setCrop('')
    setAcreage('')
    setMachineType('')
    setErrors({})
  }

  const locate = async () => {
    setDetectedPlace(null)
    setGeocoding(true)
    try {
      const coords = await geo.request()
      if (!coords) return

      const geocoded = await reverseGeocode(coords)
      if (geocoded) {
        if (geocoded.village) {
          setVillage(geocoded.village)
          writeLastVillage(geocoded.village)
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
      }
    } finally {
      setGeocoding(false)
    }
  }

  const mapMachines = useMemo<MapMachine[]>(() => {
    const source = hasSearched ? (sortedResults ?? []) : sortedRecommended
    return source.flatMap((machine) =>
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
  }, [hasSearched, sortedResults, sortedRecommended, t])

  const name = profile?.full_name?.split(' ')[0] || t('farmer.fallbackName')

  return (
    <div className="space-y-8">
      {/* Hero Welcome & Value Proposition */}
      <header className="relative rounded-3xl bg-gradient-to-br from-leaf-800 to-leaf-950 px-6 py-8 text-cream-50 shadow-soft sm:px-10 sm:py-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-leaf-700/60 px-3 py-1 text-xs font-bold text-cream-100 backdrop-blur">
            <Sparkles className="size-3.5 text-amber-300" />
            <span>Zero Login Required â€¢ Direct Call & WhatsApp</span>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
            {t('farmer.greeting', { name })}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-leaf-100 sm:text-lg">
            Find nearby harvesting machines at transparent, per-acre rates without middlemen commission.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-leaf-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-leaf-300" /> Transparent Pricing
            </span>
            <span className="flex items-center gap-1.5">
              <PhoneCall className="size-4 text-leaf-300" /> Direct Phone Number
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-leaf-300" /> Verified Machine Owners
            </span>
          </div>
        </div>
      </header>

      {/* Main Search & Filter Form */}
      <Card as="section" className="overflow-hidden border-2 border-leaf-100 shadow-soft">
        <div className="border-b border-cream-200 bg-cream-50/70 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-leaf-100 text-leaf-800">
              <Search className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-ink">{t('farmer.findTitle')}</h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                Enter your village and crop to compare harvesters nearby.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onSearch} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Village Input with Voice Search for uneducated farmers */}
            <div className="lg:col-span-1">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label={t('farmer.villageLabel')}
                    hint={t('farmer.villageHint')}
                    placeholder={t('farmer.villagePlaceholder')}
                    value={village}
                    onChange={(event) => {
                      setVillage(event.target.value)
                      setErrors({})
                    }}
                    error={errors.village ? t(errors.village) : null}
                    autoComplete="address-level2"
                    name="village"
                    className="text-base font-medium"
                  />
                </div>
                <VoiceSearchButton
                  onVoiceResult={handleVoiceResult}
                  className="mb-0.5 shrink-0"
                />
              </div>
            </div>

            {/* Crop Selector */}
            <div>
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
            </div>

            {/* Land Area (Acreage) Input - Live Estimator */}
            <div>
              <Input
                label="Land Area (Acres)"
                hint="Used for live cost estimation"
                placeholder="e.g. 5"
                type="number"
                min="0.1"
                step="0.5"
                value={acreage}
                onChange={(event) => setAcreage(event.target.value)}
                name="acreage"
                className="text-base font-medium"
              />
            </div>
          </div>

          {/* Quick-Select Crop Pills */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Quick Crop Filter:
            </label>
            <div className="flex flex-wrap gap-2">
              {POPULAR_CROPS.map((item) => {
                const isSelected = crop === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleQuickCrop(item.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-leaf-700 text-cream-50 shadow-soft scale-105'
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

          {/* Advanced Filters Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-sm font-bold text-leaf-700 hover:text-leaf-900"
              aria-expanded={showFilters}
              aria-controls="farmer-filters"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {showFilters ? t('farmer.hideFilters') : t('farmer.showFilters')}
              <ChevronDown
                className={`size-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            <div
              id="farmer-filters"
              className={`${showFilters ? 'grid' : 'hidden'} mt-3 gap-4 sm:grid-cols-3`}
            >
              <Select
                label={t('farmer.machineTypeLabel')}
                value={machineType}
                onChange={(event) => setMachineType(event.target.value as MachineType | '')}
              >
                <option value="">{t('farmer.anyMachine')}</option>
                {MACHINE_TYPES.map((key) => (
                  <option key={key} value={key}>
                    {t(`machineType.${key}`)}
                  </option>
                ))}
              </Select>

              <Input
                label={t('farmer.districtLabel')}
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                autoComplete="address-level1"
                placeholder="e.g. Mandya / Ludhiana"
              />

              <Input
                label={t('farmer.stateLabel')}
                value={state}
                onChange={(event) => setState(event.target.value)}
                autoComplete="address-level1"
                placeholder="e.g. Karnataka / Punjab"
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

      {/* Map: your location + machines nearby */}
      {geo.coordinates || mapMachines.length > 0 ? (
        <Card as="section" className="overflow-hidden border-2 border-leaf-100 p-0 shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-5 py-3">
            <div>
              <h2 className="text-lg font-extrabold text-ink">Machines on the map</h2>
              <p className="text-sm text-ink-muted">
                {geo.coordinates
                  ? 'The blue dot is you. Tap a tractor to see the machine.'
                  : 'Tap â€œUse My Locationâ€ to see where you are.'}
              </p>
            </div>
          </div>
          <LiveMap me={geo.coordinates} machines={mapMachines} className="h-72 sm:h-96" />
        </Card>
      ) : null}

      {/* Results Section */}
      <section ref={resultsRef} aria-live="polite" className="space-y-5">
        {searchError ? <Alert variant="warning">{t(searchError)}</Alert> : null}

        {hasSearched ? (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cream-200 pb-3">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  {snapshot?.village
                    ? t('farmer.resultsFor', { village: snapshot.village })
                    : 'Matching Harvesters'}
                </h2>
                <p className="text-sm text-ink-muted">
                  {t('farmer.resultsCount', { count: sortedResults?.length ?? 0 })}
                  {parsedAcreage ? ` â€¢ Estimations for ${parsedAcreage} acres` : ''}
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
          /* Initial Display: Recommended / All Harvesters */
          <div>
            <div className="flex items-center justify-between border-b border-cream-200 pb-3">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  Available Harvesting Machines
                </h2>
                <p className="text-sm text-ink-muted">
                  Browse verified machinery ready for booking across India.
                </p>
              </div>
            </div>

            {recommended.loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : sortedRecommended.length > 0 ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {sortedRecommended.map((machine) => (
                  <MachineCard
                    key={machine.id}
                    machine={machine}
                    distanceKm={distanceFor(machine)}
                    acreage={parsedAcreage}
                    selectedCrop={crop}
                    userLocation={activeUserLocation}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8">
                <EmptyState
                  icon={Tractor}
                  title="No harvesting machines listed yet"
                  description="Machine owners can list their equipment now to receive direct booking calls and WhatsApp requests from nearby farmers."
                  action={
                    <LinkButton to="/owner/machines/new" variant="primary">
                      List Your Machine
                    </LinkButton>
                  }
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Floating Kisan Voice Assistant for uneducated farmers & renters */}
      <KisanVoiceAssistant onVoiceSearch={handleVoiceResult} />
    </div>
  )
}

function readLastVillage(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(LAST_VILLAGE_KEY)
}

function writeLastVillage(village: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LAST_VILLAGE_KEY, village)
}
