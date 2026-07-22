// Inline SVG marks. The bank logo is a stylized approximation of the
// reference styling (wordmark + red swoosh) — visual reference only.

export function BankLogo({ height = 22 }) {
  return (
    <svg viewBox="0 0 132 34" height={height} aria-label="Capital One" role="img">
      <path
        d="M70 12 C 88 1, 116 -1, 129 6 C 118 2, 92 6, 78 13 Z"
        fill="#cc2427"
      />
      <text
        x="2"
        y="26"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="21"
        fill="#004977"
      >
        Capital<tspan fontSize="21" dx="1">One</tspan>
      </text>
    </svg>
  )
}

export function ZelleGlyph({ size = 16, color = '#6d1ed4' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Zelle">
      <path
        d="M5 4h14v3.2L11.6 17H19v3H5v-3.2L12.4 7H5V4Z"
        fill={color}
      />
    </svg>
  )
}

export function ZelleBadge({ size = 54 }) {
  // Green cash icon in a white circle, small Zelle chip — mirrors the modal header art.
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Send money">
      <circle cx="32" cy="30" r="26" fill="#1b4a67" />
      <rect x="14" y="21" width="36" height="19" rx="2.5" fill="#3aaa4c" />
      <rect x="17" y="24" width="30" height="13" rx="1.5" fill="none" stroke="#e8f7e9" strokeWidth="1.6" />
      <circle cx="32" cy="30.5" r="4.6" fill="#e8f7e9" />
      <circle cx="47" cy="44" r="8" fill="#0f8bd0" />
      <path d="M43.5 40h7v1.8l-4.2 4.4h4.2V48h-7v-1.8l4.2-4.4h-4.2V40Z" fill="#fff" />
    </svg>
  )
}

export function ReviewBadge({ size = 54 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Review">
      <circle cx="32" cy="30" r="26" fill="#cfe8f5" />
      <rect x="20" y="14" width="22" height="30" rx="2" fill="#fff" stroke="#7fb6d4" strokeWidth="1.5" />
      <line x1="24" y1="21" x2="38" y2="21" stroke="#7fb6d4" strokeWidth="1.8" />
      <line x1="24" y1="26" x2="38" y2="26" stroke="#7fb6d4" strokeWidth="1.8" />
      <line x1="24" y1="31" x2="33" y2="31" stroke="#7fb6d4" strokeWidth="1.8" />
      <circle cx="39" cy="37" r="7" fill="none" stroke="#12557c" strokeWidth="2.4" />
      <line x1="44" y1="42.5" x2="49" y2="48" stroke="#12557c" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  )
}

export function SuccessBadge({ size = 62 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Success">
      <circle cx="32" cy="32" r="28" fill="#1b8746" />
      <path d="M20 33 l8.5 8.5 L45 24" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ShieldBadge({ size = 54, tone = '#0276b1' }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Security check">
      <circle cx="32" cy="30" r="26" fill="#e8f3f9" />
      <path
        d="M32 12 L46 18 V30 C46 40 40 46 32 49 C24 46 18 40 18 30 V18 Z"
        fill={tone}
      />
      <path d="M26 30.5 l4.5 4.5 L38.5 26" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function HeartShieldBadge({ size = 64 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Health data protection">
      <circle cx="32" cy="32" r="30" fill="#e8f3f9" />
      <path
        d="M32 12 L47 18.5 V32 C47 42.5 40.5 49.5 32 53 C23.5 49.5 17 42.5 17 32 V18.5 Z"
        fill="#06405f"
      />
      <path
        d="M32 41 C27 37 23.5 33.5 23.5 29.6 C23.5 26.8 25.7 24.8 28.2 24.8 C29.8 24.8 31.2 25.7 32 27 C32.8 25.7 34.2 24.8 35.8 24.8 C38.3 24.8 40.5 26.8 40.5 29.6 C40.5 33.5 37 37 32 41 Z"
        fill="#e0475b"
      />
      <path d="M24 31 h4.2 l1.6-3 2.4 5.4 1.7-2.4 h6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function PauseShieldBadge({ size = 54 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Payment paused">
      <circle cx="32" cy="30" r="26" fill="#e8f3f9" />
      <path
        d="M32 12 L46 18 V30 C46 40 40 46 32 49 C24 46 18 40 18 30 V18 Z"
        fill="#06405f"
      />
      <rect x="27" y="24" width="3.4" height="13" rx="1.2" fill="#fff" />
      <rect x="33.6" y="24" width="3.4" height="13" rx="1.2" fill="#fff" />
    </svg>
  )
}

export function PrinterIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#0276b1" strokeWidth="1.7">
      <path d="M7 8V3.5h10V8" strokeLinejoin="round" />
      <rect x="4" y="8" width="16" height="8.5" rx="1.5" />
      <rect x="7" y="13.5" width="10" height="7" rx="1" fill="#fff" />
      <line x1="9.5" y1="16.5" x2="14.5" y2="16.5" strokeLinecap="round" />
      <line x1="9.5" y1="19" x2="14.5" y2="19" strokeLinecap="round" />
    </svg>
  )
}

export function HelpBubble({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a9 9 0 1 1-4-7.5" strokeLinecap="round" />
      <path d="M12 3a9 9 0 0 1 9 9c0 1.6-.4 3-1.1 4.3L21 21l-4.6-1A9 9 0 0 1 12 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AvatarIcon({ size = 26 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} role="img" aria-label="Profile">
      <circle cx="16" cy="16" r="15" fill="#e9e9e9" stroke="#c7c7c7" />
      <circle cx="16" cy="12.5" r="5" fill="#8a8a8a" />
      <path d="M6 27a10.5 10.5 0 0 1 20 0" fill="#8a8a8a" />
    </svg>
  )
}

export function InfoDot({ size = 15 }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} role="img" aria-label="info">
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="9.1" y="8.6" width="1.8" height="6" rx="0.9" fill="currentColor" />
      <circle cx="10" cy="5.7" r="1.15" fill="currentColor" />
    </svg>
  )
}

export function BlueInfoDot({ size = 16 }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} role="img" aria-label="info">
      <circle cx="10" cy="10" r="10" fill="#0276b1" />
      <rect x="9" y="8.4" width="2" height="6.4" rx="1" fill="#fff" />
      <circle cx="10" cy="5.4" r="1.3" fill="#fff" />
    </svg>
  )
}

export function CalendarIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#0276b1" strokeWidth="1.7">
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="8" y1="3" x2="8" y2="6.5" strokeLinecap="round" />
      <line x1="16" y1="3" x2="16" y2="6.5" strokeLinecap="round" />
    </svg>
  )
}

export function BillIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#0276b1" strokeWidth="1.7">
      <rect x="4" y="4.5" width="16" height="15" rx="1.5" />
      <line x1="4" y1="8.5" x2="20" y2="8.5" />
      <line x1="7.5" y1="12.5" x2="16.5" y2="12.5" strokeLinecap="round" />
      <line x1="7.5" y1="16" x2="13" y2="16" strokeLinecap="round" />
    </svg>
  )
}

export function StatementIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#0276b1" strokeWidth="1.7">
      <rect x="4.5" y="3.5" width="15" height="17" rx="1.5" />
      <text x="8" y="14.5" fontSize="9.5" fontWeight="700" fill="#0276b1" stroke="none" fontFamily="Arial">$</text>
      <line x1="13" y1="9" x2="16" y2="9" strokeLinecap="round" />
      <line x1="13" y1="12.5" x2="16" y2="12.5" strokeLinecap="round" />
    </svg>
  )
}

export function PlusCircleIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#0276b1" strokeWidth="1.7">
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="8" x2="12" y2="16" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
    </svg>
  )
}

export function SearchIcon({ size = 17 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#5c5c5c" strokeWidth="2">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" strokeLinecap="round" />
    </svg>
  )
}

export function PersonCircleIcon({ size = 30 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="#444" strokeWidth="1.5">
      <circle cx="16" cy="16" r="14.5" />
      <circle cx="13.5" cy="13.5" r="3.4" />
      <path d="M7.5 21.5a7 7 0 0 1 12 0" />
      <circle cx="21" cy="14" r="2.6" />
      <path d="M18.5 20.8a5.4 5.4 0 0 1 7 .7" />
    </svg>
  )
}
