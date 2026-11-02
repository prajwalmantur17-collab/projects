import { useEffect, useState } from 'react'
import { Loader2, Volume2, VolumeX } from 'lucide-react'
import { useI18n } from '../../i18n'
import { cancelSpeech, speakAloudWithFeedback } from '../../lib/speech'
import { toast } from '../../lib/toast'
import type { MachineCard } from '../../types'

export function SpeakButton({
  machine,
  className = '',
}: {
  machine: MachineCard
  className?: string
}) {
  const { t, language } = useI18n()
  const [speaking, setSpeaking] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Safe cleanup on unmount: stop audio if the component unmounts while speaking
  useEffect(() => {
    return () => {
      cancelSpeech()
    }
  }, [])

  const handleSpeak = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // If currently playing or generating, clicking stops playback immediately
    if (speaking || generating) {
      cancelSpeech()
      setSpeaking(false)
      setGenerating(false)
      return
    }

    const typeLabel = t(`machineType.${machine.machine_type}`)
    const cropList = Array.isArray(machine.crops) ? machine.crops : []
    const cropNames = cropList.map((c) => t(`crop.${c}`)).join(', ')

    const knUnit =
      machine.pricing_unit === 'per_hour'
        ? 'ಪ್ರತಿ ಗಂಟೆಗೆ'
        : machine.pricing_unit === 'per_day'
        ? 'ಪ್ರತಿ ದಿನಕ್ಕೆ'
        : 'ಒಂದು ಎಕರೆಗೆ'

    const hiUnit =
      machine.pricing_unit === 'per_hour'
        ? 'प्रति घंटा'
        : machine.pricing_unit === 'per_day'
        ? 'प्रति दिन'
        : 'प्रति एकड़'

    const taUnit =
      machine.pricing_unit === 'per_hour'
        ? 'ஒரு மணி நேரத்திற்கு'
        : machine.pricing_unit === 'per_day'
        ? 'ஒரு நாளைக்கு'
        : 'ஒரு ஏக்கருக்கு'

    const enUnit =
      machine.pricing_unit === 'per_hour'
        ? 'per hour'
        : machine.pricing_unit === 'per_day'
        ? 'per day'
        : 'per acre'

    // Formulate natural language speech based on user's active language
    let speechText = ''
    if (language === 'kn') {
      speechText = `${typeLabel}: ${machine.model}. ${machine.district} ಜಿಲ್ಲೆಯ ${machine.village} ಗ್ರಾಮದಲ್ಲಿ ಲಭ್ಯವಿದೆ. ಬಾಡಿಗೆ ${knUnit} ${machine.price_per_acre} ರೂಪಾಯಿ. ಆಪರೇಟರ್ ಮತ್ತು ಡೀಸೆಲ್ ಒಳಗೊಂಡಿದೆ. ಬೆಳೆಗಳು: ${cropNames}. ಮಾಲೀಕರು: ${machine.owner_name}. ಫೋನ್ ಸಂಖ್ಯೆ: ${machine.phone.split('').join(' ')}.`
    } else if (language === 'hi') {
      speechText = `${typeLabel}: ${machine.model}। ${machine.district} ज़िले के ${machine.village} में उपलब्ध है। किराया ${machine.price_per_acre} रुपये ${hiUnit}। ऑपरेटर और डीजल शामिल है। फसलें: ${cropNames}। मालिक: ${machine.owner_name}। फोन नंबर: ${machine.phone.split('').join(' ')}।`
    } else if (language === 'ta') {
      speechText = `${typeLabel}: ${machine.model}. ${machine.district} மாவட்டத்தின் ${machine.village} கிராமத்தில் கிடைக்கிறது. வாடகை ${taUnit} ${machine.price_per_acre} ரூபாய். ஆப்பரேட்டர் மற்றும் டீசல் சேர்க்கப்பட்டுள்ளது. பயிர்கள்: ${cropNames}. உரிமையாளர்: ${machine.owner_name}. தொலைபேசி எண்: ${machine.phone.split('').join(' ')}.`
    } else {
      speechText = `${machine.model || typeLabel} available in ${machine.village}, ${machine.district} district. Rental price: ${machine.price_per_acre} rupees ${enUnit}. Operator and diesel included. Suitable for ${cropNames}. Owner: ${machine.owner_name}. Contact number: ${machine.phone.split('').join(' ')}.`
    }

    try {
      const result = await speakAloudWithFeedback(speechText, language, {
        onGenerating: () => {
          setGenerating(true)
          setSpeaking(false)
        },
        onStart: () => {
          setGenerating(false)
          setSpeaking(true)
        },
        onEnd: () => {
          setGenerating(false)
          setSpeaking(false)
        },
        onError: () => {
          setGenerating(false)
          setSpeaking(false)
        },
      })

      if (!result.success) {
        setGenerating(false)
        setSpeaking(false)
        if (result.reason === 'no-voice' && result.message) {
          toast.info(result.message)
        } else if (result.reason === 'unsupported' && result.message) {
          toast.warning(result.message)
        }
      }
    } catch {
      setGenerating(false)
      setSpeaking(false)
    }
  }

  const label = speaking
    ? t('voice.stopSpeaking')
    : generating
    ? t('voice.speaking')
    : t('voice.speakDetails')

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-leaf-300 bg-leaf-50/80 px-2.5 py-1 text-xs font-bold text-leaf-800 transition-all hover:bg-leaf-100 active:scale-95 ${
        speaking || generating ? 'animate-pulse ring-2 ring-leaf-500 bg-leaf-100' : ''
      } ${className}`}
      title={label}
      aria-label={label}
    >
      {generating ? (
        <>
          <Loader2 className="size-3.5 animate-spin text-leaf-700" aria-hidden="true" />
          <span>{t('voice.speaking')}</span>
        </>
      ) : speaking ? (
        <>
          <VolumeX className="size-3.5 text-leaf-900" aria-hidden="true" />
          <span>{t('voice.stopSpeaking')}</span>
        </>
      ) : (
        <>
          <Volume2 className="size-3.5 text-leaf-700" aria-hidden="true" />
          <span>{t('voice.speakDetails')}</span>
        </>
      )}
    </button>
  )
}
