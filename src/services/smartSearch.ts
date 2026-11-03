import { supabase } from '../lib/supabase'
import { deduplicateMachines, getLocalMachines, isMachineDeleted } from './store'
import type { CropKey, MachineCard } from '../types'
import type { TranslationKey } from '../i18n'

export interface SmartSearchResult {
  rawQuery: string
  intent: 'new_machines' | 'count_query' | 'location_search' | 'crop_search' | 'model_search' | 'general'
  summary: string
  summaryKey: TranslationKey
  summaryParams: Record<string, string | number>
  count: number
  machines: MachineCard[]
  detectedLocation?: string
  detectedMachineType?: string
  detectedCrop?: string
  detectedModel?: string
}

// Common aliases for locations across languages and spellings
const LOCATION_ALIASES: Record<string, string> = {
  // Vijayapura
  vijaypura: 'vijaypura',
  vijayapura: 'vijaypura',
  vijayapur: 'vijaypura',
  bijapur: 'vijaypura',
  'ವಿಜಯಪುರ': 'vijaypura',
  'विजयपुरा': 'vijaypura',
  'बीजापुर': 'vijaypura',
  tikota: 'tikota',
  'ತಿಕೋಟ': 'tikota',
  toravi: 'toravi',
  'ತೊರವಿ': 'toravi',
  aninapur: 'aninapur',
  'ಅಣಿನಾಪುರ': 'aninapur',

  // Bengaluru
  bengaluru: 'bengaluru',
  bangalore: 'bengaluru',
  'ಬೆಂಗಳೂರು': 'bengaluru',
  'बैंगलोर': 'bengaluru',
  'बेंगलुरु': 'bengaluru',
  kogilu: 'kogilu',
  'ಕೋಗಿಲು': 'kogilu',
  sampigehalli: 'sampigehalli',
  'ಸಂಪಿಗೆಹಳ್ಳಿ': 'sampigehalli',
  yelahanka: 'yelahanka',
  'ಯಲಹಂಕ': 'yelahanka',
  'येलाहांका': 'yelahanka',

  // Other major agricultural centers
  mandya: 'mandya',
  'ಮಂಡ್ಯ': 'mandya',
  hubballi: 'hubballi',
  hubli: 'hubballi',
  'ಹುಬ್ಬಳ್ಳಿ': 'hubballi',
  dharwad: 'dharwad',
  'ಧಾರವಾಡ': 'dharwad',
  belagavi: 'belagavi',
  belgaum: 'belagavi',
  'ಬೆಳಗಾವಿ': 'belagavi',
  bagalkot: 'bagalkot',
  'ಬಾಗಲಕೋಟೆ': 'bagalkot',
  raichur: 'raichur',
  'ರಾಯಚೂರು': 'raichur',
  koppal: 'koppal',
  'ಕೊಪ್ಪಳ': 'koppal',
  bellary: 'bellary',
  ballari: 'bellary',
  'ಬಳ್ಳಾರಿ': 'bellary',
  karnal: 'karnal',
  punjab: 'punjab',
}

// Crop keywords
const CROP_KEYWORDS: Record<string, CropKey> = {
  paddy: 'rice',
  rice: 'rice',
  bhatta: 'rice',
  dhan: 'rice',
  'ಭತ್ತ': 'rice',
  'धान': 'rice',
  wheat: 'wheat',
  gehu: 'wheat',
  godhi: 'wheat',
  'ಗೋಧಿ': 'wheat',
  'गेहूं': 'wheat',
  sugarcane: 'sugarcane',
  kabbu: 'sugarcane',
  ganna: 'sugarcane',
  'ಕಬ್ಬು': 'sugarcane',
  'गन्ना': 'sugarcane',
  maize: 'maize',
  corn: 'maize',
  jola: 'maize',
  makka: 'maize',
  'ಮೆಕ್ಕೆಜೋಳ': 'maize',
  'मक्का': 'maize',
  cotton: 'cotton',
  hatti: 'cotton',
  kapas: 'cotton',
  'ಹತ್ತಿ': 'cotton',
  'कपास': 'cotton',
  groundnut: 'groundnut',
  shenga: 'groundnut',
  'ಕಡಲೆಕಾಯಿ': 'groundnut',
  soybean: 'soybean',
}

// Machine models
const MACHINE_MODELS = ['swaraj', 'johndear', 'john deere', 'john', 'mahindra', 'kubota', 'kartar', 'preet', 'sonalika', 'new holland']

export interface ParsedQuery {
  isNewQuery: boolean
  isCountQuery: boolean
  machineType?: 'combine_harvester' | 'tractor_harvester' | 'tractor' | 'power_tiller'
  machineTypeLabel?: string
  location?: string
  locationDisplay?: string
  crop?: CropKey
  model?: string
}

export function parseNaturalSearchQuery(rawQuery: string): ParsedQuery {
  const clean = rawQuery.trim().toLowerCase()
  if (!clean) {
    return { isNewQuery: false, isCountQuery: false }
  }

  // 1. Detect New / Latest machines intent
  const isNewQuery = /(new|latest|recent|recently|added|newly|what.*new|ಹೊಸ|ನಯಾ|नया)/i.test(clean)

  // 2. Detect Count query intent ("how many", "count", "number of")
  const isCountQuery = /(how many|how much|count|number of|total|quantity|ಎಷ್ಟು|कितने|எத்தனை)/i.test(clean)

  // 3. Detect Machine Type (fixed Kannada regex from Tamil letters to ಕೊಯ್ಲು)
  let machineType: 'combine_harvester' | 'tractor_harvester' | 'tractor' | 'power_tiller' | undefined
  let machineTypeLabel: string | undefined

  if (/(combine|harvester|harvestor|harvesters|हार्वेस्टर|ಹಾರ್ವೆಸ್ಟರ್|ಕೊಯ್ಲು|அறுவடை)/i.test(clean)) {
    machineType = 'combine_harvester'
    machineTypeLabel = 'Harvester'
  } else if (/(tractor|ಟ್ರ್ಯಾಕ್ಟರ್|ट्रैक्टर)/i.test(clean)) {
    machineType = 'tractor_harvester'
    machineTypeLabel = 'Tractor'
  } else if (/(tiller|power tiller|ಟಿಲ್ಲಿಂಗ್)/i.test(clean)) {
    machineType = 'power_tiller'
    machineTypeLabel = 'Power Tiller'
  }

  // 4. Detect Crop
  let crop: CropKey | undefined
  for (const [kw, key] of Object.entries(CROP_KEYWORDS)) {
    if (clean.includes(kw)) {
      crop = key
      break
    }
  }

  // 5. Detect Model
  let model: string | undefined
  for (const m of MACHINE_MODELS) {
    if (clean.includes(m)) {
      model = m
      break
    }
  }

  // 6. Detect Location (Village / District)
  let location: string | undefined
  let locationDisplay: string | undefined

  // Check aliases directly first
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (clean.includes(alias)) {
      location = canonical
      locationDisplay = alias.charAt(0).toUpperCase() + alias.slice(1)
      break
    }
  }

  // Location fallback: only treat leftover words as a location when NO crop, machine type or model was detected!
  // Never let a single word like "rice" become a location.
  if (!location && !crop && !machineType && !model) {
    const stopWords = new Set([
      'how', 'many', 'much', 'harvestor', 'harvester', 'harvesters', 'machine', 'machines',
      'tractor', 'tractors', 'tiller', 'tillers', 'combine', 'combines',
      'are', 'there', 'in', 'near', 'at', 'for', 'added', 'what', 'the', 'is', 'new',
      'show', 'me', 'find', 'available', 'rent', 'rental', 'of', 'to', 'all', 'any',
      'latest', 'recent', 'recently', 'please', 'tell', 'give', 'number',
      ...Object.keys(CROP_KEYWORDS),
      ...Object.values(CROP_KEYWORDS),
      ...MACHINE_MODELS.flatMap((m) => m.split(/\s+/)),
    ])
    const words = clean.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    const candidates = words.filter((w) => !stopWords.has(w) && w.length >= 2)
    if (candidates.length > 0) {
      location = candidates.join(' ')
      locationDisplay = candidates.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }
  }

  return {
    isNewQuery,
    isCountQuery,
    machineType,
    machineTypeLabel,
    location,
    locationDisplay: locationDisplay || (location ? location.charAt(0).toUpperCase() + location.slice(1) : undefined),
    crop,
    model,
  }
}

/**
 * Executes a smart natural language search against the database
 */
export async function executeSmartSearch(rawQuery: string): Promise<SmartSearchResult> {
  const parsed = parseNaturalSearchQuery(rawQuery)

  let machines: MachineCard[] = []

  // 1. If location, crop, or machine type is detected, use the optimized search_machines RPC first
  if (supabase && (parsed.location || parsed.crop || parsed.machineType)) {
    try {
      const { data, error } = await supabase.rpc('search_machines', {
        p_village: parsed.location || null,
        p_district: null,
        p_state: null,
        p_crop: parsed.crop || null,
        p_machine_type: parsed.machineType || null,
        p_limit: 48,
        p_offset: 0,
      })

      if (!error && Array.isArray(data)) {
        machines = deduplicateMachines(data as MachineCard[]).filter(
          (m) => m && m.is_active !== false && !isMachineDeleted(m.id),
        )
      }
    } catch {
      // Fall through to table select
    }
  }

  // 2. If no RPC results, or if query is for new/recent machines or model, query machine_cards with limit(48)
  if (machines.length === 0 && supabase) {
    try {
      const { data, error } = await supabase
        .from('machine_cards')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(48)

      if (!error && Array.isArray(data)) {
        machines = deduplicateMachines(data as MachineCard[]).filter(
          (m) => m && m.is_active !== false && !isMachineDeleted(m.id),
        )
      }
    } catch {
      // Fall through to local resilient store
    }
  }

  // 3. Fallback to local store if Supabase returned nothing or is offline
  if (machines.length === 0) {
    machines = deduplicateMachines(getLocalMachines()).filter(
      (m) => m && m.is_active !== false && !isMachineDeleted(m.id),
    )
  }

  // 4. Refine and filter based on parsed parameters
  let filtered = [...machines]

  // Filter: New machines query
  if (parsed.isNewQuery && !parsed.location && !parsed.machineType && !parsed.crop && !parsed.model) {
    const resultCount = filtered.length
    return {
      rawQuery,
      intent: 'new_machines',
      summary: `Showing ${resultCount} latest machines added to Harvest Rentals`,
      summaryKey: 'ui.summaryNew',
      summaryParams: { count: resultCount },
      count: resultCount,
      machines: filtered,
    }
  }

  // Filter by Location if detected (with proper non-empty string checks)
  if (parsed.location) {
    const locLower = parsed.location.toLowerCase()
    const locMatches = filtered.filter((m) => {
      const v = (m.village || '').trim().toLowerCase()
      const d = (m.district || '').trim().toLowerCase()
      const svs = Array.isArray(m.service_villages)
        ? m.service_villages.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : '')).filter(Boolean)
        : []

      const vMatch = Boolean(v && (v.includes(locLower) || locLower.includes(v)))
      const dMatch = Boolean(d && (d.includes(locLower) || locLower.includes(d)))
      const svMatch = svs.some((s) => Boolean(s && (s.includes(locLower) || locLower.includes(s))))

      return vMatch || dMatch || svMatch
    })

    if (locMatches.length > 0) {
      filtered = locMatches
    }
  }

  // Filter by Machine Type if detected
  if (parsed.machineType) {
    const typeLower = parsed.machineType.toLowerCase()
    const typeMatches = filtered.filter((m) => {
      const t = (m.machine_type || '').toLowerCase()
      if (typeLower === 'combine_harvester') {
        return t === 'combine_harvester' || t === 'tractor_harvester' || t.includes('harvester')
      }
      return t === typeLower || t.includes(typeLower)
    })

    if (typeMatches.length > 0) {
      filtered = typeMatches
    }
  }

  // Filter by Model if detected
  if (parsed.model) {
    const modelLower = parsed.model.toLowerCase()
    const modelMatches = filtered.filter((m) => {
      const model = (m.model || '').toLowerCase()
      return model.includes(modelLower) || modelLower.includes(model)
    })
    if (modelMatches.length > 0) {
      filtered = modelMatches
    }
  }

  // Filter by Crop if detected
  if (parsed.crop) {
    const cropLower = parsed.crop.toLowerCase()
    const cropMatches = filtered.filter((m) => {
      const crops = Array.isArray(m.crops) ? m.crops.map((c) => (c || '').toLowerCase()) : []
      return crops.includes(cropLower)
    })
    if (cropMatches.length > 0) {
      filtered = cropMatches
    }
  }

  // 5. Construct Smart i18n Summary
  const count = filtered.length
  let summary = ''
  let summaryKey: TranslationKey = 'ui.summaryGeneralFound'
  let summaryParams: Record<string, string | number> = { count, query: rawQuery }
  let intent: SmartSearchResult['intent'] = 'general'

  if (parsed.isCountQuery || parsed.location) {
    intent = parsed.isCountQuery ? 'count_query' : 'location_search'
    const typeText = parsed.machineTypeLabel || 'Machine'
    const locText = parsed.locationDisplay || parsed.location || 'your area'
    if (count > 0) {
      summaryKey = 'ui.summaryLocationFound'
      summaryParams = { count, type: typeText, location: locText }
      summary = `Found ${count} ${typeText}${count > 1 ? 's' : ''} available in ${locText}`
    } else {
      summaryKey = 'ui.summaryLocationNone'
      summaryParams = { type: typeText, location: locText }
      summary = `No ${typeText}s currently listed in ${locText}`
    }
  } else if (parsed.isNewQuery) {
    intent = 'new_machines'
    summaryKey = 'ui.summaryNew'
    summaryParams = { count }
    summary = `Showing ${count} newly added machines`
  } else if (parsed.crop) {
    intent = 'crop_search'
    summaryKey = 'ui.summaryCrop'
    summaryParams = { count, crop: parsed.crop }
    summary = `Found ${count} machines suitable for ${parsed.crop}`
  } else if (parsed.model) {
    intent = 'model_search'
    summaryKey = 'ui.summaryModel'
    summaryParams = { count, model: parsed.model }
    summary = `Found ${count} machines matching '${parsed.model}'`
  } else {
    if (count > 0) {
      summaryKey = 'ui.summaryGeneralFound'
      summaryParams = { count, query: rawQuery }
      summary = `Found ${count} machines matching "${rawQuery}"`
    } else {
      summaryKey = 'ui.summaryGeneralNone'
      summaryParams = { query: rawQuery }
      summary = `No machines found matching "${rawQuery}"`
    }
  }

  return {
    rawQuery,
    intent,
    summary,
    summaryKey,
    summaryParams,
    count,
    machines: filtered,
    detectedLocation: parsed.locationDisplay || parsed.location,
    detectedMachineType: parsed.machineTypeLabel,
    detectedCrop: parsed.crop,
    detectedModel: parsed.model,
  }
}
