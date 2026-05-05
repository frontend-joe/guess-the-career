import { useState, useEffect } from 'react'

const sizes = {
  sm: { container: 'w-8 h-8',   text: 'text-xs font-semibold' },
  md: { container: 'w-16 h-16', text: 'text-2xl font-bold' },
  lg: { container: 'w-24 h-24', text: 'text-3xl font-bold' },
}

const variants = {
  admin: { border: 'border border-border',      bg: 'bg-muted',     textColor: 'text-muted-foreground' },
  game:  { border: 'border-2 border-gray-200',  bg: 'bg-gray-200',  textColor: 'text-gray-400' },
}

export function usePlayerPhoto(id: number, wikipediaUrl: string, name: string, storedPhotoUrl?: string | null): string | null | false {
  const [photoUrl, setPhotoUrl] = useState<string | null | false>(null)

  useEffect(() => {
    if (storedPhotoUrl) { setPhotoUrl(storedPhotoUrl); return }
    setPhotoUrl(null)
    const controller = new AbortController()
    const { signal } = controller

    async function fetchPhoto() {
      const title = wikipediaUrl.split('/wiki/')[1]
      if (title) {
        try {
          const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { signal })
          const data = res.ok ? await res.json() : null
          if (data?.thumbnail?.source) { setPhotoUrl(data.thumbnail.source); return }
        } catch (err) { if ((err as Error).name === 'AbortError') return }
      }
      try {
        const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`, { signal })
        const data = res.ok ? await res.json() : null
        setPhotoUrl(data?.player?.[0]?.strThumb || false)
      } catch (err) { if ((err as Error).name !== 'AbortError') setPhotoUrl(false) }
    }

    fetchPhoto()
    return () => controller.abort()
  }, [id, storedPhotoUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  return photoUrl
}

export function PlayerAvatar({
  id,
  name,
  wikipediaUrl,
  storedPhotoUrl,
  size = 'md',
  variant = 'game',
  className = '',
}: {
  id: number
  name: string
  wikipediaUrl: string
  storedPhotoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  variant?: 'admin' | 'game'
  className?: string
}) {
  const photoUrl = usePlayerPhoto(id, wikipediaUrl, name, storedPhotoUrl)
  const s = sizes[size]
  const v = variants[variant]
  const base = `rounded-full ${s.container} ${v.border} ${className}`

  if (photoUrl === null) return <div className={`${base} ${v.bg} animate-pulse`} />
  if (photoUrl === false) return (
    <div className={`${base} ${v.bg} flex items-center justify-center`}>
      <span className={`${s.text} ${v.textColor} select-none`}>{name.charAt(0)}</span>
    </div>
  )
  return <img src={photoUrl} alt={name} className={`${base} object-cover object-top`} />
}
