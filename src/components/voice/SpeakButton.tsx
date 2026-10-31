import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useI18n } from '../../i18n'
import { speakAloud, stopSpeaking } from '../../lib/voice'
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

  const handleSpeak = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }

    setSpeaking(true)

    const typeLabel = t(`machineType.${machine.machine_type}`)
    const cropNames = machine.crops.map((c) => t(`crop.${c}`)).join(', ')

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

    const enUnit =
      machine.pricing_unit === 'per_hour'
        ? 'per hour'
        : machine.pricing_unit === 'per_day'
        ? 'per day'
        : 'per acre'

    // Formulate natural language speech based on user's active language
    let speechText = ''
    if (language === 'kn') {
      speechText = `${machine.model || typeLabel}. ${machine.district} ಜಿಲ್ಲೆಯ ${machine.village} ಗ್ರಾಮದಲ್ಲಿ ಲಭ್ಯವಿದೆ. ಬಾಡಿಗೆ ${knUnit} ${machine.price_per_acre} ರೂಪಾಯಿ. ಆಪರೇಟರ್ ಮತ್ತು ಡೀಸೆಲ್ ಒಳಗೊಂಡಿದೆ. ಬೆಳೆಗಳು: ${cropNames}. ಮಾಲೀಕರು: ${machine.owner_name}. ಫೋನ್ ಸಂಖ್ಯೆ: ${machine.phone.split('').join(' ')}.`
    } else if (language === 'hi') {
      speechText = `${machine.model || typeLabel}। ${machine.district} ज़िले के ${machine.village} में उपलब्ध है। किराया ${machine.price_per_acre} रुपये ${hiUnit}। ऑपरेटर और डीजल शामिल है। फसलें: ${cropNames}। मालिक: ${machine.owner_name}। फोन नंबर: ${machine.phone.split('').join(' ')}।`
    } else {
      speechText = `${machine.model || typeLabel} available in ${machine.village}, ${machine.district} district. Rental price: ${machine.price_per_acre} rupees ${enUnit}. Operator and diesel included. Suitable for ${cropNames}. Owner: ${machine.owner_name}. Contact number: ${machine.phone.split('').join(' ')}.`
    }

    try {
      await speakAloud(speechText, language)
    } finally {
      setSpeaking(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-leaf-300 bg-leaf-50/80 px-2.5 py-1 text-xs font-bold text-leaf-800 transition-all hover:bg-leaf-100 active:scale-95 ${
        speaking ? 'animate-pulse ring-2 ring-leaf-500 bg-leaf-100' : ''
      } ${className}`}
      title={speaking ? t('voice.stopSpeaking') : t('voice.speakDetails')}
      aria-label={speaking ? t('voice.stopSpeaking') : t('voice.speakDetails')}
    >
      {speaking ? (
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
