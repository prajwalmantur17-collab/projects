interface LogoProps {
  className?: string
  alt?: string
}

/**
 * Compact Icon-only emblem for collapsed sidebar, mobile icons, or avatars
 * Contains: Combine harvester, green agricultural fields, sunrise, and leaf emblem.
 */
export function LogoMark({ className = 'size-10', alt = 'HarvestRent Emblem' }: LogoProps) {
  return (
    <img
      src="/brand/logo-emblem.webp"
      onError={(e) => {
        // Fallback to PNG if webp fails
        const target = e.currentTarget
        if (!target.src.endsWith('.png')) {
          target.src = '/brand/logo-emblem.png'
        }
      }}
      alt={alt}
      className={`object-contain shrink-0 select-none ${className}`}
      loading="eager"
      decoding="async"
    />
  )
}

interface LogoLockupProps {
  variant?: 'dark' | 'light'
  className?: string
  markClassName?: string
  textClassName?: string
  subtitle?: boolean
}

/**
 * Full HarvestRent Logo with Brand Mark + Typography + Tagline ('Rent • Harvest • Grow')
 * Supports:
 * - 'dark' variant: Optimized for deep forest green (#0B2B1E) backgrounds (e.g. Sidebar)
 * - 'light' variant: Optimized for light backgrounds (e.g. Login, Setup, Header)
 */
export function LogoLockup({
  variant = 'light',
  className = '',
  markClassName = 'h-9 w-auto',
  subtitle: _subtitle = false,
  textClassName: _textClassName = '',
}: LogoLockupProps) {
  const isDark = variant === 'dark'
  const logoSrc = isDark ? '/brand/logo-full-dark.webp' : '/brand/logo-full-light.webp'
  const fallbackSrc = isDark ? '/brand/logo-full-dark.png' : '/brand/logo-full-light.png'

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={logoSrc}
        onError={(e) => {
          const target = e.currentTarget
          if (!target.src.endsWith('.png')) {
            target.src = fallbackSrc
          }
        }}
        alt="HarvestRent — Rent • Harvest • Grow"
        className={`object-contain max-h-12 w-auto select-none ${markClassName}`}
        loading="eager"
        decoding="async"
      />
    </span>
  )
}
