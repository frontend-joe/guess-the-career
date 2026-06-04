import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { searchClubs, type ClubOption } from '@/api/clubs'

// A trigger button that opens a searchable club dropdown, portaled to <body>
// (so it isn't clipped by scrollable/overflow ancestors) and positioned from
// the trigger's viewport rect. Calls onPick with the chosen club name.
interface Props {
  onPick: (name: string) => void
  className?: string
  title?: string
  /** Pre-fills the search box (e.g. the current club name). */
  initialQuery?: string
  children: React.ReactNode
}

export function ClubPicker({ onPick, className, title, initialQuery, children }: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ClubOption[]>([])
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
      searchClubs(q).then((r) => active && setResults(r)).catch(() => {})
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
          className="fixed w-56 bg-white border rounded-lg shadow-lg p-2"
          style={{ top: coords.top, left: coords.left, zIndex: 100 }}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clubs…"
            className="w-full text-xs border rounded px-2 py-1 mb-1 outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="max-h-48 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1.5">No clubs found</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { onPick(r.name); setOpen(false) }}
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
