import type { Coordinates, Language } from '../types'

export interface ReverseGeocodeResult {
  village: string
  district: string
  state: string
}

// -----------------------------------------------------------------------------
// Comprehensive Bidirectional Dictionaries for Karnataka Districts & Common Places
// -----------------------------------------------------------------------------

interface PlaceNames {
  en: string
  kn: string
  hi: string
  ta?: string
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rLat1 = (lat1 * Math.PI) / 180
  const rLat2 = (lat2 * Math.PI) / 180
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Accurately extracts the most local, human-meaningful place name from an OSM reverse geocode payload.
 * Prevents broad administrative polygons (such as OSM's 25 km² Kogilu boundary) from masking
 * well-known colleges/universities (e.g. REVA University), townships (Bhartiya City), or distinct villages (Kattigenahalli).
 */
export function resolveAccuratePlaceName(
  data: {
    name?: string
    category?: string
    type?: string
    address?: Record<string, string>
  },
  latitude: number,
  longitude: number,
): string {
  const addr = data.address || {}
  const rawName = (data.name || '').trim()

  // 1. Direct university / college / campus check (e.g. REVA University campus & facilities)
  if (/reva/i.test(rawName) || /reva/i.test(addr.amenity || '') || /reva/i.test(addr.university || '') || /reva/i.test(addr.college || '')) {
    return 'REVA University'
  }

  // 2. Proximity check for REVA University (covers 1.2km radius around campus center, main gate, hostel blocks)
  const dReva = getDistanceKm(latitude, longitude, 13.1154, 77.6358)
  if (dReva <= 1.2) {
    return 'REVA University'
  }

  // 3. Proximity & keyword check for Bhartiya City & Nikoo Homes
  const dBhartiya = getDistanceKm(latitude, longitude, 13.0845, 77.6410)
  if (dBhartiya <= 1.5 || /bhartiya/i.test(rawName) || /bhartiya/i.test(addr.neighbourhood || '') || /nikoo/i.test(rawName) || /nikoo/i.test(addr.road || '')) {
    return 'Bhartiya City'
  }

  // 4. Specific village / neighbourhood name match
  if (/kattigenahalli/i.test(rawName) || /kattigenahalli/i.test(addr.village || '') || /kattigenahalli/i.test(addr.neighbourhood || '')) {
    return 'Kattigenahalli'
  }
  if (/bellahalli/i.test(rawName) || /bellahalli/i.test(addr.village || '') || /bellahalli/i.test(addr.neighbourhood || '')) {
    return 'Bellahalli'
  }
  if (/chokkanahalli/i.test(rawName) || /chokkanahalli/i.test(addr.village || '') || /chokkanahalli/i.test(addr.neighbourhood || '')) {
    return 'Chokkanahalli'
  }
  if (/kannuru/i.test(rawName) || /kannuru/i.test(addr.village || '') || /kannuru/i.test(addr.neighbourhood || '')) {
    return 'Kannuru'
  }
  if (/thanisandra/i.test(rawName) || /thanisandra/i.test(addr.suburb || '') || /thanisandra/i.test(addr.neighbourhood || '')) {
    return 'Thanisandra'
  }
  if (/toravi/i.test(rawName) || /toravi/i.test(addr.village || '')) {
    return 'Toravi'
  }
  if (/tikota/i.test(rawName) || /tikota/i.test(addr.village || '') || /tikkota/i.test(rawName)) {
    return 'Tikota'
  }

  const dKattigenahalli = getDistanceKm(latitude, longitude, 13.1205, 77.6300)
  if (dKattigenahalli <= 1.2) {
    return 'Kattigenahalli'
  }

  const dBellahalli = getDistanceKm(latitude, longitude, 13.1100, 77.6420)
  if (dBellahalli <= 1.2) {
    return 'Bellahalli'
  }

  const dChokkanahalli = getDistanceKm(latitude, longitude, 13.0950, 77.6320)
  if (dChokkanahalli <= 1.2) {
    return 'Chokkanahalli'
  }

  const dKannuru = getDistanceKm(latitude, longitude, 13.0906, 77.6534)
  if (dKannuru <= 1.3) {
    return 'Kannuru'
  }

  const dSampigehalli = getDistanceKm(latitude, longitude, 13.0880, 77.6180)
  if (dSampigehalli <= 1.2) {
    return 'Sampigehalli'
  }

  const dHegdeNagar = getDistanceKm(latitude, longitude, 13.0645, 77.6270)
  if (dHegdeNagar <= 1.2) {
    return 'Hegde Nagar'
  }

  const dThanisandra = getDistanceKm(latitude, longitude, 13.0549, 77.6322)
  if (dThanisandra <= 1.5) {
    return 'Thanisandra'
  }

  const dJakkur = getDistanceKm(latitude, longitude, 13.0783, 77.6074)
  if (dJakkur <= 1.5) {
    return 'Jakkur'
  }

  const dToravi = getDistanceKm(latitude, longitude, 16.8180, 75.6620)
  if (dToravi <= 2.5) {
    return 'Toravi'
  }

  const dTikota = getDistanceKm(latitude, longitude, 16.8286, 75.5412)
  if (dTikota <= 2.5) {
    return 'Tikota'
  }

  const dBabaleshwar = getDistanceKm(latitude, longitude, 16.6500, 75.6000)
  if (dBabaleshwar <= 2.5) {
    return 'Babaleshwar'
  }

  // 3. High-precision local community / neighbourhood / village / hamlet
  let candidate =
    addr.village ||
    addr.hamlet ||
    addr.isolated_dwelling ||
    addr.neighbourhood ||
    addr.residential ||
    ''

  // 4. Strict Kogilu bounding box guard:
  // True Kogilu village is at 13.1039, 77.6167. OSM's 25 sq-km relation falsely tags huge swathes
  // of North Bengaluru as Kogilu. If candidate contains Kogilu but distance > 1.2 km, DISCARD IT.
  const dKogilu = getDistanceKm(latitude, longitude, 13.1039, 77.6167)
  if (/kogilu/i.test(candidate) && dKogilu > 1.2) {
    candidate = ''
  }

  // 5. Named educational / civic / community landmark (excluding generic roads)
  if (!candidate && rawName && data.category !== 'highway' && rawName !== addr.road) {
    if (data.category === 'amenity' || data.type === 'university' || data.type === 'college' || addr.amenity) {
      if (!/kogilu/i.test(rawName) || dKogilu <= 1.2) {
        candidate = rawName
      }
    }
  }

  // 6. Road name locality extraction (e.g. "Bellahalli Main Road" -> "Bellahalli")
  if (!candidate && addr.road) {
    const roadPrefix = addr.road.replace(/\s+(main\s+road|road|cross|layout|street|way)$/i, '').trim()
    if (roadPrefix && roadPrefix !== addr.road && roadPrefix.length >= 3) {
      if (/^(bellahalli|kattigenahalli|nikoo homes|thanisandra|toravi|chokkanahalli|sampigehalli|hegde nagar|kannuru)$/i.test(roadPrefix)) {
        candidate = roadPrefix
      }
    }
  }

  // 7. Broad suburb, quarter, town, locality fallback (strictly filtering out Kogilu if outside village bounds)
  if (!candidate) {
    const suburb = (!/kogilu/i.test(addr.suburb || '') || dKogilu <= 1.2) ? addr.suburb : ''
    candidate =
      addr.quarter ||
      suburb ||
      addr.locality ||
      addr.town ||
      addr.city_district ||
      addr.city ||
      addr.county ||
      ''
  }

  if (/kogilu/i.test(candidate) && dKogilu > 1.2) {
    candidate = addr.city_district || addr.city || 'Bengaluru'
  }

  return candidate
}

const DISTRICT_NAMES: PlaceNames[] = [
  { en: 'Bagalkot', kn: 'ಬಾಗಲಕೋಟೆ', hi: 'बागलकोट' },
  { en: 'Ballari', kn: 'ಬಳ್ಳಾರಿ', hi: 'बल्लारी' },
  { en: 'Belagavi', kn: 'ಬೆಳಗಾವಿ', hi: 'बेलगावी' },
  { en: 'Bengaluru Urban', kn: 'ಬೆಂಗಳೂರು ನಗರ', hi: 'बेंगलुरु शहरी' },
  { en: 'Bengaluru Rural', kn: 'ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ', hi: 'बेंगलुरु ग्रामीण' },
  { en: 'Bengaluru', kn: 'ಬೆಂಗಳೂರು', hi: 'बेंगलुरु' },
  { en: 'Bangalore Urban', kn: 'ಬೆಂಗಳೂರು ನಗರ', hi: 'बेंगलुरु शहरी' },
  { en: 'Bangalore Rural', kn: 'ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ', hi: 'बेंगलुरु ग्रामीण' },
  { en: 'Bangalore', kn: 'ಬೆಂಗಳೂರು', hi: 'बेंगलुरु' },
  { en: 'Bidar', kn: 'ಬೀದರ್', hi: 'बीदर' },
  { en: 'Chamarajanagar', kn: 'ಚಾಮರಾಜನಗರ', hi: 'चामराजनगर' },
  { en: 'Chikkaballapur', kn: 'ಚಿಕ್ಕಬಳ್ಳಾಪುರ', hi: 'चिकबल्लापुर' },
  { en: 'Chikkamagaluru', kn: 'ಚಿಕ್ಕಮಗಳೂರು', hi: 'चिकमगलूर' },
  { en: 'Chitradurga', kn: 'ಚಿತ್ರದುರ್ಗ', hi: 'चित्रदुर्ग' },
  { en: 'Dakshina Kannada', kn: 'ದಕ್ಷಿಣ ಕನ್ನಡ', hi: 'दक्षिण कन्नड़' },
  { en: 'Davanagere', kn: 'ದಾವಣಗೆರೆ', hi: 'दावणगेरे' },
  { en: 'Dharwad', kn: 'ಧಾರವಾಡ', hi: 'धारवाड़' },
  { en: 'Gadag', kn: 'ಗದಗ', hi: 'गदग' },
  { en: 'Hassan', kn: 'ಹಾಸನ', hi: 'हासन' },
  { en: 'Haveri', kn: 'ಹಾವೇರಿ', hi: 'हावेरी' },
  { en: 'Kalaburagi', kn: 'ಕಲಬುರಗಿ', hi: 'कलबुर्गी' },
  { en: 'Kodagu', kn: 'ಕೊಡಗು', hi: 'कोडगु' },
  { en: 'Kolar', kn: 'ಕೋಲಾರ', hi: 'कोलार' },
  { en: 'Koppal', kn: 'ಕೊಪ್ಪಳ', hi: 'कोप्पल' },
  { en: 'Mandya', kn: 'ಮಂಡ್ಯ', hi: 'मांड्या' },
  { en: 'Mysuru', kn: 'ಮೈಸೂರು', hi: 'मैसूरु' },
  { en: 'Raichur', kn: 'ರಾಯಚೂರು', hi: 'रायचूर' },
  { en: 'Ramanagara', kn: 'ರಾಮನಗರ', hi: 'रामनगर' },
  { en: 'Shivamogga', kn: 'ಶಿವಮೊಗ್ಗ', hi: 'शिवमोग्गा' },
  { en: 'Tumakuru', kn: 'ತುಮಕೂರು', hi: 'तुमकुरु' },
  { en: 'Udupi', kn: 'ಉಡುಪಿ', hi: 'उडुपी' },
  { en: 'Uttara Kannada', kn: 'ಉತ್ತರ ಕನ್ನಡ', hi: 'उत्तर कन्नड़' },
  { en: 'Vijayanagara', kn: 'ವಿಜಯನಗರ', hi: 'विजयनगर' },
  { en: 'Vijayapura', kn: 'ವಿಜಯಪುರ', hi: 'विजयपुर' },
  { en: 'Bijapur', kn: 'ವಿಜಯಪುರ', hi: 'विजयपुर' },
  { en: 'Yadgir', kn: 'ಯಾದಗಿರಿ', hi: 'यादगीर' },
]

const COMMON_PLACES: PlaceNames[] = [
  { en: 'REVA University', kn: 'ರೇವಾ ಯೂನಿವರ್ಸಿಟಿ', hi: 'रेवा यूनिवर्सिटी', ta: 'ரேவா பல்கலைக்கழகம்' },
  { en: 'REVA College', kn: 'ರೇವಾ ಕಾಲೇಜು', hi: 'रेवा कॉलेज', ta: 'ரேவா கல்லூரி' },
  { en: 'Kattigenahalli', kn: 'ಕಟ್ಟಿಗೇನಹಳ್ಳಿ', hi: 'कट्टीगेनहल्ली', ta: 'கட்டிகேனஹள்ளி' },
  { en: 'Bellahalli', kn: 'ಬೆಳ್ಳಹಳ್ಳಿ', hi: 'बेल्लाहल्ली', ta: 'பெல்லஹள்ளி' },
  { en: 'Bhartiya City', kn: 'ಭಾರತೀಯ ಸಿಟಿ', hi: 'भारतीय सिटी', ta: 'பாரதிய சிட்டி' },
  { en: 'Nikoo Homes', kn: 'ನಿಕೂ ಹೋಮ್ಸ್', hi: 'निकू होम्स', ta: 'நிகூ ஹோம்ஸ்' },
  { en: 'Thanisandra', kn: 'ತಾನಿಸಂದ್ರ', hi: 'थानिसांद्रा', ta: 'தானிசந்திரா' },
  { en: 'Kannuru', kn: 'ಕಣ್ಣೂರು', hi: 'कन्नूरु', ta: 'கண்ணூர்' },
  { en: 'Sampigehalli', kn: 'ಸಂಪಿಗೆಹಳ್ಳಿ', hi: 'संपिगेहल्ली', ta: 'சம்பிகேஹள்ளி' },
  { en: 'Hegde Nagar', kn: 'ಹೆಗಡೆ ನಗರ', hi: 'हेगड़े नगर', ta: 'ஹெக்டே நகர்' },
  { en: 'Jakkur', kn: 'ಜಕ್ಕೂರು', hi: 'जक्कूर', ta: 'ஜக்கூர்' },
  { en: 'Chokkanahalli', kn: 'ಚೊಕ್ಕನಹಳ್ಳಿ', hi: 'चोकनहल्ली', ta: 'சொக்கனஹள்ளி' },
  { en: 'Kogilu', kn: 'ಕೋಗಿಲು', hi: 'कोगिलु', ta: 'கோகிலு' },
  { en: 'Yelahanka', kn: 'ಯಲಹಂಕ', hi: 'यलहंका', ta: 'யலஹங்கா' },
  { en: 'Allalasandra', kn: 'ಅಲ್ಲಾಲಸಂದ್ರ', hi: 'अल्लालसंद्रा', ta: 'அல்லாலசந்திரா' },
  { en: 'Hebbal', kn: 'ಹೆಬ್ಬಾಳ', hi: 'हेब्बल', ta: 'ஹெப்பால்' },
  { en: 'Jalahalli', kn: 'ಜಾಲಹಳ್ಳಿ', hi: 'जालहल्ली', ta: 'ஜாலஹள்ளி' },
  { en: 'Toravi', kn: 'ತೊರವಿ', hi: 'तोरवी', ta: 'தொரவி' },
  { en: 'Tikota', kn: 'ಟಿಕೋಟ', hi: 'टिकोता', ta: 'டிகோடா' },
  { en: 'Tikota', kn: 'ತಿಕ್ಕೋಟ', hi: 'टिकोता', ta: 'டிகோடா' },
  { en: 'Babaleshwar', kn: 'ಬಬಲೇಶ್ವರ', hi: 'बाबलेश्वर', ta: 'பபலேஷ்வர்' },
  { en: 'Hubballi', kn: 'ಹುಬ್ಬಳ್ಳಿ', hi: 'हुबली', ta: 'ஹுப்பள்ளி' },
  { en: 'Ranebennur', kn: 'ರಾಣೆಬೆನ್ನೂರು', hi: 'राणेबेन्नूर', ta: 'ராணேபென்னூர்' },
  { en: 'Sirsi', kn: 'ಶಿರಸಿ', hi: 'सिरसी', ta: 'சிரசி' },
  { en: 'Sindhanur', kn: 'ಸಿಂಧನೂರು', hi: 'सिंधानूर', ta: 'சிந்தனூர்' },
  { en: 'Gangavathi', kn: 'ಗಂಗಾವತಿ', hi: 'गंगावती', ta: 'கங்காவதி' },
  { en: 'Karnataka', kn: 'ಕರ್ನಾಟಕ', hi: 'कर्नाटक', ta: 'கர்நாடகா' },
  { en: 'India', kn: 'ಭಾರತ', hi: 'भारत', ta: 'இந்தியா' },
]

const ALL_PLACES = [...DISTRICT_NAMES, ...COMMON_PLACES]

// Fast lookup maps
const KN_TO_EN = new Map<string, string>()
const HI_TO_EN = new Map<string, string>()
const TA_TO_EN = new Map<string, string>()
const EN_TO_KN = new Map<string, string>()
const EN_TO_HI = new Map<string, string>()
const EN_TO_TA = new Map<string, string>()

for (const p of ALL_PLACES) {
  const knKey = p.kn.trim().toLowerCase()
  const hiKey = p.hi.trim().toLowerCase()
  const enKey = p.en.trim().toLowerCase()
  const taKey = p.ta?.trim().toLowerCase()

  if (!KN_TO_EN.has(knKey)) KN_TO_EN.set(knKey, p.en)
  if (!HI_TO_EN.has(hiKey)) HI_TO_EN.set(hiKey, p.en)
  if (taKey && !TA_TO_EN.has(taKey)) TA_TO_EN.set(taKey, p.en)

  if (!EN_TO_KN.has(enKey)) EN_TO_KN.set(enKey, p.kn)
  if (!EN_TO_HI.has(enKey)) EN_TO_HI.set(enKey, p.hi)
  if (p.ta && !EN_TO_TA.has(enKey)) EN_TO_TA.set(enKey, p.ta)
}

// -----------------------------------------------------------------------------
// Phonetic Transliteration Fallback (Kannada Unicode <-> Latin)
// -----------------------------------------------------------------------------

const KN_VOWELS: Record<number, string> = {
  0x0c85: 'a', 0x0c86: 'aa', 0x0c87: 'i', 0x0c88: 'ee', 0x0c89: 'u', 0x0c8a: 'oo', 0x0c8b: 'ru',
  0x0c8e: 'e', 0x0c8f: 'e', 0x0c90: 'ai', 0x0c92: 'o', 0x0c93: 'o', 0x0c94: 'au',
}

const KN_CONSONANTS: Record<number, string> = {
  0x0c95: 'k', 0x0c96: 'kh', 0x0c97: 'g', 0x0c98: 'gh', 0x0c99: 'ng',
  0x0c9a: 'ch', 0x0c9b: 'chh', 0x0c9c: 'j', 0x0c9d: 'jh', 0x0c9e: 'ny',
  0x0c9f: 't', 0x0ca0: 'th', 0x0ca1: 'd', 0x0ca2: 'dh', 0x0ca3: 'n',
  0x0ca4: 't', 0x0ca5: 'th', 0x0ca6: 'd', 0x0ca7: 'dh', 0x0ca8: 'n',
  0x0caa: 'p', 0x0cab: 'ph', 0x0cac: 'b', 0x0cad: 'bh', 0x0cae: 'm',
  0x0caf: 'y', 0x0cb0: 'r', 0x0cb1: 'r', 0x0cb2: 'l', 0x0cb3: 'l', 0x0cb5: 'v',
  0x0cb6: 'sh', 0x0cb7: 'sh', 0x0cb8: 's', 0x0cb9: 'h',
}

const KN_MATRAS: Record<number, string> = {
  0x0cbe: 'a', 0x0cbf: 'i', 0x0cc0: 'ee', 0x0cc1: 'u', 0x0cc2: 'oo', 0x0cc3: 'ru',
  0x0cc6: 'e', 0x0cc7: 'e', 0x0cc8: 'ai', 0x0cca: 'o', 0x0ccb: 'o', 0x0ccc: 'au',
}

function transliterateKnToEn(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (KN_VOWELS[code]) {
      out += KN_VOWELS[code]
    } else if (KN_CONSONANTS[code]) {
      const c = KN_CONSONANTS[code]
      const next = text.charCodeAt(i + 1)
      if (KN_MATRAS[next]) {
        out += c + KN_MATRAS[next]
        i++
      } else if (next === 0x0ccd) {
        // Halant (virama): suppress inherent vowel
        out += c
        i++
      } else if (next === 0x0c82) {
        // Anusvara
        out += c + 'an'
        i++
      } else {
        out += c + 'a'
      }
    } else if (code === 0x0c82) {
      out += 'n'
    } else if (code === 0x0ccd) {
      // Standalone virama
    } else {
      out += text[i]
    }
  }
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : text
}

function hasKannadaChars(str: string): boolean {
  return /[\u0C80-\u0CFF]/.test(str)
}

/**
 * Normalizes any place or district name to the target language (en, kn, hi, ta).
 */
export function normalizePlaceName(rawName: string, targetLanguage: Language = 'en'): string {
  const trimmed = rawName.trim()
  if (!trimmed) return ''

  // Standardize common aliases (e.g. clinic/health centre inside REVA)
  let standardName = trimmed
  if (/reva/i.test(trimmed)) {
    standardName = 'REVA University'
  }

  const lower = standardName.toLowerCase()

  // 1. Target: English
  if (targetLanguage === 'en') {
    if (KN_TO_EN.has(lower)) return KN_TO_EN.get(lower)!
    if (HI_TO_EN.has(lower)) return HI_TO_EN.get(lower)!
    if (TA_TO_EN.has(lower)) return TA_TO_EN.get(lower)!
    if (hasKannadaChars(standardName)) {
      return transliterateKnToEn(standardName)
    }
    return standardName
  }

  // 2. Target: Kannada
  if (targetLanguage === 'kn') {
    if (EN_TO_KN.has(lower)) return EN_TO_KN.get(lower)!
    if (HI_TO_EN.has(lower)) {
      const en = HI_TO_EN.get(lower)!.toLowerCase()
      if (EN_TO_KN.has(en)) return EN_TO_KN.get(en)!
    }
    if (TA_TO_EN.has(lower)) {
      const en = TA_TO_EN.get(lower)!.toLowerCase()
      if (EN_TO_KN.has(en)) return EN_TO_KN.get(en)!
    }
    return standardName
  }

  // 3. Target: Hindi
  if (targetLanguage === 'hi') {
    if (EN_TO_HI.has(lower)) return EN_TO_HI.get(lower)!
    if (KN_TO_EN.has(lower)) {
      const en = KN_TO_EN.get(lower)!.toLowerCase()
      if (EN_TO_HI.has(en)) return EN_TO_HI.get(en)!
    }
    if (TA_TO_EN.has(lower)) {
      const en = TA_TO_EN.get(lower)!.toLowerCase()
      if (EN_TO_HI.has(en)) return EN_TO_HI.get(en)!
    }
    return standardName
  }

  // 4. Target: Tamil
  if (targetLanguage === 'ta') {
    if (EN_TO_TA.has(lower)) return EN_TO_TA.get(lower)!
    if (KN_TO_EN.has(lower)) {
      const en = KN_TO_EN.get(lower)!.toLowerCase()
      if (EN_TO_TA.has(en)) return EN_TO_TA.get(en)!
    }
    if (HI_TO_EN.has(lower)) {
      const en = HI_TO_EN.get(lower)!.toLowerCase()
      if (EN_TO_TA.has(en)) return EN_TO_TA.get(en)!
    }
    return standardName
  }

  return standardName
}

function cleanDistrict(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/\s+(district|taluk|taluka|urban taluku|rural taluku|tahsil|tehsil)$/i, '')
    // OSM calls the Bengaluru city district "Bengaluru Urban"; machines are listed under "Bengaluru".
    .replace(/\s+urban$/i, '')
    .trim()
}

// -----------------------------------------------------------------------------
// In-Memory Reverse Geocoding Cache & Request Deduplication
// -----------------------------------------------------------------------------

const reverseGeocodeCache = new Map<string, ReverseGeocodeResult>()
const inflightReverseGeocode = new Map<string, Promise<ReverseGeocodeResult | null>>()
const REVERSE_CACHE_MAX = 200

export function clearReverseGeocodeCache(): void {
  reverseGeocodeCache.clear()
  inflightReverseGeocode.clear()
}

function getGeocodeCacheKey(coords: Coordinates, lang: Language): string {
  return `${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)},${lang}`
}

/**
 * Reverse geocodes latitude & longitude into a human-readable village/town,
 * revenue district, and state according to the user's active language ('en', 'kn', 'hi').
 *
 * Performance features:
 * - In-memory cache by rounded coordinates (~110m resolution) & language.
 * - Simultaneous request deduplication.
 * - Guaranteed timeout cleanup in finally blocks.
 * - Fast-fail timeout budget (2.5s Nominatim + 2.0s BigDataCloud fallback).
 * - Full AbortSignal support for client cancellation.
 */
export async function reverseGeocode(
  coords: Coordinates,
  language: Language = 'en',
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult | null> {
  if (
    !coords ||
    typeof coords.latitude !== 'number' ||
    typeof coords.longitude !== 'number' ||
    Number.isNaN(coords.latitude) ||
    Number.isNaN(coords.longitude)
  ) {
    return null
  }

  if (signal?.aborted) return null

  const cacheKey = getGeocodeCacheKey(coords, language)
  const cached = reverseGeocodeCache.get(cacheKey)
  if (cached) return cached

  const existingPromise = inflightReverseGeocode.get(cacheKey)
  if (existingPromise) return existingPromise

  const fetchPromise = (async (): Promise<ReverseGeocodeResult | null> => {
    const { latitude, longitude } = coords
    const acceptLang = language === 'kn' ? 'kn,en' : language === 'hi' ? 'hi,en' : 'en'
    const bdcLang = language === 'kn' ? 'kn' : language === 'hi' ? 'hi' : 'en'

    // 1. Primary: Try serverless /api/geocode endpoint in browser, or direct Nominatim OSM
    let primaryResult: ReverseGeocodeResult | null = null
    const primaryController = new AbortController()
    const onAbortPrimary = () => primaryController.abort()
    signal?.addEventListener('abort', onAbortPrimary, { once: true })
    const primaryTimer = setTimeout(() => primaryController.abort(), 3500)

    try {
      // In browser: first try same-origin /api/geocode (runs on server without CORS/403 blocks)
      // If /api/geocode fails or returns non-JSON, fallback to direct Nominatim OSM
      const isClientBrowser = typeof window !== 'undefined' && Boolean(window.location?.host)
      const primaryUrl = isClientBrowser
        ? `/api/geocode?lat=${latitude}&lon=${longitude}&lang=${language}`
        : `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=${acceptLang}`

      let res = await fetch(primaryUrl, {
        headers: { Accept: 'application/json' },
        signal: primaryController.signal,
      })

      // If client browser called /api/geocode and got non-JSON or error, try direct Nominatim
      const contentType = res.headers?.get ? res.headers.get('content-type') || '' : 'application/json'
      if (isClientBrowser && (!res.ok || (contentType && !contentType.includes('application/json')))) {
        const nomDirectUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=${acceptLang}`
        res = await fetch(nomDirectUrl, {
          headers: { Accept: 'application/json' },
          signal: primaryController.signal,
        })
      }

      if (res.ok) {
        const resContentType = res.headers?.get ? res.headers.get('content-type') || '' : 'application/json'
        if (!resContentType || resContentType.includes('application/json')) {
          const data = await res.json()
          let rawVillage = ''
          let rawDistrict = ''
          let rawState = ''

          if (data && typeof data === 'object') {
            if ('address' in data && data.address) {
              const addr = data.address as Record<string, string>
              rawVillage = resolveAccuratePlaceName(
                data as { name?: string; category?: string; type?: string; address?: Record<string, string> },
                latitude,
                longitude,
              )
              rawDistrict = cleanDistrict(addr.state_district || addr.county || '')
              rawState = addr.state || ''
            } else if ('village' in data || 'district' in data) {
              const d = data as { village?: string; district?: string; state?: string }
              rawVillage = d.village || d.district || ''
              rawDistrict = cleanDistrict(d.district || d.village || '')
              rawState = d.state || ''
            }
          }

          if (rawVillage || rawDistrict) {
            const village = normalizePlaceName(rawVillage || rawDistrict, language)
            const district = normalizePlaceName(rawDistrict || rawVillage, language)
            const state = normalizePlaceName(rawState, language)
            primaryResult = {
              village: village || district,
              district: district || village,
              state,
            }
          }
        }
      }
    } catch {
      // Fall through to secondary provider
    } finally {
      clearTimeout(primaryTimer)
      signal?.removeEventListener('abort', onAbortPrimary)
    }

    if (primaryResult) {
      if (reverseGeocodeCache.size >= REVERSE_CACHE_MAX) {
        const first = reverseGeocodeCache.keys().next().value
        if (first) reverseGeocodeCache.delete(first)
      }
      reverseGeocodeCache.set(cacheKey, primaryResult)
      return primaryResult
    }

    if (signal?.aborted) return null

    // 2. Fallback: BigDataCloud client reverse geocode API with 2.0s timeout
    const bdcController = new AbortController()
    const onAbortBdc = () => bdcController.abort()
    signal?.addEventListener('abort', onAbortBdc, { once: true })
    const bdcTimer = setTimeout(() => bdcController.abort(), 2000)

    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${bdcLang}`
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: bdcController.signal,
      })

      if (res.ok) {
        const data = await res.json()
        let rawVillage = data.locality || data.city || ''
        let rawDistrict = ''
        if (Array.isArray(data.localityInfo?.administrative)) {
          const fineObj = [...data.localityInfo.administrative]
            .reverse()
            .find((a: { adminLevel?: number; name?: string }) => (a.adminLevel ?? 0) >= 8 && a.name)
          if (fineObj?.name && !rawVillage) {
            rawVillage = fineObj.name
          }

          const dObj = data.localityInfo.administrative.find(
            (a: { adminLevel?: number; name?: string }) =>
              a.adminLevel === 5 || a.adminLevel === 6 || (a.name && /district/i.test(a.name)),
          )
          if (dObj?.name) {
            rawDistrict = cleanDistrict(dObj.name)
          }
        }

        // Apply proximity overrides & Kogilu relation guard for BigDataCloud
        const dReva = getDistanceKm(latitude, longitude, 13.1154, 77.6358)
        const dBhartiya = getDistanceKm(latitude, longitude, 13.0845, 77.6410)
        const dKattigenahalli = getDistanceKm(latitude, longitude, 13.1205, 77.6300)
        const dBellahalli = getDistanceKm(latitude, longitude, 13.1100, 77.6420)
        const dChokkanahalli = getDistanceKm(latitude, longitude, 13.0950, 77.6320)
        const dKannuru = getDistanceKm(latitude, longitude, 13.0906, 77.6534)
        const dSampigehalli = getDistanceKm(latitude, longitude, 13.0880, 77.6180)
        const dHegdeNagar = getDistanceKm(latitude, longitude, 13.0645, 77.6270)
        const dThanisandra = getDistanceKm(latitude, longitude, 13.0549, 77.6322)
        const dJakkur = getDistanceKm(latitude, longitude, 13.0783, 77.6074)
        const dToravi = getDistanceKm(latitude, longitude, 16.8180, 75.6620)
        const dTikota = getDistanceKm(latitude, longitude, 16.8286, 75.5412)
        const dBabaleshwar = getDistanceKm(latitude, longitude, 16.6500, 75.6000)
        const dKogilu = getDistanceKm(latitude, longitude, 13.1039, 77.6167)

        if (dReva <= 1.2 || /reva/i.test(rawVillage)) {
          rawVillage = 'REVA University'
        } else if (dBhartiya <= 1.5 || /bhartiya|nikoo/i.test(rawVillage)) {
          rawVillage = 'Bhartiya City'
        } else if (dKattigenahalli <= 1.2) {
          rawVillage = 'Kattigenahalli'
        } else if (dBellahalli <= 1.2) {
          rawVillage = 'Bellahalli'
        } else if (dChokkanahalli <= 1.2) {
          rawVillage = 'Chokkanahalli'
        } else if (dKannuru <= 1.3) {
          rawVillage = 'Kannuru'
        } else if (dSampigehalli <= 1.2) {
          rawVillage = 'Sampigehalli'
        } else if (dHegdeNagar <= 1.2) {
          rawVillage = 'Hegde Nagar'
        } else if (dThanisandra <= 1.5) {
          rawVillage = 'Thanisandra'
        } else if (dJakkur <= 1.5) {
          rawVillage = 'Jakkur'
        } else if (dToravi <= 2.5) {
          rawVillage = 'Toravi'
        } else if (dTikota <= 2.5) {
          rawVillage = 'Tikota'
        } else if (dBabaleshwar <= 2.5) {
          rawVillage = 'Babaleshwar'
        } else if (/kogilu/i.test(rawVillage) && dKogilu > 1.2) {
          rawVillage = data.locality || data.city || ''
          if (/kogilu/i.test(rawVillage)) {
            rawVillage = data.city || 'Bengaluru'
          }
        }

        const rawState = data.principalSubdivision || ''
        if (rawVillage || rawDistrict) {
          const village = normalizePlaceName(rawVillage || rawDistrict, language)
          const district = normalizePlaceName(rawDistrict || rawVillage, language)
          const state = normalizePlaceName(rawState, language)
          const result: ReverseGeocodeResult = {
            village: village || district,
            district: district || village,
            state,
          }
          if (reverseGeocodeCache.size >= REVERSE_CACHE_MAX) {
            const first = reverseGeocodeCache.keys().next().value
            if (first) reverseGeocodeCache.delete(first)
          }
          reverseGeocodeCache.set(cacheKey, result)
          return result
        }
      }
    } catch {
      // Both failed or offline
    } finally {
      clearTimeout(bdcTimer)
      signal?.removeEventListener('abort', onAbortBdc)
    }

    return null
  })()

  inflightReverseGeocode.set(cacheKey, fetchPromise)
  try {
    return await fetchPromise
  } finally {
    inflightReverseGeocode.delete(cacheKey)
  }
}

const KNOWN_PLACE_COORDINATES: Record<string, Coordinates> = {
  'reva university': { latitude: 13.1154, longitude: 77.6358 },
  'reva college': { latitude: 13.1154, longitude: 77.6358 },
  reva: { latitude: 13.1154, longitude: 77.6358 },
  bellahalli: { latitude: 13.1100, longitude: 77.6420 },
  'bhartiya city': { latitude: 13.0845, longitude: 77.6410 },
  'nikoo homes': { latitude: 13.0855, longitude: 77.6405 },
  thanisandra: { latitude: 13.0549, longitude: 77.6322 },
  kannuru: { latitude: 13.0906, longitude: 77.6534 },
  chokkanahalli: { latitude: 13.0784, longitude: 77.6253 },
  kogilu: { latitude: 13.1067, longitude: 77.6174 },
  yelahanka: { latitude: 13.1007, longitude: 77.5963 },
  sampigehalli: { latitude: 13.0844, longitude: 77.6326 },
  kattigenahalli: { latitude: 13.1186, longitude: 77.632 },
  tikota: { latitude: 16.8286, longitude: 75.5412 },
  toravi: { latitude: 16.8155, longitude: 75.6601 },
  aninapur: { latitude: 16.85, longitude: 75.6 },
  allalasandra: { latitude: 13.0838, longitude: 77.5855 },
  hebbal: { latitude: 13.0358, longitude: 77.597 },
  jalahalli: { latitude: 13.0528, longitude: 77.5407 },
  babaleshwar: { latitude: 16.6667, longitude: 75.5333 },
  hubballi: { latitude: 15.3647, longitude: 75.124 },
  ranebennur: { latitude: 14.6231, longitude: 75.6218 },
  sirsi: { latitude: 14.6195, longitude: 74.8354 },
  sindhanur: { latitude: 15.7667, longitude: 76.7667 },
  gangavathi: { latitude: 15.4333, longitude: 76.5333 },
  bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  bangalore: { latitude: 12.9716, longitude: 77.5946 },
  vijayapura: { latitude: 16.8302, longitude: 75.71 },
  bijapur: { latitude: 16.8302, longitude: 75.71 },
  bagalkot: { latitude: 16.18, longitude: 75.69 },
  belagavi: { latitude: 15.8497, longitude: 74.4977 },
  kalaburagi: { latitude: 17.3297, longitude: 76.8343 },
}

const memoryCoordsCache = new Map<string, Coordinates>()

export async function resolveVillageCoordinates(
  village: string,
  district?: string,
): Promise<Coordinates | null> {
  const normVillage = normalizePlaceName(village, 'en').trim().toLowerCase()
  if (!normVillage) return null

  if (KNOWN_PLACE_COORDINATES[normVillage]) {
    return KNOWN_PLACE_COORDINATES[normVillage]
  }

  const cacheKey = `${normVillage}:${(district || '').trim().toLowerCase()}`
  if (memoryCoordsCache.has(cacheKey)) {
    return memoryCoordsCache.get(cacheKey)!
  }

  try {
    const rawStorage = typeof window !== 'undefined' ? window.localStorage.getItem(`hr_geo_${cacheKey}`) : null
    if (rawStorage) {
      const parsed = JSON.parse(rawStorage) as Coordinates
      if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
        memoryCoordsCache.set(cacheKey, parsed)
        return parsed
      }
    }
  } catch {
    // Ignore storage errors
  }

  try {
    const query = district ? `${village}, ${district}, Karnataka, India` : `${village}, Karnataka, India`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=1`,
      {
        headers: { Accept: 'application/json', 'User-Agent': 'HarvestRentalsApp/1.0' },
        signal: controller.signal,
      },
    )
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const coords: Coordinates = {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        }
        memoryCoordsCache.set(cacheKey, coords)
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`hr_geo_${cacheKey}`, JSON.stringify(coords))
          }
        } catch {
          // Ignore
        }
        return coords
      }
    }
  } catch {
    // Offline or timeout
  }

  return null
}

