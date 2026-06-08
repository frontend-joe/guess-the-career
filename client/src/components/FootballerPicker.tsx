import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getFootballers } from '@/api/footballers'

// A trigger button that opens a searchable footballer dropdown, portaled to
// <body> so it isn't clipped by scrollable/overflow ancestors. Calls onPick
// with the chosen footballer's id + name.
interface Props {
  onPick: (id: number, name: string) => void
  className?: string
  title?: string
  initialQuery?: string
  children: React.ReactNode
}

export function FootballerPicker({ onPick, className, title, initialQuery, children }: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: number; name: string }[]>([])
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker(e: React.MouseEvent) {
    e.stopPropagation()
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.bottom + 4, left: r.left })
    setQ(initialQuery ?? '')
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    let active = true
    const id = setTimeout(() => {
      if (q.trim().length < 2) { setResults([]); return }
      getFootballers({ search: q })
        .then((r) => active && setResults(r.slice(0, 10).map((f) => ({ id: f.id, name: f.name }))))
        .catch(() => {})
    }, 150)
    return () => { active = false; clearTimeout(id) }
  }, [q, open])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus({ preventScroll: true })
    const close = () => setOpen(false)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button ref={btnRef} type="button" onClick={openPicker} className={className} title={title}>
        {children}
      </button>
      {open && coords && createPortal(
        <div
          ref={popRef}
          className="fixed w-60 bg-white border rounded-lg shadow-lg p-2"
          style={{ top: coords.top, left: coords.left, zIndex: 100 }}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players…"
            className="w-full text-xs border rounded px-2 py-1 mb-1 outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="max-h-48 overflow-y-auto">
            {q.trim().length < 2 ? (
              <p className="text-xs text-muted-foreground px-2 py-1.5">Type at least 2 letters…</p>
            ) : results.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1.5">No players found</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { onPick(r.id, r.name); setOpen(false) }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted"
                >
                  {r.name}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
