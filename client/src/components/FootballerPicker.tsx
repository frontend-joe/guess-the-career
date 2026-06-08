import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Download } from 'lucide-react'
import { getFootballers } from '@/api/footballers'

// A trigger button that opens a searchable footballer dropdown, portaled to
// <body> so it isn't clipped by scrollable/overflow ancestors. Calls onPick
// with the chosen footballer's id + name. If `scrape` is provided, a "Scrape
// from Wikipedia" action lets you create a player by their correct name.
interface Props {
  onPick: (id: number, name: string) => void
  scrape?: (query: string) => Promise<{ id: number; name: string }>
  className?: string
  title?: string
  initialQuery?: string
  children: React.ReactNode
}

interface Coords { left: number; top?: number; bottom?: number }

const POPOVER_EST_HEIGHT = 300

export function FootballerPicker({ onPick, scrape, className, title, initialQuery, children }: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: number; name: string }[]>([])
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker(e: React.MouseEvent) {
    e.stopPropagation()
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      // Drop up when there isn't room below (e.g. rows near the bottom).
      const spaceBelow = window.innerHeight - r.bottom
      setCoords(
        spaceBelow < POPOVER_EST_HEIGHT
          ? { left: r.left, bottom: window.innerHeight - r.top + 4 }
          : { left: r.left, top: r.bottom + 4 },
      )
    }
    setQ(initialQuery ?? '')
    setScrapeError(null)
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

  async function handleScrape() {
    if (!scrape || scraping) return
    const query = q.trim()
    if (query.length < 2) return
    setScraping(true)
    setScrapeError(null)
    try {
      const f = await scrape(query)
      onPick(f.id, f.name)
      setOpen(false)
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'Scrape failed')
    } finally {
      setScraping(false)
    }
  }

  return (
    <>
      <button ref={btnRef} type="button" onClick={openPicker} className={className} title={title}>
        {children}
      </button>
      {open && coords && createPortal(
        <div
          ref={popRef}
          className="fixed w-64 bg-white border rounded-lg shadow-lg p-2"
          style={{ left: coords.left, zIndex: 100, ...(coords.top != null ? { top: coords.top } : { bottom: coords.bottom }) }}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search or type correct name…"
            className="w-full text-xs border rounded px-2 py-1 mb-1 outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="max-h-48 overflow-y-auto">
            {q.trim().length < 2 ? (
              <p className="text-xs text-muted-foreground px-2 py-1.5">Type at least 2 letters…</p>
            ) : results.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1.5">No players in the database</p>
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

          {scrape && (
            <div className="mt-1 pt-1 border-t">
              <button
                type="button"
                onClick={handleScrape}
                disabled={scraping || q.trim().length < 2}
                className="w-full flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                title="Search Wikipedia for this name and import the player"
              >
                {scraping
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scraping…</>
                  : <><Download className="h-3.5 w-3.5" /> Scrape “{q.trim()}” from Wikipedia</>}
              </button>
              {scrapeError && <p className="text-[11px] text-destructive px-2 pb-1">{scrapeError}</p>}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
