import type { CropKey } from '../types'
import { CROP_KEYS } from './constants'

export type CropCategory = 'cereal' | 'pulse' | 'cash_crop' | 'oilseed' | 'millet'

export interface CropConfig {
  id: CropKey
  nameKey: `crop.${CropKey}`
  englishName: string
  image: string
  fallbackImage: string
  alt: string
  emoji: string
  category: CropCategory
  /** Brief agricultural note or season in India */
  description?: string
}

/**
 * Central configuration for all 20 crops supported in HarvestRental.
 * Maps unique CropKey identifiers to their verified realistic crop photographs,
 * localized translation keys, fallbacks, and agricultural metadata.
 */
export const CROP_CONFIGS: Record<CropKey, CropConfig> = {
  rice: {
    id: 'rice',
    nameKey: 'crop.rice',
    englishName: 'Rice / Paddy',
    image: '/crops/rice.webp',
    fallbackImage: '/crops/rice.jpg',
    alt: 'Golden ripe paddy panicles in agricultural field',
    emoji: '🌾',
    category: 'cereal',
    description: 'Major Kharif cereal crop',
  },
  wheat: {
    id: 'wheat',
    nameKey: 'crop.wheat',
    englishName: 'Wheat',
    image: '/crops/wheat.webp',
    fallbackImage: '/crops/wheat.jpg',
    alt: 'Golden wheat ears ripening in farm field',
    emoji: '🌾',
    category: 'cereal',
    description: 'Major Rabi cereal crop',
  },
  sugarcane: {
    id: 'sugarcane',
    nameKey: 'crop.sugarcane',
    englishName: 'Sugarcane',
    image: '/crops/sugarcane.webp',
    fallbackImage: '/crops/sugarcane.jpg',
    alt: 'Tall mature sugarcane stalks growing in field',
    emoji: '🎋',
    category: 'cash_crop',
    description: 'Perennial cash crop',
  },
  maize: {
    id: 'maize',
    nameKey: 'crop.maize',
    englishName: 'Maize / Corn',
    image: '/crops/maize.webp',
    fallbackImage: '/crops/maize.jpg',
    alt: 'Ripe yellow corn cob on maize stalk in field',
    emoji: '🌽',
    category: 'cereal',
    description: 'Versatile food & fodder grain',
  },
  soybean: {
    id: 'soybean',
    nameKey: 'crop.soybean',
    englishName: 'Soybean',
    image: '/crops/soybean.webp',
    fallbackImage: '/crops/soybean.jpg',
    alt: 'Soybean plants with plump green pods in field',
    emoji: '🌱',
    category: 'pulse',
    description: 'High-protein oilseed & pulse',
  },
  cotton: {
    id: 'cotton',
    nameKey: 'crop.cotton',
    englishName: 'Cotton',
    image: '/crops/cotton.webp',
    fallbackImage: '/crops/cotton.jpg',
    alt: 'Fluffy white cotton bolls ready for harvest on plant',
    emoji: '☁️',
    category: 'cash_crop',
    description: 'Major fiber cash crop',
  },
  groundnut: {
    id: 'groundnut',
    nameKey: 'crop.groundnut',
    englishName: 'Groundnut / Peanut',
    image: '/crops/groundnut.webp',
    fallbackImage: '/crops/groundnut.jpg',
    alt: 'Freshly harvested groundnuts with pods and soil',
    emoji: '🥜',
    category: 'oilseed',
    description: 'Major Kharif oilseed crop',
  },
  millet: {
    id: 'millet',
    nameKey: 'crop.millet',
    englishName: 'Millet',
    image: '/crops/millet.webp',
    fallbackImage: '/crops/millet.jpg',
    alt: 'Golden millet head ripening in farm field',
    emoji: '🌾',
    category: 'millet',
    description: 'Nutritious drought-resistant grain',
  },
  jowar: {
    id: 'jowar',
    nameKey: 'crop.jowar',
    englishName: 'Jowar / Sorghum',
    image: '/crops/jowar.webp',
    fallbackImage: '/crops/jowar.jpg',
    alt: 'Sorghum jowar crop heads ready for harvest',
    emoji: '🌾',
    category: 'millet',
    description: 'Great millet & staple coarse grain',
  },
  ragi: {
    id: 'ragi',
    nameKey: 'crop.ragi',
    englishName: 'Ragi / Finger Millet',
    image: '/crops/ragi.webp',
    fallbackImage: '/crops/ragi.jpg',
    alt: 'Close-up of finger millet ragi crop heads in field',
    emoji: '🌾',
    category: 'millet',
    description: 'Calcium-rich staple millet',
  },
  bajra: {
    id: 'bajra',
    nameKey: 'crop.bajra',
    englishName: 'Bajra / Pearl Millet',
    image: '/crops/bajra.webp',
    fallbackImage: '/crops/bajra.jpg',
    alt: 'Pearl millet bajra stalk and seed head on farm',
    emoji: '🌾',
    category: 'millet',
    description: 'Hardy pearl millet grain',
  },
  sunflower: {
    id: 'sunflower',
    nameKey: 'crop.sunflower',
    englishName: 'Sunflower',
    image: '/crops/sunflower.webp',
    fallbackImage: '/crops/sunflower.jpg',
    alt: 'Bright yellow sunflower head facing the sun in field',
    emoji: '🌻',
    category: 'oilseed',
    description: 'Popular edible oilseed',
  },
  sesame: {
    id: 'sesame',
    nameKey: 'crop.sesame',
    englishName: 'Sesame / Til',
    image: '/crops/sesame.webp',
    fallbackImage: '/crops/sesame.jpg',
    alt: 'Sesame plant with seed capsules ready for harvest',
    emoji: '🌿',
    category: 'oilseed',
    description: 'Traditional oilseed crop',
  },
  green_gram: {
    id: 'green_gram',
    nameKey: 'crop.green_gram',
    englishName: 'Green Gram / Moong',
    image: '/crops/green_gram.webp',
    fallbackImage: '/crops/green_gram.jpg',
    alt: 'Green moong pulse pods hanging on healthy plant',
    emoji: '🌱',
    category: 'pulse',
    description: 'Fast-growing legume pulse',
  },
  black_gram: {
    id: 'black_gram',
    nameKey: 'crop.black_gram',
    englishName: 'Black Gram / Urad',
    image: '/crops/black_gram.webp',
    fallbackImage: '/crops/black_gram.jpg',
    alt: 'Dark urad black gram pods on farm plant',
    emoji: '🌱',
    category: 'pulse',
    description: 'High-value protein pulse',
  },
  lentil: {
    id: 'lentil',
    nameKey: 'crop.lentil',
    englishName: 'Lentil / Masoor',
    image: '/crops/lentil.webp',
    fallbackImage: '/crops/lentil.jpg',
    alt: 'Lentil masoor plants growing in agricultural field',
    emoji: '🌿',
    category: 'pulse',
    description: 'Rabi season pulse crop',
  },
  barley: {
    id: 'barley',
    nameKey: 'crop.barley',
    englishName: 'Barley',
    image: '/crops/barley.webp',
    fallbackImage: '/crops/barley.jpg',
    alt: 'Barley crop ears with awns glistening in sunlight',
    emoji: '🌾',
    category: 'cereal',
    description: 'Rabi cereal grain',
  },
  mustard: {
    id: 'mustard',
    nameKey: 'crop.mustard',
    englishName: 'Mustard / Sarson',
    image: '/crops/mustard.webp',
    fallbackImage: '/crops/mustard.jpg',
    alt: 'Bright yellow mustard flowers blooming in field',
    emoji: '🌼',
    category: 'oilseed',
    description: 'Major Rabi edible oilseed',
  },
  chickpea: {
    id: 'chickpea',
    nameKey: 'crop.chickpea',
    englishName: 'Chickpea / Chana',
    image: '/crops/chickpea.webp',
    fallbackImage: '/crops/chickpea.jpg',
    alt: 'Chickpea plants with developing pods in field',
    emoji: '🌱',
    category: 'pulse',
    description: 'Leading pulse crop in India',
  },
  pigeon_pea: {
    id: 'pigeon_pea',
    nameKey: 'crop.pigeon_pea',
    englishName: 'Pigeon Pea / Toor / Arhar',
    image: '/crops/pigeon_pea.webp',
    fallbackImage: '/crops/pigeon_pea.jpg',
    alt: 'Pigeon pea toor pods ripening on plant branch',
    emoji: '🌱',
    category: 'pulse',
    description: 'Major Kharif dal crop',
  },
}

/** Standard ordering for displaying crops to farmers */
export const CROP_DISPLAY_ORDER: CropKey[] = [
  'rice',
  'wheat',
  'sugarcane',
  'maize',
  'soybean',
  'cotton',
  'groundnut',
  'millet',
  'jowar',
  'ragi',
  'bajra',
  'sunflower',
  'sesame',
  'green_gram',
  'black_gram',
  'lentil',
  'barley',
  'mustard',
  'chickpea',
  'pigeon_pea',
]

/** The top most widely cultivated crops shown for fast 1-tap access */
export const POPULAR_CROP_KEYS: CropKey[] = [
  'rice',
  'wheat',
  'sugarcane',
  'maize',
  'cotton',
  'soybean',
  'groundnut',
  'millet',
]

/** Full array of crop configs in prioritized display order */
export const ALL_CROPS: CropConfig[] = CROP_DISPLAY_ORDER.map((key) => CROP_CONFIGS[key])

/** Fallback emojis for backwards compatibility */
export const CROP_EMOJI: Record<CropKey, string> = CROP_KEYS.reduce(
  (acc, key) => {
    acc[key] = CROP_CONFIGS[key].emoji
    return acc
  },
  {} as Record<CropKey, string>,
)

/** Returns the verified WebP image path for a given crop */
export function cropImageUrl(crop: CropKey): string {
  return CROP_CONFIGS[crop]?.image ?? `/crops/${crop}.webp`
}

/** Returns the fallback JPG image path for a given crop */
export function cropFallbackImageUrl(crop: CropKey): string {
  return CROP_CONFIGS[crop]?.fallbackImage ?? `/crops/${crop}.jpg`
}

/** Safe getter for crop configuration */
export function getCropConfig(crop: CropKey): CropConfig {
  return CROP_CONFIGS[crop] ?? CROP_CONFIGS.wheat
}
