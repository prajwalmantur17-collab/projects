/** Neutral placeholder shown when an owner has not uploaded a photograph. */
export function MachinePlaceholder({
  className = '',
  label,
}: {
  className?: string
  label: string
}) {
  return (
    <svg
      viewBox="0 0 640 420"
      className={className}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="640" height="420" fill="#f0e7d3" />
      <circle cx="518" cy="86" r="46" fill="#f3d68a" />
      <path d="M0 300c94-26 170-14 246 10 80 25 190 22 394-8v118H0Z" fill="#c4dbb2" />
      <path d="M0 352c98-18 198-8 276 10 76 17 202 12 364-10v68H0Z" fill="#a1c487" />
      <g transform="translate(132 194)">
        <rect x="0" y="82" width="268" height="84" rx="16" fill="#a26411" />
        <path d="M38 82V38c0-10 8-18 18-18h84c10 0 18 8 18 18v44Z" fill="#c48516" />
        <rect x="58" y="40" width="48" height="30" rx="5" fill="#fdfbf5" opacity="0.9" />
        <path d="M160 82V52h58c14 0 24 12 24 26v4Z" fill="#824c13" />
        <rect x="178" y="58" width="26" height="18" rx="4" fill="#fdfbf5" opacity="0.85" />
        <path d="M268 96l56-26v28l-56 26Z" fill="#dfa42b" />
        <g fill="#17241b">
          <circle cx="64" cy="166" r="34" />
          <circle cx="214" cy="166" r="34" />
        </g>
        <g fill="#e4d7bc">
          <circle cx="64" cy="166" r="14" />
          <circle cx="214" cy="166" r="14" />
        </g>
      </g>
      <g stroke="#5f8c43" strokeWidth="6" strokeLinecap="round" opacity="0.7">
        <path d="M70 332v-40" />
        <path d="M58 306l12-16 12 16" fill="none" />
        <path d="M112 342v-46" />
        <path d="M100 312l12-18 12 18" fill="none" />
        <path d="M556 336v-36" />
        <path d="M546 314l10-14 10 14" fill="none" />
      </g>
    </svg>
  )
}
