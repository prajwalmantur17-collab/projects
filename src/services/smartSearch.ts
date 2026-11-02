import { supabase } from '../lib/supabase'
import { deduplicateMachines, getLocalMachines } from './store'
import type { CropKey, MachineCard } from '../types'

export interface SmartSearchResult {
  rawQuery: string
  intent: 'new_machines' | 'count_query' | 'location_search' | 'crop_search' | 'model_search' | 'general'
  summary: string
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

  // 3. Detect Machine Type
  let machineType: 'combine_harvester' | 'tractor_harvester' | 'tractor' | 'power_tiller' | undefined
  let machineTypeLabel: string | undefined

  if (/(combine|harvester|harvestor|harvesters|हार्वेस्टर|ಹಾರ್ವೆಸ್ಟರ್|ಅறுವடை)/i.test(clean)) {
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

  // If no alias matched, strip out known intent keywords to find potential place name
  if (!location) {
    const stopWords = new Set([
      'how', 'many', 'much', 'harvestor', 'harvester', 'harvesters', 'machine', 'machines',
      'are', 'there', 'in', 'near', 'at', 'for', 'added', 'what', 'the', 'is', 'new',
      'show', 'me', 'find', 'available', 'rent', 'rental', 'of', 'to', 'all', 'any',
      'latest', 'recent', 'recently', 'please', 'tell', 'give', 'number'
    ])
    const words = clean.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    const candidates = words.filter((w) => !stopWords.has(w) && !MACHINE_MODELS.includes(w) && !CROP_KEYWORDS[w])
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

  // 1. Fetch machines from Supabase view `machine_cards`
  let allMachines: MachineCard[] = []

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('machine_cards')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data)) {
        allMachines = deduplicateMachines(data as MachineCard[])
      }
    } catch {
      // Fall through to local store
    }
  }

  if (allMachines.length === 0) {
    allMachines = deduplicateMachines(getLocalMachines())
  }

  // 2. Filter and rank based on parsed query
  let filtered = [...allMachines]

  // Filter: New machines query
  if (parsed.isNewQuery && !parsed.location && !parsed.machineType && !parsed.crop && !parsed.model) {
    // Return all machines sorted by created_at descending (latest first)
    const resultCount = filtered.length
    return {
      rawQuery,
      intent: 'new_machines',
      summary: `Showing ${resultCount} latest machines added to Harvest Rentals`,
      count: resultCount,
      machines: filtered,
    }
  }

  // Filter by Location if detected
  if (parsed.location) {
    const locLower = parsed.location.toLowerCase()
    const locMatches = filtered.filter((m) => {
      const v = (m.village || '').toLowerCase()
      const d = (m.district || '').toLowerCase()
      const svs = Array.isArray(m.service_villages)
        ? m.service_villages.map((s) => (typeof s === 'string' ? s.toLowerCase() : ''))
        : []

      return v.includes(locLower) || d.includes(locLower) || svs.some((s) => s.includes(locLower)) || locLower.includes(v) || locLower.includes(d)
    })

    if (locMatches.length > 0) {
      filtered = locMatches
    }
  }

  // Filter by Machine Type if detected (e.g. harvester, tractor)
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

  // Filter by Model if detected (e.g. swaraj, john deere)
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

  // 3. Construct Smart Natural Language Summary
  const count = filtered.length
  let summary = ''
  let intent: SmartSearchResult['intent'] = 'general'

  if (parsed.isCountQuery || parsed.location) {
    intent = parsed.isCountQuery ? 'count_query' : 'location_search'
    const typeText = parsed.machineTypeLabel || 'Machine'
    const locText = parsed.locationDisplay || parsed.location || 'your area'
    if (count > 0) {
      summary = `Found ${count} ${typeText}${count > 1 ? 's' : ''} available in ${locText}`
    } else {
      summary = `No ${typeText}s currently listed in ${locText}`
    }
  } else if (parsed.isNewQuery) {
    intent = 'new_machines'
    summary = `Showing ${count} newly added machines`
  } else if (parsed.crop) {
    intent = 'crop_search'
    summary = `Found ${count} machines suitable for ${parsed.crop}`
  } else if (parsed.model) {
    intent = 'model_search'
    summary = `Found ${count} machines matching '${parsed.model}'`
  } else {
    summary = count > 0 ? `Found ${count} machines matching "${rawQuery}"` : `No machines found matching "${rawQuery}"`
  }

  return {
    rawQuery,
    intent,
    summary,
    count,
    machines: filtered,
    detectedLocation: parsed.locationDisplay || parsed.location,
    detectedMachineType: parsed.machineTypeLabel,
    detectedCrop: parsed.crop,
    detectedModel: parsed.model,
  }
}
