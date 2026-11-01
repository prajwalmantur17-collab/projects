import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useI18n } from '../../i18n'
import { getCropConfig } from '../../lib/cropConfig'
import type { CropKey } from '../../types'

export interface CropCardProps {
  crop: CropKey
  selected: boolean
  onClick: () => void
  disabled?: boolean
  className?: string
  /** Optional compact mode for smaller viewports or dense grids */
  compact?: boolean
}

/**
 * A modern, agricultural SaaS-grade card representing a single crop with its realistic photograph.
 * Includes prominent photo with 4:3 aspect ratio, clear selection indicator, hover & focus states.
 */
export function CropCard({
  crop,
  selected,
  onClick,
  disabled = false,
  className = '',
  compact = false,
}: CropCardProps) {
  const { t } = useI18n()
  const config = getCropConfig(crop)
  const cropName = t(`crop.${crop}`)

  const [useFallback, setUseFallback] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  const imageSrc = useFallback ? config.fallbackImage : config.image

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${cropName} (${selected ? 'Selected' : 'Not selected'})`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-600 focus-visible:ring-offset-2 ${
        selected
          ? 'border-leaf-600 bg-leaf-50/70 shadow-sm ring-2 ring-leaf-600/20'
          : 'border-cream-200 bg-white hover:-translate-y-0.5 hover:border-leaf-400 hover:shadow-md'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${className}`}
    >
      {/* 4:3 Aspect Ratio Photo Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream-100">
        {imageFailed ? (
          <div className="flex h-full w-full items-center justify-center bg-cream-100 text-3xl">
            <span aria-hidden="true">{config.emoji}</span>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={`${cropName} crop photograph`}
            width={320}
            height={240}
            loading="lazy"
            onError={() => {
              if (!useFallback) {
                setUseFallback(true)
              } else {
                setImageFailed(true)
              }
            }}
            className="h-full w-full object-cover object-center transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
        )}

        {/* Selected badge in top-right */}
        {selected ? (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-leaf-700 text-white shadow-sm ring-2 ring-white"
          >
            <Check className="size-3.5 stroke-[3]" />
          </span>
        ) : null}
      </div>

      {/* Caption / Crop Name */}
      <div className={`flex w-full items-center justify-between gap-1.5 ${compact ? 'p-2' : 'p-2.5 sm:p-3'}`}>
        <span
          className={`truncate leading-tight text-ink ${
            compact ? 'text-xs' : 'text-xs sm:text-sm'
          } ${selected ? 'font-extrabold text-leaf-950' : 'font-bold group-hover:text-leaf-900'}`}
        >
          {cropName}
        </span>
      </div>
    </button>
  )
}

/**
 * Matching card for the "Any crop" option in crop selectors.
 */
export function AnyCropCard({
  selected,
  onClick,
  className = '',
  compact = false,
}: {
  selected: boolean
  onClick: () => void
  className?: string
  compact?: boolean
}) {
  const { t } = useI18n()
  const label = t('farmer.anyCrop')

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${label} (${selected ? 'Selected' : 'Not selected'})`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-600 focus-visible:ring-offset-2 ${
        selected
          ? 'border-leaf-600 bg-leaf-50/70 shadow-sm ring-2 ring-leaf-600/20'
          : 'border-cream-200 bg-white hover:-translate-y-0.5 hover:border-leaf-400 hover:shadow-md'
      } cursor-pointer ${className}`}
    >
      <div className="relative flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-cream-100 via-leaf-100/40 to-cream-200">
        <div className="flex size-11 items-center justify-center rounded-full bg-white/80 shadow-xs ring-1 ring-leaf-200 transition-transform duration-300 group-hover:scale-110">
          <Sparkles className="size-5 text-leaf-700" aria-hidden="true" />
        </div>

        {selected ? (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-leaf-700 text-white shadow-sm ring-2 ring-white"
          >
            <Check className="size-3.5 stroke-[3]" />
          </span>
        ) : null}
      </div>

      <div className={`flex w-full items-center justify-between gap-1.5 ${compact ? 'p-2' : 'p-2.5 sm:p-3'}`}>
        <span
          className={`truncate leading-tight ${
            compact ? 'text-xs' : 'text-xs sm:text-sm'
          } ${selected ? 'font-extrabold text-leaf-950' : 'font-bold text-ink group-hover:text-leaf-900'}`}
        >
          {label}
        </span>
      </div>
    </button>
  )
}
