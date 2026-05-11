import { useEffect, useRef, useState } from 'react'
import { nationalityToFlagUrl } from '@/lib/flags'

interface Props {
  nationality: string | null | undefined
  className?: string
}

export function NationalityFlag({ nationality, className }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const url = nationalityToFlagUrl(nationality)
  if (!url) return null

  return (
    <div ref={ref} className="relative shrink-0">
      <img
        src={url}
        alt={nationality ?? ''}
        className={className ?? 'w-4 h-4 object-cover border border-[#ebebeb] shrink-0'}
        onClick={() => setOpen(v => !v)}
      />
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-white text-gray-700 text-xs rounded-lg shadow-md whitespace-nowrap z-50 pointer-events-none">
          {nationality}
        </div>
      )}
    </div>
  )
}
