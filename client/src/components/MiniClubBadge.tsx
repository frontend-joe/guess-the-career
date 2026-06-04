import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  club: string
  wikipediaUrl: string | null
  /** Badge size in px (width & height). Defaults to 20. */
  size?: number
}

export function MiniClubBadge({ club, wikipediaUrl, size = 20 }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null)
  // Tooltip is portaled to <body> and positioned from the badge's viewport rect
  // so it can't be clipped by scrollable/overflow-hidden ancestors.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const open = coords !== null

  useEffect(() => {
    const title = wikipediaUrl
      ? wikipediaUrl.split('/wiki/')[1]
      : encodeURIComponent(club)
    if (!title) { setLogoUrl(false); return }
    const controller = new AbortController()
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setLogoUrl(data?.thumbnail?.source ?? false))
      .catch(err => { if (err.name !== 'AbortError') setLogoUrl(false) })
    return () => controller.abort()
  }, [wikipediaUrl, club])

  function toggle() {
    if (open) { setCoords(null); return }
    const r = ref.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.top, left: r.left + r.width / 2 })
  }

  useEffect(() => {
    if (!open) return
    const close = () => setCoords(null)
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    // Any scroll/resize invalidates the captured position — just dismiss.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div ref={ref} className="flex items-center justify-center shrink-0" style={{ width: size, height: size }} onClick={toggle}>
      {logoUrl === null
        ? <div className="w-full h-full bg-gray-100 animate-pulse rounded" />
        : logoUrl === false
          ? <span className="text-[9px] text-gray-400 font-bold leading-none">{club.charAt(0)}</span>
          : <img src={logoUrl} alt={club} className="max-h-full max-w-full object-contain" />
      }
      {open && coords && createPortal(
        <div
          className="fixed -translate-x-1/2 -translate-y-full px-2 py-1 bg-white text-gray-700 text-xs rounded-lg shadow-md whitespace-nowrap pointer-events-none"
          style={{ top: coords.top - 6, left: coords.left, zIndex: 100 }}
        >
          {club}
        </div>,
        document.body,
      )}
    </div>
  )
}
