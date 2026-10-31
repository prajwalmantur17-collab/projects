export function LogoMark({ className = 'size-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Harvest Rentals"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="16" fill="#385827" />
      <path d="M32 51V30" stroke="#fdfbf5" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 34C32 24 24 19 16 19c0 9 7 15 16 15Z" fill="#a1c487" />
      <path d="M32 30c0-8 6-13 15-13 0 8-6 13-15 13Z" fill="#e0ecd7" />
      <path d="M18 47h28" stroke="#fdfbf5" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function LogoLockup({
  subtitle = false,
  markClassName = 'size-10',
  textClassName = '',
}: {
  subtitle?: boolean
  markClassName?: string
  textClassName?: string
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={markClassName} />
      <span className="min-w-0">
        <span
          className={`block truncate text-lg font-extrabold leading-tight tracking-tight text-leaf-900 ${textClassName}`}
        >
          Harvest Rentals
        </span>
        {subtitle ? (
          <span className="block text-xs font-medium text-ink-muted">Find. Compare. Book.</span>
        ) : null}
      </span>
    </span>
  )
}
