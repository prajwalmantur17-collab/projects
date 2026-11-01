import { useState } from 'react'
import { cropImageUrl, cropFallbackImageUrl, getCropConfig } from '../../lib/cropConfig'
import type { CropKey } from '../../types'

/**
 * A crop's realistic photograph, falling back to JPG and then emoji if an image fails to load.
 */
export function CropIcon({
  crop,
  size = 40,
  className = '',
  alt,
}: {
  crop: CropKey
  /** Width and height in pixels. */
  size?: number
  className?: string
  alt?: string
}) {
  const [useFallback, setUseFallback] = useState(false)
  const [failed, setFailed] = useState(false)
  const config = getCropConfig(crop)

  if (failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-cream-100 ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.65), lineHeight: 1 }}
        aria-hidden={!alt}
        role={alt ? 'img' : undefined}
        aria-label={alt}
      >
        {config.emoji}
      </span>
    )
  }

  const currentSrc = useFallback ? cropFallbackImageUrl(crop) : cropImageUrl(crop)

  return (
    <img
      src={currentSrc}
      alt={alt ?? ''}
      width={size}
      height={size}
      loading="lazy"
      onError={() => {
        if (!useFallback) {
          setUseFallback(true)
        } else {
          setFailed(true)
        }
      }}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
