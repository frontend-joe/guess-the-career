import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { Search, Trash2, RefreshCw, Loader2, Shirt, ChevronRight, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { KitSvg } from '@/components/KitSvg'
import { getAllClubs, deleteAllClubs, rebuildClubs, scrapeKits, updateClubKit, getClubSeasons, startClubSeasonsBackfill, getBackfillStatus, type Club, type ClubSeason, type BackfillStatus } from '@/api/clubs'

const PATTERNS = [
  { value: '',         label: 'Solid' },
  { value: 'sleeves',  label: 'Sleeves' },
  { value: 'stripes',  label: 'Stripes' },
  { value: 'hoops',    label: 'Hoops' },
  { value: 'halves',   label: 'Halves' },
  { value: 'sash',     label: 'Sash' },
  { value: 'band',     label: 'Band' },
  { value: 'check',    label: 'Check' },
  { value: 'penguin',  label: 'Penguin' },
]

// The leagues Tenable builds rounds from — worth picking out of a club's
// history, since they're the seasons that decide whether a player's spell can
// be credited to a league.
const MAJOR_LEAGUES = new Set([
  'Premier League', 'EFL Championship', 'First Division',
  'Serie A', 'La Liga', 'Bundesliga', 'Ligue 1',
])

// Collapse a season-by-season list into spells, so a club that spent 24 years
// in the same division reads as one row instead of 24. Seasons arrive newest
// first; a gap in the years breaks the run as well as a change of league.
function toSpells(seasons: ClubSeason[]) {
  const asc = [...seasons].sort((a, b) => a.season_year - b.season_year)
  const spells: { league: string; from: string; to: string; count: number }[] = []
  for (const s of asc) {
    const last = spells[spells.length - 1]
    const prev = asc[asc.indexOf(s) - 1]
    if (last && last.league === s.league && prev && s.season_year - prev.season_year === 1) {
      last.to = s.season
      last.count += 1
    } else {
      spells.push({ league: s.league, from: s.season, to: s.season, count: 1 })
    }
  }
  return spells.reverse()
}

function ClubSeasonHistory({ clubId }: { clubId: number }) {
  const [seasons, setSeasons] = useState<ClubSeason[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getClubSeasons(clubId)
      .then(r => { if (!cancelled) setSeasons(r) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [clubId])

  if (error) return <p className="text-sm text-destructive py-3">Couldn’t load season history.</p>
  if (!seasons) return <p className="text-sm text-muted-foreground py-3">Loading season history…</p>
  if (seasons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-3">
        No season history yet — run the club seasons backfill, or this club has no
        “List of seasons” article on Wikipedia.
      </p>
    )
  }

  const spells = toSpells(seasons)
  return (
    <div className="py-3">
      <p className="text-xs text-muted-foreground mb-2">
        {seasons.length} seasons · {spells.length} spells
      </p>
      <div className="flex flex-col gap-1">
        {spells.map((s, i) => (
          <div key={i} className="flex items-baseline gap-3 text-sm">
            <span className="tabular-nums text-muted-foreground w-36 shrink-0">
              {s.from === s.to ? s.from : `${s.from} – ${s.to}`}
            </span>
            <span className={MAJOR_LEAGUES.has(s.league) ? 'font-medium' : 'text-muted-foreground'}>
              {s.league}
            </span>
            <span className="text-xs text-muted-foreground">
              {s.count} {s.count === 1 ? 'season' : 'seasons'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClubLogo({ wikipediaUrl }: { wikipediaUrl: string | null }) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null)

  useEffect(() => {
    if (!wikipediaUrl) { setLogoUrl(false); return }
    const title = wikipediaUrl.split('/wiki/')[1]
    if (!title) { setLogoUrl(false); return }
    const controller = new AbortController()
    setLogoUrl(null)
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => setLogoUrl(data?.thumbnail?.source ?? false))
      .catch(err => { if (err.name !== 'AbortError') setLogoUrl(false) })
    return () => controller.abort()
  }, [wikipediaUrl])

  if (logoUrl === null) return <div className="w-8 h-8 rounded bg-muted animate-pulse" />
  if (logoUrl === false) return <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">?</div>
  return <img src={logoUrl} alt="" className="w-8 h-8 object-contain" />
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// Validate and normalise a hex string: strip #, expand 3-char, uppercase
function sanitiseHex(raw: string): string {
  const h = raw.replace('#', '').toUpperCase().replace(/[^0-9A-F]/g, '')
  if (h.length === 3) return h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  return h.slice(0, 6)
}

function KitEditCell({ club, onSaved }: { club: Club; onSaved: (updated: Club) => void }) {
  const ref    = useRef<HTMLDivElement>(null)
  const [open, setOpen]       = useState(false)
  const [pos,  setPos]        = useState<{ top: number; left: number } | null>(null)
  const [primary,   setPrimary]   = useState('')
  const [secondary, setSecondary] = useState('')
  const [pattern,   setPattern]   = useState('')
  const [saving, setSaving]   = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    // Position below the thumbnail, centred; keep on screen
    const left = Math.min(r.left + r.width / 2, window.innerWidth - 140)
    setPos({ top: r.bottom + 8, left })
    setPrimary(club.home_body ?? '')
    setSecondary(club.home_leftarm ?? '')
    setPattern(club.home_pattern ?? '')
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateClubKit(club.id, {
        home_body:    primary   || null,
        home_leftarm: secondary || null,
        home_pattern: pattern   || null,
      })
      onSaved(updated)
      setOpen(false)
    } catch {
      alert('Failed to save kit')
    } finally {
      setSaving(false)
    }
  }

  const previewBody    = primary   || 'CCCCCC'
  const previewLeftArm = secondary || undefined
  const previewPattern = pattern   || null

  return (
    <div ref={ref} className="inline-block">
      <button
        type="button"
        onClick={handleClick}
        title="Click to edit kit"
        className="block focus:outline-none rounded"
      >
        {club.home_body
          ? <KitSvg body={club.home_body} leftArm={club.home_leftarm} pattern={club.home_pattern} className="w-8 h-auto" />
          : <span className="text-muted-foreground text-xs underline cursor-pointer">Set kit</span>
        }
      </button>

      {open && createPortal(
        <>
          {/* Backdrop to dismiss */}
          <div
            className="fixed inset-0 z-9998"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-9999 pointer-events-auto"
            style={{ top: pos!.top, left: pos!.left, transform: 'translateX(-50%)' }}
          >
            <div className="bg-white border border-border rounded-lg shadow-xl p-3 w-60">
              {/* Live preview */}
              <div className="flex justify-center mb-3">
                <KitSvg
                  body={previewBody}
                  leftArm={previewLeftArm}
                  pattern={previewPattern}
                  className="w-20 h-auto"
                />
              </div>

              {/* Primary */}
              <p className="text-xs text-muted-foreground mb-1 font-medium">Primary</p>
              <div className="flex gap-1.5 mb-2 items-center">
                <input
                  type="color"
                  value={`#${sanitiseHex(primary) || 'CCCCCC'}`}
                  onChange={e => setPrimary(sanitiseHex(e.target.value))}
                  className="h-8 w-10 rounded border cursor-pointer p-0.5 shrink-0"
                />
                <Input
                  value={primary}
                  onChange={e => setPrimary(e.target.value.replace('#', '').replace(/[^0-9a-fA-F]/g, ''))}
                  placeholder="RRGGBB"
                  className="font-mono text-xs h-8"
                  maxLength={6}
                />
              </div>

              {/* Secondary */}
              <p className="text-xs text-muted-foreground mb-1 font-medium">Secondary</p>
              <div className="flex gap-1.5 mb-2 items-center">
                <input
                  type="color"
                  value={`#${sanitiseHex(secondary) || 'CCCCCC'}`}
                  onChange={e => setSecondary(sanitiseHex(e.target.value))}
                  className="h-8 w-10 rounded border cursor-pointer p-0.5 shrink-0"
                />
                <Input
                  value={secondary}
                  onChange={e => setSecondary(e.target.value.replace('#', '').replace(/[^0-9a-fA-F]/g, ''))}
                  placeholder="RRGGBB"
                  className="font-mono text-xs h-8"
                  maxLength={6}
                />
              </div>

              {/* Pattern */}
              <p className="text-xs text-muted-foreground mb-1 font-medium">Pattern</p>
              <select
                value={pattern}
                onChange={e => setPattern(e.target.value)}
                className="w-full border border-input rounded-md h-8 px-2 text-sm mb-3 bg-background"
              >
                {PATTERNS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>

              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-8" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

export function ClubsPage() {
  const [search, setSearch] = useState('')
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [scrapingKits, setScrapingKits] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  // One club's season history open at a time — these lists run to 130 rows.
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [seasonsJob, setSeasonsJob] = useState<BackfillStatus | null>(null)

  const debouncedSearch = useDebounce(search, 250)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setClubs(await getAllClubs(debouncedSearch ? { search: debouncedSearch } : undefined))
    } catch {
      setError('Failed to load clubs')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { load() }, [load])

  // Clubs that are eligible for kit scraping (have a wikipedia_url)
  const scrapeableClubs = clubs.filter(c => c.wikipedia_url)
  const selectedScrapeableCount = scrapeableClubs.filter(c => selectedIds.has(c.id)).length
  // The seasons backfill runs server-side and outlives this request, so poll
  // for progress rather than holding a stream open — the production proxy
  // buffers SSE.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const poll = async () => {
      try {
        const st = await getBackfillStatus()
        setSeasonsJob(st.type === 'club-seasons' ? st : null)
        if (!st.running && timer) { clearInterval(timer); timer = null }
      } catch { /* transient — the next tick retries */ }
    }
    void poll()
    timer = setInterval(poll, 3000)
    return () => { if (timer) clearInterval(timer) }
  }, [])

  async function handleScrapeSeasons() {
    await startClubSeasonsBackfill()
    setSeasonsJob({ type: 'club-seasons', running: true, total: 0, done: 0, updated: 0, failed: 0, currentName: null, error: null, failures: [] })
  }

  const allScrapeableSelected = scrapeableClubs.length > 0 && selectedScrapeableCount === scrapeableClubs.length
  const someScrapeableSelected = selectedScrapeableCount > 0 && !allScrapeableSelected

  function toggleAll() {
    if (allScrapeableSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        scrapeableClubs.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        scrapeableClubs.forEach(c => next.add(c.id))
        return next
      })
    }
  }

  function toggleClub(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleClubSaved(updated: Club) {
    setClubs(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  async function handleDeleteAll() {
    setDeletingAll(true)
    try {
      await deleteAllClubs()
      await load()
      setSelectedIds(new Set())
      setDeleteAllConfirm(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete clubs')
    } finally {
      setDeletingAll(false)
    }
  }

  async function handleRebuild() {
    setRebuilding(true)
    try {
      const { count } = await rebuildClubs()
      await load()
      alert(`Rebuilt clubs — ${count} clubs now in database.`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to rebuild clubs')
    } finally {
      setRebuilding(false)
    }
  }

  async function handleScrapeKits() {
    setScrapingKits(true)
    const ids = selectedIds.size > 0 ? [...selectedIds] : undefined
    try {
      const { updated, skipped } = await scrapeKits(ids)
      await load()
      alert(`Kit scraping complete — ${updated} updated, ${skipped} skipped.`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to scrape kits')
    } finally {
      setScrapingKits(false)
    }
  }

  const busy = deletingAll || rebuilding || scrapingKits

  const scrapeLabel = selectedIds.size > 0
    ? `Scrape ${selectedIds.size} kit${selectedIds.size !== 1 ? 's' : ''}`
    : 'Scrape all kits'

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold">Clubs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clubs.length} club{clubs.length !== 1 ? 's' : ''} in database
            {selectedIds.size > 0 && (
              <span className="ml-2 text-foreground font-medium">· {selectedIds.size} selected</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteAllConfirm(true)}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Clear all</span>
            <span className="sm:hidden">Clear</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRebuild}
            disabled={busy}
          >
            {rebuilding
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <RefreshCw className="h-4 w-4 mr-1.5" />
            }
            <span className="hidden sm:inline">Rebuild from footballers</span>
            <span className="sm:hidden">Rebuild</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleScrapeSeasons}
            disabled={busy || !!seasonsJob?.running}
          >
            {seasonsJob?.running
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <CalendarRange className="h-4 w-4 mr-1.5" />
            }
            <span className="hidden sm:inline">
              {seasonsJob?.running
                ? `Seasons ${seasonsJob.done}/${seasonsJob.total}`
                : 'Scrape seasons'}
            </span>
            <span className="sm:hidden">Seasons</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleScrapeKits}
            disabled={busy}
          >
            {scrapingKits
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <Shirt className="h-4 w-4 mr-1.5" />
            }
            <span className="hidden sm:inline">{scrapeLabel}</span>
            <span className="sm:hidden">Kits</span>
          </Button>
        </div>
      </div>

      {seasonsJob && (seasonsJob.failures.length > 0 || (!seasonsJob.running && seasonsJob.done > 0)) && (
        <div className="mb-4 rounded-lg border px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {seasonsJob.running ? 'Scraping seasons' : 'Last seasons scrape'}:{' '}
            <span className="text-foreground">{seasonsJob.done}</span> checked ·{' '}
            <span className="text-foreground">{seasonsJob.updated}</span> with a season history ·{' '}
            <span className={seasonsJob.failed > 0 ? 'text-destructive' : 'text-foreground'}>
              {seasonsJob.failed}
            </span>{' '}
            failed
          </p>
          {seasonsJob.failures.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5">
              {seasonsJob.failures.map((f, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium">{f.name}</span>
                  <span className="text-muted-foreground"> — {f.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clubs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {deleteAllConfirm && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="text-destructive">Clear all {clubs.length} clubs? This cannot be undone.</span>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteAllConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deletingAll}
              onClick={handleDeleteAll}
            >
              {deletingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Clear all
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
      ) : clubs.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          {search ? `No clubs match "${search}"` : 'No clubs yet. Use "Rebuild from footballers" to populate.'}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="min-w-60 px-4 md:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allScrapeableSelected}
                      data-state={someScrapeableSelected ? 'indeterminate' : undefined}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-8" />
                  <TableHead className="w-12">Logo</TableHead>
                  <TableHead className="w-16">Kit</TableHead>
                  <TableHead>Club name</TableHead>
                  <TableHead className="text-muted-foreground">Wikipedia URL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubs.map((club) => (
                  <Fragment key={club.id}>
                  <TableRow
                    className={selectedIds.has(club.id) ? 'bg-muted/40' : ''}
                    onClick={() => { if (club.wikipedia_url) toggleClub(club.id) }}
                    style={{ cursor: club.wikipedia_url ? 'pointer' : 'default' }}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      {club.wikipedia_url && (
                        <Checkbox
                          checked={selectedIds.has(club.id)}
                          onCheckedChange={() => toggleClub(club.id)}
                          aria-label={`Select ${club.name}`}
                        />
                      )}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setExpandedId(id => id === club.id ? null : club.id)}
                        aria-label={`${expandedId === club.id ? 'Hide' : 'Show'} season history for ${club.name}`}
                        aria-expanded={expandedId === club.id}
                        className="p-1 -m-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform duration-150 ${expandedId === club.id ? 'rotate-90' : ''}`}
                        />
                      </button>
                    </TableCell>
                    <TableCell>
                      <ClubLogo wikipediaUrl={club.wikipedia_url} />
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <KitEditCell club={club} onSaved={handleClubSaved} />
                    </TableCell>
                    <TableCell className="font-medium">{club.name}</TableCell>
                    <TableCell className="text-sm">
                      {club.wikipedia_url
                        ? <a href={club.wikipedia_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:underline truncate block max-w-xs">{club.wikipedia_url}</a>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                  </TableRow>
                  {expandedId === club.id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="bg-muted/20 pl-16">
                        <ClubSeasonHistory clubId={club.id} />
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
