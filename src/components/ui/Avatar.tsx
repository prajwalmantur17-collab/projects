import { useState } from 'react'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<Size, string> = {
  xs: 'size-6 text-xs',
  sm: 'size-8 text-sm',
  md: 'size-10 text-base',
  lg: 'size-14 text-xl',
  xl: 'size-24 text-4xl',
}

/** A round profile picture, or the person's first letter when they have no photo. */
export function Avatar({
  url,
  name,
  size = 'md',
  className = '',
}: {
  url?: string | null
  name?: string | null
  size?: Size
  className?: string
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showPhoto = Boolean(url) && failedUrl !== url
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || '?'

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-leaf-100 font-bold text-leaf-800 ring-2 ring-white ${sizes[size]} ${className}`}
      aria-hidden="true"
    >
      {showPhoto ? (
        <img
          src={url ?? undefined}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedUrl(url ?? null)}
          loading="lazy"
        />
      ) : (
        initial
      )}
    </span>
  )
}
