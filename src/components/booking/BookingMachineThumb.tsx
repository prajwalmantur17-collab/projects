import { useState } from 'react'
import { useI18n } from '../../i18n'
import { getMachineImageUrl } from '../../services/machines'
import { MachinePlaceholder } from '../brand/MachinePlaceholder'

export function BookingMachineThumb({
  imagePath,
  typeLabel,
  className = 'size-16',
}: {
  imagePath: string | null
  typeLabel: string
  className?: string
}) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  const url = failed ? null : getMachineImageUrl(imagePath)

  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-xl bg-cream-200`}>
      {url ? (
        <img
          src={url}
          alt={t('machine.imageAlt', { type: typeLabel })}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <MachinePlaceholder className="size-full" label={t('machine.placeholderAlt')} />
      )}
    </div>
  )
}
