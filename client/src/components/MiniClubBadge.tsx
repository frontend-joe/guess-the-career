import { useEffect, useRef, useState } from 'react'

interface Props {
  club: string
  wikipediaUrl: string | null
}

export function MiniClubBadge({ club, wikipediaUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative w-5 h-5 flex items-center justify-center shrink-0" onClick={() => setOpen(v => !v)}>
      {logoUrl === null
        ? <div className="w-full h-full bg-gray-100 animate-pulse rounded" />
        : logoUrl === false
          ? <span className="text-[9px] text-gray-400 font-bold leading-none">{club.charAt(0)}</span>
          : <img src={logoUrl} alt={club} className="max-h-full max-w-full object-contain" />
      }
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-white text-gray-700 text-xs rounded-lg shadow-md whitespace-nowrap z-50 pointer-events-none">
          {club}
        </div>
      )}
    </div>
  )
}
