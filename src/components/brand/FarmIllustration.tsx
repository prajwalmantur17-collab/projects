/** Decorative editorial illustration of a field and a harvester. */
export function FarmIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 380"
      className={className}
      role="presentation"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="560" height="380" rx="28" fill="#f8f3e7" />
      <circle cx="452" cy="92" r="38" fill="#ebbd52" />
      <circle cx="452" cy="92" r="38" fill="none" stroke="#dfa42b" strokeWidth="2" />

      <path d="M0 226c72-32 140-18 210 6 76 26 158 24 350-10v158H0Z" fill="#c4dbb2" />
      <path d="M0 290c96-26 178-14 244 10 70 25 170 20 316-6v86H0Z" fill="#7da95f" />
      <path d="M0 332c90-18 182-10 252 8 68 17 184 12 308-8v48H0Z" fill="#385827" />

      <g stroke="#5f8c43" strokeWidth="6" strokeLinecap="round" opacity="0.85">
        <path d="M54 314v-36" />
        <path d="M45 292l9-13 9 13" fill="none" />
        <path d="M86 322v-42" />
        <path d="M76 298l10-14 10 14" fill="none" />
        <path d="M118 318v-32" />
        <path d="M110 300l8-12 8 12" fill="none" />
      </g>

      <g transform="translate(210 206)">
        <rect x="0" y="66" width="196" height="58" rx="12" fill="#c48516" />
        <rect x="16" y="82" width="52" height="26" rx="6" fill="#fdfbf5" opacity="0.85" />
        <rect x="82" y="82" width="44" height="26" rx="6" fill="#824c13" />
        <rect x="140" y="82" width="38" height="26" rx="6" fill="#fdfbf5" opacity="0.85" />
        <path d="M26 66V28c0-8 6-14 14-14h58c8 0 14 6 14 14v38Z" fill="#dfa42b" />
        <rect x="42" y="28" width="34" height="24" rx="4" fill="#fdfbf5" opacity="0.9" />
        <path d="M112 66V38h38c10 0 18 8 18 18v10Z" fill="#a26411" />
        <rect x="126" y="44" width="18" height="14" rx="3" fill="#fdfbf5" opacity="0.85" />
        <g fill="#17241b">
          <circle cx="46" cy="132" r="26" />
          <circle cx="156" cy="132" r="26" />
        </g>
        <g fill="#e4d7bc">
          <circle cx="46" cy="132" r="11" />
          <circle cx="156" cy="132" r="11" />
        </g>
        <path d="M196 84l44-22v22l-44 22Z" fill="#dfa42b" />
        <path d="M240 62v22" stroke="#824c13" strokeWidth="4" />
        <g stroke="#ebbd52" strokeWidth="5" strokeLinecap="round">
          <path d="M224 96v18" />
          <path d="M236 92v18" />
        </g>
      </g>

      <g fill="#f8f3e7" opacity="0.9">
        <path d="M92 120c10-16 28-18 38-4-10 16-28 18-38 4Z" />
        <path d="M136 96c12-14 30-13 38 3-12 14-30 13-38-3Z" />
      </g>
      <path d="M92 120c10-16 28-18 38-4" stroke="#a1c487" strokeWidth="2" fill="none" />
    </svg>
  )
}
