/**
 * KitSvg — pixel-perfect kit designs built from rect primitives.
 *
 * Coordinate system (viewBox 0 0 200 200):
 *   Body:        x=60  y=40  w=80  h=120
 *   Left sleeve: x=40  y=40  w=20  h=30
 *   Right sleeve: x=140 y=40  w=20  h=30
 *   Collar:      x=80  y=30  w=40  h=10
 *
 * Color conventions:
 *   primary   = body prop  (home_body from DB)
 *   secondary = leftArm prop (home_leftarm from DB)
 *
 * Patterns:
 *   null/solid  — all primary, collar secondary
 *   sleeves     — body primary, sleeves secondary, collar secondary
 *   stripes     — body base secondary, 2 vertical stripes + sleeves + collar all primary
 *   hoops       — body base secondary, 4 horizontal bands primary, sleeves + collar secondary
 *   halves      — left half + right sleeve secondary; right half + left sleeve + collar primary
 *   sash        — body + sleeves secondary; diagonal band + collar primary
 *   band        — body + sleeves primary; horizontal chest band + collar secondary → wait see below
 *   check       — body + left sleeve secondary; right sleeve + two diagonal quarters primary
 *   penguin     — body + sleeves secondary; centre panel primary, collar secondary
 */

function toHex(raw: string | null | undefined, fallback = 'CCCCCC'): string {
  const h = raw ?? fallback
  return h.startsWith('#') ? h : `#${h}`
}

function hexLuminance(hex: string): number {
  const h = hex.replace('#', '').padEnd(6, '0')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export interface KitSvgProps {
  body: string              // primary colour, hex without #
  leftArm?: string | null   // secondary colour
  rightArm?: string | null  // unused — secondary always equals leftArm
  pattern?: string | null   // see pattern list above
  number?: number | null
  numberColour?: string | null  // per-player hex override
  className?: string
}

export function KitSvg({ body, leftArm, pattern, number, numberColour, className }: KitSvgProps) {
  const primary   = toHex(body)
  const secondary = toHex(leftArm ?? body)

  // Decide rendering per pattern
  type Colors = {
    bodyBase: string
    leftSleeve: string
    rightSleeve: string
    collar: string
    overlay?: React.ReactNode
  }

  let colors: Colors

  switch (pattern) {
    case 'stripes':
      // base=secondary, 2 vertical stripes + sleeves + collar = primary
      colors = {
        bodyBase:    secondary,
        leftSleeve:  primary,
        rightSleeve: primary,
        collar:      primary,
        overlay: (
          <>
            <rect x="70"  y="40" width="20" height="120" fill={primary} />
            <rect x="110" y="40" width="20" height="120" fill={primary} />
          </>
        ),
      }
      break

    case 'hoops':
      // base=secondary, 4 horizontal bands = primary, sleeves + collar = secondary
      colors = {
        bodyBase:    secondary,
        leftSleeve:  secondary,
        rightSleeve: secondary,
        collar:      secondary,
        overlay: (
          <>
            <rect x="60" y="40"  width="80" height="20" fill={primary} />
            <rect x="60" y="70"  width="80" height="20" fill={primary} />
            <rect x="60" y="100" width="80" height="20" fill={primary} />
            <rect x="60" y="130" width="80" height="20" fill={primary} />
          </>
        ),
      }
      break

    case 'halves':
      // left half + right sleeve = secondary; right half + left sleeve + collar = primary
      colors = {
        bodyBase:    secondary,
        leftSleeve:  primary,
        rightSleeve: secondary,
        collar:      primary,
        overlay: <rect x="100" y="40" width="40" height="120" fill={primary} />,
      }
      break

    case 'sash':
      // base + sleeves = secondary; diagonal band + collar = primary
      colors = {
        bodyBase:    secondary,
        leftSleeve:  secondary,
        rightSleeve: secondary,
        collar:      primary,
        overlay: (
          <path d="M60 130L140 39.9512V69.9681L60 160.004V130Z" fill={primary} />
        ),
      }
      break

    case 'sleeves':
      // body = primary, sleeves + collar = secondary
      colors = {
        bodyBase:    primary,
        leftSleeve:  secondary,
        rightSleeve: secondary,
        collar:      secondary,
      }
      break

    case 'band':
      // body + sleeves = primary, horizontal chest band + collar = secondary
      colors = {
        bodyBase:    primary,
        leftSleeve:  primary,
        rightSleeve: primary,
        collar:      secondary,
        overlay: <rect x="60" y="80" width="80" height="20" fill={secondary} />,
      }
      break

    case 'check':
      // base + left sleeve = secondary; right sleeve + two diagonal quarters = primary
      colors = {
        bodyBase:    secondary,
        leftSleeve:  secondary,
        rightSleeve: primary,
        collar:      secondary,
        overlay: (
          <>
            <rect x="60"  y="40"  width="40" height="60" fill={primary} />
            <rect x="100" y="100" width="40" height="60" fill={primary} />
          </>
        ),
      }
      break

    case 'penguin':
      // base + sleeves + collar = secondary; centre panel = primary
      colors = {
        bodyBase:    secondary,
        leftSleeve:  secondary,
        rightSleeve: secondary,
        collar:      secondary,
        overlay: <rect x="80" y="40" width="40" height="120" fill={primary} />,
      }
      break

    default:
      // solid — everything primary, collar secondary
      colors = {
        bodyBase:    primary,
        leftSleeve:  primary,
        rightSleeve: primary,
        collar:      secondary,
      }
      break
  }

  // Number colour: explicit override wins, then auto-contrast against the body base
  const numHex = numberColour
    ? toHex(numberColour)
    : hexLuminance(colors.bodyBase) > 0.35 ? '#111111' : '#FFFFFF'

  const numStr   = number != null ? String(number) : null
  const fontSize = numStr && numStr.length > 1 ? 52 : 64

  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block' }}
    >
      {/* Background */}
      <rect x="0" y="0" width="200" height="200" fill="#ebebeb" />
      {/* Left sleeve */}
      <rect x="40" y="40" width="20" height="30" fill={colors.leftSleeve} />
      {/* Right sleeve */}
      <rect x="140" y="40" width="20" height="30" fill={colors.rightSleeve} />
      {/* Body base */}
      <rect x="60" y="40" width="80" height="120" fill={colors.bodyBase} />
      {/* Pattern overlay (drawn on top of body) */}
      {colors.overlay}
      {/* Collar */}
      <rect x="80" y="30" width="40" height="10" fill={colors.collar} />
      {/* Squad number */}
      {numStr && (
        <text
          x="100"
          y="97"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Bebas Neue, Rubik, Arial Black, Arial, sans-serif"
          fontWeight="900"
          fontSize={fontSize}
          fill={numHex}
        >
          {numStr}
        </text>
      )}
    </svg>
  )
}
