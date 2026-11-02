import type { CropKey, Language } from '../types'

export interface VoiceQueryResult {
  rawTranscript: string
  village?: string
  crop?: CropKey
  acreage?: string
}

// Mapping of crop keywords across Kannada, Hindi, and English
const CROP_VOICE_MAP: Record<string, CropKey> = {
  // Rice / Paddy
  rice: 'rice',
  paddy: 'rice',
  bhatta: 'rice',
  dhan: 'rice',
  chawal: 'rice',
  'ಭತ್ತ': 'rice',
  'ಅಕ್ಕಿ': 'rice',
  'धान': 'rice',
  'चावल': 'rice',

  // Wheat
  wheat: 'wheat',
  godhi: 'wheat',
  gehu: 'wheat',
  gehun: 'wheat',
  'ಗೋಧಿ': 'wheat',
  'गेहूं': 'wheat',
  'गेहू': 'wheat',

  // Sugarcane
  sugarcane: 'sugarcane',
  kabbu: 'sugarcane',
  ganna: 'sugarcane',
  'ಕಬ್ಬು': 'sugarcane',
  'गन्ना': 'sugarcane',

  // Maize / Corn
  maize: 'maize',
  corn: 'maize',
  mekkejola: 'maize',
  makka: 'maize',
  makai: 'maize',
  'ಮೆಕ್ಕೆಜೋಳ': 'maize',
  'ಜೋಳ': 'maize',
  'मक्का': 'maize',

  // Cotton
  cotton: 'cotton',
  hatti: 'cotton',
  kapas: 'cotton',
  rui: 'cotton',
  'ಹತ್ತಿ': 'cotton',
  'कपास': 'cotton',
  'रुई': 'cotton',

  // Soybean
  soybean: 'soybean',
  soya: 'soybean',
  'ಸೋಯಾಬೀನ್': 'soybean',
  'सोयाबीन': 'soybean',

  // Groundnut
  groundnut: 'groundnut',
  peanut: 'groundnut',
  shenga: 'groundnut',
  moongphali: 'groundnut',
  'ಕಡಲೆಕಾಯಿ': 'groundnut',
  'ಶೇಂಗಾ': 'groundnut',
  'मूंगफली': 'groundnut',

  // Tamil
  nel: 'rice',
  arisi: 'rice',
  'நெல்': 'rice',
  'அரிசி': 'rice',
  'கோதுமை': 'wheat',
  'கரும்பு': 'sugarcane',
  'மக்காச்சோளம்': 'maize',
  'சோளம்': 'jowar',
  'பருத்தி': 'cotton',
  'சோயாபீன்': 'soybean',
  'நிலக்கடலை': 'groundnut',
  'வேர்க்கடலை': 'groundnut',
  'கம்பு': 'bajra',
  'கேழ்வரகு': 'ragi',
  'ராகி': 'ragi',
  'துவரை': 'pigeon_pea',
  'உளுந்து': 'black_gram',
  'பச்சைப்பயறு': 'green_gram',
  'எள்': 'sesame',
  'சூரியகாந்தி': 'sunflower',
  'கடுகு': 'mustard',
  'கொண்டைக்கடலை': 'chickpea',
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition,
  )
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window)
}

export function getVoiceLocale(lang: Language): string {
  switch (lang) {
    case 'kn':
      return 'kn-IN'
    case 'hi':
      return 'hi-IN'
    case 'ta':
      return 'ta-IN'
    case 'en':
    default:
      return 'en-IN'
  }
}

// Parse spoken text into structured farm parameters (village, crop, acreage)
export function parseSpokenQuery(transcript: string): VoiceQueryResult {
  const cleaned = transcript.trim().toLowerCase()
  const words = cleaned.split(/\s+/)

  let detectedCrop: CropKey | undefined
  let detectedAcreage: string | undefined
  const remainingWords: string[] = []

  for (const word of words) {
    // Check if word or phrase matches a crop
    const match = CROP_VOICE_MAP[word]
    if (match && !detectedCrop) {
      detectedCrop = match
      continue
    }

    // Check for number / acreage (e.g., "5 acres" or "2.5")
    const num = parseFloat(word)
    if (!Number.isNaN(num) && num > 0 && num <= 500 && !detectedAcreage) {
      detectedAcreage = String(num)
      continue
    }

    // Skip filler words in Kannada, Hindi, and English
    const fillers = new Set([
      'harvest', 'harvester', 'machine', 'rent', 'rental', 'for', 'in', 'near',
      'ಹಾರ್ವೆಸ್ಟರ್', 'ಯಂತ್ರ', 'ಬೇಕು', 'ಬಾಡಿಗೆ', 'ಎಕರೆ',
      'हार्वेस्टर', 'मशीन', 'चाहिए', 'किराया', 'एकड़', 'में',
      'அறுவடை', 'இயந்திரம்', 'வேண்டும்', 'வாடகை', 'ஏக்கர்', 'இல்'
    ])
    if (!fillers.has(word)) {
      remainingWords.push(word)
    }
  }

  // Village is the remaining words capitalized
  const village = remainingWords.length > 0
    ? remainingWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : undefined

  return {
    rawTranscript: transcript,
    village,
    crop: detectedCrop,
    acreage: detectedAcreage,
  }
}

import { cancelSpeech, speakAloudWithFeedback } from './speech'

// Speak aloud via Web Speech Synthesis (TTS)
export async function speakAloud(text: string, lang: Language): Promise<void> {
  await speakAloudWithFeedback(text, lang)
}

export function stopSpeaking(): void {
  cancelSpeech()
}
