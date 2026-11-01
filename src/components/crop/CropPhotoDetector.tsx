import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Camera } from 'lucide-react'
import { useI18n } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { logError } from '../../lib/errors'
import { cancelSpeech, speak } from '../../lib/speech'
import { detectCropFromPhoto } from '../../services/cropDetect'
import type { CropDetection } from '../../services/cropDetect'
import type { CropKey } from '../../types'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Feedback'

type Phase =
  | { name: 'idle' }
  | { name: 'working' }
  | { name: 'ask'; detection: CropDetection }
  | { name: 'pick'; options: CropKey[] }
  | { name: 'notice'; key: TranslationKey }

/**
 * "Take a photo of your crop": the app guesses the crop, asks the farmer to confirm
 * (tap, and the question is also read aloud), and never selects anything on its own.
 */
export function CropPhotoDetector({
  onConfirm,
  allCrops,
}: {
  onConfirm: (crop: CropKey) => void
  /** Crops the farmer can pick from when the guess is wrong. */
  allCrops: CropKey[]
}) {
  const { t, language } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })

  useEffect(() => cancelSpeech, [])

  const cropName = (crop: CropKey) => t(`crop.${crop}`)

  const finish = (crop: CropKey) => {
    cancelSpeech()
    onConfirm(crop)
    setPhase({ name: 'idle' })
  }

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    cancelSpeech()
    setPhase({ name: 'working' })
    try {
      const detection = await detectCropFromPhoto(file)
      if (!detection.crop || detection.confidence === 'low') {
        // Too unsure to guess: let the farmer choose, offering the closest ones first.
        const options = [
          ...(detection.crop ? [detection.crop] : []),
          ...detection.alternatives,
          ...allCrops,
        ].filter((crop, index, list) => list.indexOf(crop) === index)
        setPhase({ name: 'pick', options })
        void speak(t('cropPhoto.cannotTell'), language)
        return
      }
      setPhase({ name: 'ask', detection })
      const question = t(
        detection.confidence === 'high' ? 'cropPhoto.ask' : 'cropPhoto.askUnsure',
        { crop: cropName(detection.crop) },
      )
      void speak(question, language)
    } catch (caught) {
      logError('cropPhoto.detect', caught)
      setPhase({ name: 'notice', key: 'cropPhoto.unavailable' })
    }
  }

  const reject = (detection: CropDetection) => {
    cancelSpeech()
    const options = [...detection.alternatives, ...allCrops].filter(
      (crop, index, list) => crop !== detection.crop && list.indexOf(crop) === index,
    )
    setPhase({ name: 'pick', options })
    void speak(t('cropPhoto.pickOther'), language)
  }

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void onPick(event)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={phase.name === 'working'}
        icon={<Camera className="size-4" aria-hidden="true" />}
        onClick={() => inputRef.current?.click()}
      >
        {t('cropPhoto.button')}
      </Button>
      {phase.name === 'idle' ? (
        <p className="mt-1.5 text-xs text-ink-muted">{t('cropPhoto.hint')}</p>
      ) : null}

      {phase.name === 'working' ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-ink-muted" role="status">
          <Spinner className="size-4" />
          {t('cropPhoto.analysing')}
        </p>
      ) : null}

      {phase.name === 'ask' && phase.detection.crop ? (
        <div className="mt-3 rounded-xl border-2 border-leaf-200 bg-leaf-50 p-3" role="status">
          <p className="text-base font-bold text-leaf-900">
            {t(phase.detection.confidence === 'high' ? 'cropPhoto.ask' : 'cropPhoto.askUnsure', {
              crop: cropName(phase.detection.crop),
            })}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => finish(phase.detection.crop as CropKey)}>
              {t('cropPhoto.yes')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => reject(phase.detection)}>
              {t('cropPhoto.no')}
            </Button>
          </div>
        </div>
      ) : null}

      {phase.name === 'pick' ? (
        <div className="mt-3 rounded-xl border-2 border-cream-300 bg-white p-3">
          <p className="text-sm font-bold text-ink-soft">{t('cropPhoto.pickOther')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {phase.options.map((crop) => (
              <button
                key={crop}
                type="button"
                onClick={() => finish(crop)}
                className="min-h-10 rounded-full bg-cream-100 px-4 text-sm font-bold text-ink-soft hover:bg-cream-200"
              >
                {cropName(crop)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {phase.name === 'notice' ? (
        <Alert variant="warning" className="mt-3">
          {t(phase.key)}
        </Alert>
      ) : null}
    </div>
  )
}
