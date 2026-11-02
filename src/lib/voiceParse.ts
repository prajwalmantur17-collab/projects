/**
 * Turns what a person says (speech-to-text output) into form values.
 * Pure functions with no browser APIs, so they are easy to test.
 * Handles English, Hindi and Kannada, including Roman-script Hindi.
 */

export function normalizeDigits(value: string): string {
  return value.replace(/[०-९೦-೯௦-௯]/g, (char) => {
    const code = char.charCodeAt(0)
    if (code >= 0x0ce6) return String(code - 0x0ce6) // Kannada
    if (code >= 0x0be6) return String(code - 0x0be6) // Tamil
    return String(code - 0x0966) // Devanagari
  })
}

/** Lower-cases, converts Indian digits, drops joiners and punctuation. */
export function normalizeSpeech(value: string): string {
  return normalizeDigits(value.normalize('NFC').toLowerCase())
    .replace(/\p{Cf}/gu, '')
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1')
    .replace(/[^\p{L}\p{M}\p{N}.\s/-]/gu, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeSpeech(value).split(' ').filter(Boolean)
}

function normalizeKeys<T>(table: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {}
  for (const [key, value] of Object.entries(table)) result[normalizeSpeech(key)] = value
  return result
}

function normalizeList(list: string[]): string[] {
  return list.map(normalizeSpeech)
}

// ---------------------------------------------------------------- numbers

const UNIT_WORDS = normalizeKeys<number>({
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // Hindi (Roman script)
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6, che: 6, saat: 7,
  aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15,
  solah: 16, satrah: 17, atharah: 18, unnis: 19, bees: 20, tees: 30, chalis: 40, pachas: 50,
  saath: 60, sattar: 70, assi: 80, nabbe: 90,
  // Hindi (Devanagari)
  'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'छः': 6,
  'छे': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10, 'ग्यारह': 11, 'बारह': 12, 'तेरह': 13,
  'चौदह': 14, 'पंद्रह': 15, 'पन्द्रह': 15, 'सोलह': 16, 'सत्रह': 17, 'अठारह': 18, 'उन्नीस': 19,
  'बीस': 20, 'तीस': 30, 'चालीस': 40, 'पचास': 50, 'साठ': 60, 'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90,
  // Kannada
  'ಸೊನ್ನೆ': 0, 'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4, 'ಐದು': 5, 'ಆರು': 6, 'ಏಳು': 7,
  'ಎಂಟು': 8, 'ಒಂಬತ್ತು': 9, 'ಹತ್ತು': 10, 'ಹನ್ನೊಂದು': 11, 'ಹನ್ನೆರಡು': 12, 'ಹದಿಮೂರು': 13,
  'ಹದಿನಾಲ್ಕು': 14, 'ಹದಿನೈದು': 15, 'ಹದಿನಾರು': 16, 'ಹದಿನೇಳು': 17, 'ಹದಿನೆಂಟು': 18,
  'ಹತ್ತೊಂಬತ್ತು': 19, 'ಇಪ್ಪತ್ತು': 20, 'ಮೂವತ್ತು': 30, 'ನಲವತ್ತು': 40, 'ಐವತ್ತು': 50,
  'ಅರವತ್ತು': 60, 'ಎಪ್ಪತ್ತು': 70, 'ಎಂಬತ್ತು': 80, 'ತೊಂಬತ್ತು': 90, 'ಇನ್ನೂರು': 200,
  'ಮುನ್ನೂರು': 300, 'ನಾನೂರು': 400, 'ಐನೂರು': 500, 'ಆರುನೂರು': 600, 'ಏಳುನೂರು': 700,
  'ಎಂಟುನೂರು': 800, 'ಒಂಬೈನೂರು': 900,
  // Tamil
  'பூஜ்ஜியம்': 0, 'சைபர்': 0, 'ஜீரோ': 0, 'ஒன்று': 1, 'ஒரு': 1, 'இரண்டு': 2, 'மூன்று': 3,
  'நான்கு': 4, 'ஐந்து': 5, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10,
  'பதினொன்று': 11, 'பன்னிரண்டு': 12, 'பதிமூன்று': 13, 'பதினான்கு': 14, 'பதினைந்து': 15,
  'பதினாறு': 16, 'பதினேழு': 17, 'பதினெட்டு': 18, 'பத்தொன்பது': 19, 'இருபது': 20,
  'முப்பது': 30, 'நாற்பது': 40, 'ஐம்பது': 50, 'அறுபது': 60, 'எழுபது': 70, 'எண்பது': 80,
  'தொண்ணூறு': 90, 'இருநூறு': 200, 'முன்னூறு': 300, 'நானூறு': 400, 'ஐந்நூறு': 500,
  'அறுநூறு': 600, 'எழுநூறு': 700, 'எண்ணூறு': 800, 'தொள்ளாயிரம்': 900,
})

const MULTIPLIER_WORDS = normalizeKeys<number>({
  hundred: 100, sau: 100, 'सौ': 100, 'ನೂರು': 100, 'நூறு': 100,
  thousand: 1000, hazaar: 1000, hazar: 1000, 'हजार': 1000, 'हज़ार': 1000, 'ಸಾವಿರ': 1000,
  'ஆயிரம்': 1000,
  lakh: 100000, lac: 100000, 'लाख': 100000, 'ಲಕ್ಷ': 100000, 'லட்சம்': 100000,
})

const HALF_WORDS = normalizeList(['half', 'aadha', 'adha', 'aadhe', 'आधा', 'आधे', 'ಅರ್ಧ', 'அரை'])
const ONE_AND_HALF_WORDS = normalizeList(['dedh', 'डेढ़', 'डेढ', 'ಒಂದೂವರೆ', 'ஒன்றரை'])
const TWO_AND_HALF_WORDS = normalizeList(['dhai', 'dhaai', 'ढाई', 'ಎರಡೂವರೆ', 'இரண்டரை'])

function numberFromWords(tokens: string[]): number | null {
  let total = 0
  let current = 0
  let seen = false
  for (const token of tokens) {
    const unit = UNIT_WORDS[token]
    const multiplier = MULTIPLIER_WORDS[token]
    if (unit !== undefined) {
      current += unit
      seen = true
    } else if (multiplier !== undefined) {
      if (multiplier === 100) {
        current = (current || 1) * 100
      } else {
        total += (current || 1) * multiplier
        current = 0
      }
      seen = true
    }
  }
  return seen ? total + current : null
}

/** "5", "five", "2 and a half", "paanch hazaar", "ಐದು" ... -> number. */
export function parseNumber(text: string): number | null {
  const normalized = normalizeSpeech(text)
  const tokens = normalized.split(' ').filter(Boolean)
  if (tokens.some((token) => ONE_AND_HALF_WORDS.includes(token))) return 1.5
  if (tokens.some((token) => TWO_AND_HALF_WORDS.includes(token))) return 2.5
  const hasHalf = tokens.some((token) => HALF_WORDS.includes(token))
  const digits = normalized.match(/\d+(?:\.\d+)?/)
  if (digits) {
    const value = Number(digits[0])
    return hasHalf ? value + 0.5 : value
  }
  const words = numberFromWords(tokens)
  if (words !== null) return hasHalf ? words + 0.5 : words
  return hasHalf ? 0.5 : null
}

// ------------------------------------------------------------------ phone

const REPEAT_WORDS = normalizeKeys<number>({
  double: 2, triple: 3, dabal: 2, 'डबल': 2, 'ट्रिपल': 3, 'ಡಬಲ್': 2, 'டபுள்': 2, 'டிரிபிள்': 3,
})

/** Collects spoken digits ("98765 43210", "nine eight ...") into a 10 digit Indian mobile number. */
export function extractPhone(text: string): string | null {
  let digits = ''
  let repeat = 1
  for (const token of tokenize(text)) {
    const repeatBy = REPEAT_WORDS[token]
    if (repeatBy !== undefined) {
      repeat = repeatBy
      continue
    }
    let chunk = ''
    if (/^[\d.-]+$/.test(token)) {
      chunk = token.replace(/\D/g, '')
    } else if (token === 'oh' || token === 'o') {
      chunk = '0'
    } else {
      const unit = UNIT_WORDS[token]
      if (unit !== undefined && unit <= 9) chunk = String(unit)
    }
    if (chunk) {
      digits += repeat > 1 && chunk.length === 1 ? chunk.repeat(repeat) : chunk
      repeat = 1
    }
  }
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

/** "9876543210" -> "9 8 7 6 5 4 3 2 1 0" so speech reads it digit by digit. */
export function spokenDigits(value: string): string {
  return value.split('').join(' ')
}

// ------------------------------------------------------------------ dates

export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function buildIso(year: number, month: number, day: number): string | null {
  const fullYear = year < 100 ? 2000 + year : year
  const date = new Date(Date.UTC(fullYear, month - 1, day))
  if (
    date.getUTCFullYear() !== fullYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date.toISOString().slice(0, 10)
}

const TODAY_WORDS = normalizeList(['today', 'aaj', 'आज', 'ಇಂದು', 'இன்று'])
const TOMORROW_WORDS = normalizeList(['tomorrow', 'kal', 'कल', 'ನಾಳೆ', 'நாளை'])
const DAY_AFTER_WORDS = normalizeList(['parso', 'parson', 'परसों', 'परसो', 'ನಾಡಿದ್ದು', 'நாளைமறுநாள்', 'நாளன்னிக்கு'])
const DAY_AFTER_PHRASES = normalizeList(['day after tomorrow', 'day after'])

const MONTHS = normalizeKeys<number>({
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5,
  june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
  'जनवरी': 1, 'फरवरी': 2, 'फ़रवरी': 2, 'मार्च': 3, 'अप्रैल': 4, 'मई': 5, 'जून': 6,
  'जुलाई': 7, 'अगस्त': 8, 'सितंबर': 9, 'सितम्बर': 9, 'अक्टूबर': 10, 'अक्तूबर': 10,
  'नवंबर': 11, 'नवम्बर': 11, 'दिसंबर': 12, 'दिसम्बर': 12,
  'ಜನವರಿ': 1, 'ಫೆಬ್ರವರಿ': 2, 'ಮಾರ್ಚ್': 3, 'ಏಪ್ರಿಲ್': 4, 'ಮೇ': 5, 'ಜೂನ್': 6, 'ಜುಲೈ': 7,
  'ಆಗಸ್ಟ್': 8, 'ಸೆಪ್ಟೆಂಬರ್': 9, 'ಅಕ್ಟೋಬರ್': 10, 'ನವೆಂಬರ್': 11, 'ಡಿಸೆಂಬರ್': 12,
  'ஜனவரி': 1, 'பிப்ரவரி': 2, 'மார்ச்': 3, 'ஏப்ரல்': 4, 'மே': 5, 'ஜூன்': 6, 'ஜூலை': 7,
  'ஆகஸ்ட்': 8, 'செப்டம்பர்': 9, 'அக்டோபர்': 10, 'நவம்பர்': 11, 'டிசம்பர்': 12,
})

function findMonth(tokens: string[]): { month: number; index: number } | null {
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    for (const [name, month] of Object.entries(MONTHS)) {
      const indic = /\P{ASCII}/u.test(name)
      if (token === name || (indic && name.length >= 4 && token.startsWith(name))) {
        return { month, index }
      }
    }
  }
  return null
}

/**
 * "tomorrow", "15 November", "november 5th", "15/11", "in 3 days", "ನಾಳೆ", "कल" -> yyyy-mm-dd.
 * Dates without a year mean the next time that day comes around.
 */
export function parseSpokenDate(text: string, todayIso: string): string | null {
  const normalized = normalizeSpeech(text)
  const tokens = normalized.split(' ').filter(Boolean)
  const has = (words: string[]) => tokens.some((token) => words.includes(token))

  if (DAY_AFTER_PHRASES.some((phrase) => normalized.includes(phrase)) || has(DAY_AFTER_WORDS)) {
    return addDaysIso(todayIso, 2)
  }
  if (has(TOMORROW_WORDS)) return addDaysIso(todayIso, 1)
  if (has(TODAY_WORDS)) return todayIso

  const thisYear = Number(todayIso.slice(0, 4))
  const finish = (month: number, day: number, explicitYear: number | null): string | null => {
    let iso = buildIso(explicitYear ?? thisYear, month, day)
    if (iso && explicitYear === null && iso < todayIso) iso = buildIso(thisYear + 1, month, day)
    return iso
  }

  const found = findMonth(tokens)
  if (found) {
    const numbers = tokens.flatMap((token) => {
      const match = token.match(/^(\d{1,4})(?:st|nd|rd|th)?$/)
      return match ? [Number(match[1])] : []
    })
    let day = numbers.find((value) => value >= 1 && value <= 31) ?? null
    const year = numbers.find((value) => value >= 2000 && value <= 2100) ?? null
    if (day === null) {
      const word = numberFromWords(tokens.filter((_, index) => index !== found.index))
      if (word !== null && word >= 1 && word <= 31) day = word
    }
    if (day !== null) return finish(found.month, day, year)
  }

  const numeric = normalized.match(/(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?/)
  if (numeric) {
    const rawYear = numeric[3] ? Number(numeric[3]) : null
    const year = rawYear === null ? null : rawYear < 100 ? 2000 + rawYear : rawYear
    return finish(Number(numeric[2]), Number(numeric[1]), year)
  }

  const relative = normalized.match(/(\d+)\s*(?:days?|din|दिन|ದಿನ|நாட்கள்|நாள்)/)
  if (relative) {
    const days = Number(relative[1])
    if (days >= 0 && days <= 365) return addDaysIso(todayIso, days)
  }
  return null
}

// ---------------------------------------------------------- yes / no / skip

const YES_WORDS = normalizeList([
  'yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'correct', 'right', 'sure', 'confirm', 'proceed',
  'send', 'submit', 'save', 'accept', 'haan', 'haa', 'han', 'ha', 'ji', 'theek', 'thik', 'sahi',
  'bilkul', 'हाँ', 'हां', 'हा', 'जी', 'ठीक', 'सही', 'बिलकुल', 'बिल्कुल', 'भेजो', 'भेज',
  'स्वीकार', 'ಹೌದು', 'ಹೌದ', 'ಸರಿ', 'ಓಕೆ', 'ಆಯ್ತು', 'ಹೂಂ', 'ಹು', 'ಒಪ್ಪುತ್ತೇನೆ',
  'ஆம்', 'ஆமாம்', 'சரி', 'ஓகே', 'அனுப்பு', 'அனுப்புங்கள்', 'சேமி', 'ஏற்கிறேன்', 'ஏற்கவும்',
])
const NO_WORDS = normalizeList([
  'no', 'nope', 'nah', 'not', 'nahi', 'nahin', 'nai', 'na', 'cancel', 'wrong', 'stop', 'reject',
  'नहीं', 'नही', 'ना', 'गलत', 'ग़लत', 'मत', 'मना', 'ಇಲ್ಲ', 'ಇಲ್ಲಾ', 'ಬೇಡ', 'ತಪ್ಪು', 'ತಿರಸ್ಕರಿಸಿ',
  'இல்லை', 'இல்ல', 'வேண்டாம்', 'தவறு', 'நிராகரி', 'நிராகரிக்கவும்',
])
const SKIP_WORDS = normalizeList([
  'skip', 'next', 'later', 'pass', 'chhodo', 'chodo', 'agla', 'baad', 'छोड़ो', 'छोड़', 'अगला',
  'बाद', 'ಬಿಡಿ', 'ಮುಂದೆ', 'ನಂತರ', 'ಸ್ಕಿಪ್', 'தவிர்', 'தவிர்க்கவும்', 'அடுத்து', 'பிறகு', 'ஸ்கிப்',
])

export type Decision = 'yes' | 'no' | 'skip'

export function parseDecision(text: string): Decision | null {
  const tokens = tokenize(text)
  const yes = tokens.some((token) => YES_WORDS.includes(token))
  const no = tokens.some((token) => NO_WORDS.includes(token))
  const skip = tokens.some((token) => SKIP_WORDS.includes(token))
  if (yes && !no && !skip) return 'yes'
  if (no && !yes && !skip) return 'no'
  if (skip && !yes && !no) return 'skip'
  return null
}

export function parseYesNo(text: string): 'yes' | 'no' | null {
  const decision = parseDecision(text)
  return decision === 'yes' || decision === 'no' ? decision : null
}

// ------------------------------------------------- choosing from a list

export interface SpokenOption<T> {
  value: T
  names: string[]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isLatin(name: string): boolean {
  return /^[a-z0-9 ]+$/.test(name)
}

function nameRegExp(name: string, flags = ''): RegExp {
  return new RegExp(`(^| )${escapeRegExp(name)}(s|es)?( |$)`, flags)
}

function containsName(text: string, name: string): boolean {
  if (!name) return false
  return isLatin(name) ? nameRegExp(name).test(text) : text.includes(name)
}

/** Picks the option whose name appears in the speech (the longest match wins). */
export function matchOption<T>(text: string, options: SpokenOption<T>[]): T | null {
  const normalized = normalizeSpeech(text)
  let best: { value: T; length: number } | null = null
  for (const option of options) {
    for (const raw of option.names) {
      const name = normalizeSpeech(raw)
      if (name.length < 2 || !containsName(normalized, name)) continue
      if (!best || name.length > best.length) best = { value: option.value, length: name.length }
    }
  }
  return best ? best.value : null
}

/** Finds every option named in the speech, e.g. "wheat and rice". */
export function matchAllOptions<T>(text: string, options: SpokenOption<T>[]): T[] {
  let working = normalizeSpeech(text)
  const candidates: Array<{ value: T; name: string }> = []
  for (const option of options) {
    for (const raw of option.names) {
      const name = normalizeSpeech(raw)
      if (name.length >= 2) candidates.push({ value: option.value, name })
    }
  }
  candidates.sort((a, b) => b.name.length - a.name.length)

  const found: T[] = []
  for (const { value, name } of candidates) {
    if (!containsName(working, name)) continue
    if (!found.includes(value)) found.push(value)
    // Remove the match so shorter names inside it are not counted again.
    working = isLatin(name)
      ? working.replace(nameRegExp(name, 'g'), ' ')
      : working.split(name).join(' ')
  }
  return found
}

const ALL_WORDS = normalizeList([
  'all', 'every', 'everything', 'sab', 'sabhi', 'सब', 'सभी', 'ಎಲ್ಲಾ', 'ಎಲ್ಲ', 'ಎಲ್ಲವೂ',
  'எல்லாம்', 'எல்லா', 'அனைத்தும்',
])

export function saysAll(text: string): boolean {
  return tokenize(text).some((token) => ALL_WORDS.includes(token))
}

// -------------------------------------------------- crop / machine names

export const CROP_SYNONYMS: Record<string, string[]> = {
  wheat: ['wheat', 'gehu', 'gehun', 'genhu', 'गेहूं', 'गेहूँ', 'गेहु', 'ಗೋಧಿ'],
  rice: ['rice', 'paddy', 'dhan', 'chawal', 'धान', 'चावल', 'चांवल', 'ಭತ್ತ', 'ಅಕ್ಕಿ'],
  maize: ['maize', 'corn', 'makka', 'makai', 'मक्का', 'मक्की', 'ಮೆಕ್ಕೆಜೋಳ', 'ಮೆಕ್ಕೆ ಜೋಳ'],
  sugarcane: ['sugarcane', 'sugar cane', 'ganna', 'गन्ना', 'ಕಬ್ಬು'],
  cotton: ['cotton', 'kapas', 'kapaas', 'कपास', 'रुई', 'ಹತ್ತಿ'],
  soybean: ['soybean', 'soyabean', 'soya', 'soy', 'सोयाबीन', 'सोया', 'ಸೋಯಾಬೀನ್', 'ಸೋಯಾ'],
  groundnut: [
    'groundnut', 'peanut', 'moongfali', 'mungfali', 'मूंगफली', 'मूँगफली', 'ಶೇಂಗಾ', 'ಕಡಲೆಕಾಯಿ',
    'ಕಡಲೆ ಕಾಯಿ',
  ],
  millet: ['millet', 'small millet', 'foxtail millet', 'navane', 'kodo', 'नवणे', 'ನವಣೆ', 'मिलेट', 'ಮಿಲೆಟ್'],
  barley: ['barley', 'jau', 'जौ', 'ಬಾರ್ಲಿ', 'ಜವೆಗೋಧಿ'],
  mustard: ['mustard', 'sarson', 'sarso', 'सरसों', 'सरसो', 'ಸಾಸಿವೆ'],
  chickpea: ['chickpea', 'chickpeas', 'gram', 'chana', 'channa', 'चना', 'चने', 'ಕಡಲೆ', 'ಕಡಲೆಬೇಳೆ'],
  pigeon_pea: ['pigeon pea', 'tur', 'toor', 'arhar', 'tuar', 'तूर', 'तुअर', 'अरहर', 'ತೊಗರಿ'],
  jowar: ['jowar', 'jwar', 'sorghum', 'jola', 'jolada', 'ज्वार', 'जवार', 'ಜೋಳ'],
  ragi: ['ragi', 'finger millet', 'mandua', 'nachni', 'रागी', 'मंडुआ', 'नाचनी', 'ರಾಗಿ'],
  bajra: ['bajra', 'pearl millet', 'sajje', 'बाजरा', 'बाजरे', 'ಸಜ್ಜೆ'],
  sunflower: ['sunflower', 'surajmukhi', 'suryakanti', 'सूरजमुखी', 'सनफ्लावर', 'ಸೂರ್ಯಕಾಂತಿ', 'ಸನ್ ಫ್ಲವರ್'],
  sesame: ['sesame', 'til', 'gingelly', 'ellu', 'तिल', 'ಎಳ್ಳು'],
  green_gram: ['green gram', 'moong', 'mung', 'moong dal', 'hesaru kalu', 'hesarukalu', 'मूंग', 'मुंग', 'ಹೆಸರುಕಾಳು', 'ಹೆಸರು ಕಾಳು', 'ಹೆಸರು'],
  black_gram: ['black gram', 'urad', 'uddu', 'udad', 'उड़द', 'उरद', 'ಉದ್ದು'],
  lentil: ['lentil', 'lentils', 'masoor', 'masur', 'मसूर', 'ಮಸೂರ್', 'ಮಸೂರ'],
}

export const MACHINE_SYNONYMS: Record<string, string[]> = {
  combine_harvester: [
    'combine harvester', 'combine', 'harvester', 'कंबाइन हार्वेस्टर', 'कंबाइन', 'कम्बाइन',
    'हार्वेस्टर', 'ಕಂಬೈನ್ ಹಾರ್ವೆಸ್ಟರ್', 'ಕಂಬೈನ್', 'ಹಾರ್ವೆಸ್ಟರ್',
  ],
  tractor_harvester: [
    'tractor harvester', 'tractor', 'ट्रैक्टर हार्वेस्टर', 'ट्रैक्टर', 'ट्रेक्टर',
    'ಟ್ರ್ಯಾಕ್ಟರ್ ಹಾರ್ವೆಸ್ಟರ್', 'ಟ್ರ್ಯಾಕ್ಟರ್', 'ಟ್ರಾಕ್ಟರ್',
  ],
  reaper: ['reaper', 'रीपर', 'ರೀಪರ್'],
  thresher: ['thresher', 'threshing', 'थ्रेशर', 'थ्रेशिंग', 'ಥ್ರೆಶರ್', 'ಥ್ರೆಷರ್'],
  baler: ['baler', 'bailer', 'बेलर', 'ಬೇಲರ್'],
  other: ['other', 'dusra', 'dusri', 'अन्य', 'दूसरी', 'दूसरा', 'ಬೇರೆ', 'ಇತರೆ', 'ಇತರ'],
}

export const PRICING_UNIT_SYNONYMS: Record<string, string[]> = {
  per_acre: ['per acre', 'acre', 'ekad', 'ekar', 'एकड़', 'एकड', 'प्रति एकड़', 'ಎಕರೆ', 'ಪ್ರತಿ ಎಕರೆ'],
  per_hour: ['per hour', 'hour', 'ghanta', 'ghante', 'घंटा', 'घंटे', 'प्रति घंटा', 'ಗಂಟೆ', 'ಪ್ರತಿ ಗಂಟೆ'],
  per_day: ['per day', 'day', 'din', 'dina', 'दिन', 'प्रति दिन', 'ದಿನ', 'ಪ್ರತಿ ದಿನ'],
}

// ------------------------------------------------------------ free text

/** Cleans a spoken place name: drops "my village is ..." style filler. */
export function cleanPlaceName(text: string): string {
  let value = text.trim().replace(/[.,!?।]+$/u, '').trim()
  value = value
    .replace(/^(it\s+is|it's|its)\s+/i, '')
    .replace(/^(my\s+)?(village|town|place|district|state)\s+(is\s+)?(called\s+)?/i, '')
    .replace(/^(mera|meri)\s+(gaon|gav|gaanv|jila|zila|rajya)\s+/i, '')
    .replace(/^(मेरा|मेरी)?\s*(गांव|गाँव|ज़िला|जिला|राज्य)\s+/u, '')
    .replace(/^(ನನ್ನ\s+)?(ಊರು|ಗ್ರಾಮ|ಜಿಲ್ಲೆ|ರಾಜ್ಯ)\s+/u, '')
    .replace(/\s+(hai|है|ಆಗಿದೆ|ಇದೆ)$/iu, '')
    .trim()
  if (/^[\x20-\x7e]+$/.test(value)) {
    value = value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
  }
  return value
}
