import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import {
  Trash2, ExternalLink, Calendar, CheckCircle2, Loader2, Circle, Power, RefreshCw, ChevronDown, Link2, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NationalityFlag } from '@/components/NationalityFlag'
import { PositionBadge } from '@/components/PositionBadge'
import { ClubPicker } from '@/components/ClubPicker'
import { FootballerPicker } from '@/components/FootballerPicker'
import {
  scrapeRecordSignings,
  importRecordSignings,
  getRecordSigningsClubs,
  deleteRecordSigningsClub,
  updateRecordSigningsClub,
  relinkRecordSigningsClub,
  getRecordSigningsClubDetail,
  resolvePlayer,
  resolvePlayerByUrl,
  type CheckedSigning,
  type RecordSigningsClubListItem,
} from '@/api/record-signings-admin'

const EXAMPLE_URL = 'https://www.transfermarkt.com/fc-barcelona/rekordabgaenge/verein/131'

// A matched club renders as plain text. An unmatched one is a red badge that
// opens a searchable club dropdown to pick the right club from our DB.
function ClubLabel({
  name,
  matched,
  onPick,
}: {
  name: string
  matched: boolean
  onPick: (name: string) => void
}) {
  if (matched) return <span>{name}</span>
  return (
    <ClubPicker
      onPick={onPick}
      initialQuery={name}
      title="No matching club — click to choose one"
      className="inline-flex items-center gap-0.5 rounded bg-red-100 text-red-700 px-1.5 py-0.5 font-medium hover:bg-red-200 transition-colors"
    >
      {name}
      <ChevronDown className="h-3 w-3" />
    </ClubPicker>
  )
}

export function RecordSigningsAdminPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<RecordSigningsClubListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)

  const [meta, setMeta] = useState<{ club: string; transfermarkt_id: string | null; source_url: string } | null>(null)
  const [signings, setSignings] = useState<CheckedSigning[]>([])
  // Indices the admin has selected as "major" (included in the game).
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  // Live linking progress after an import; polled every second until all the
  // queued (newly-scraped) players are linked or progress stalls.
  const [importProgress, setImportProgress] = useState<{ clubId: number; total: number; linked: number; done: boolean } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [relinkingId, setRelinkingId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      setItems(await getRecordSigningsClubs())
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  function resetPreview() {
    setMeta(null)
    setSignings([])
    setSelected(new Set())
    setScrapeError(null)
    setImportError(null)
    stopPolling()
    setImportProgress(null)
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Poll the club's players every second, updating the linked count until every
  // queued player is linked — or progress stalls (some names can't be matched).
  function startPolling(clubId: number, total: number) {
    stopPolling()
    let lastLinked = -1
    let stalls = 0
    pollRef.current = setInterval(async () => {
      try {
        const detail = await getRecordSigningsClubDetail(clubId)
        const linked = detail.signings.filter((s) => s.linked).length
        setImportProgress((p) => (p && p.clubId === clubId ? { ...p, linked } : p))
        if (linked >= total) {
          setImportProgress((p) => (p && p.clubId === clubId ? { ...p, linked, done: true } : p))
          stopPolling()
          void load()
          return
        }
        if (linked === lastLinked) {
          stalls++
        } else {
          stalls = 0
          lastLinked = linked
        }
        if (stalls >= 45) {
          setImportProgress((p) => (p && p.clubId === clubId ? { ...p, done: true } : p))
          stopPolling()
          void load()
        }
      } catch {
        // keep polling on a transient error
      }
    }, 1000)
  }

  useEffect(() => () => stopPolling(), [])

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  // Manually link a (new) scraped player to an existing footballer in the DB
  // when the names don't quite match. The import then links by id directly.
  function setFootballer(i: number, id: number, name: string) {
    setSignings(prev => prev.map((t, idx) =>
      idx === i ? { ...t, footballer_id: id, player_name: name, in_db: true } : t,
    ))
  }

  // Manually link an unmatched club to a chosen DB club for one signing; the
  // import sends this name, which the server resolves to the DB club + badge.
  function setClub(i: number, name: string) {
    setSignings(prev => prev.map((t, idx) =>
      idx === i ? { ...t, from_club: name, from_club_matched: true } : t,
    ))
  }

  async function handleScrape() {
    if (!url.trim()) return
    setScraping(true)
    resetPreview()
    try {
      const result = await scrapeRecordSignings(url.trim())
      setMeta({
        club: result.club,
        transfermarkt_id: result.transfermarkt_id,
        source_url: result.source_url,
      })
      setSignings(result.signings)
      // All signings are checked by default (the top 10 record signings); the
      // admin can uncheck any they don't want.
      setSelected(new Set(result.signings.map((_, i) => i)))
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'Scrape failed')
    } finally {
      setScraping(false)
    }
  }

  async function handleImport() {
    if (!meta || selected.size === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const chosen = signings.filter((_, i) => selected.has(i))
      const result = await importRecordSignings({
        club: meta.club,
        club_wikipedia_url: null,
        transfermarkt_id: meta.transfermarkt_id,
        source_url: meta.source_url,
        signings: chosen.map(t => ({
          player_name: t.player_name,
          nationality: t.nationality,
          position: t.position,
          from_club: t.from_club,
          fee_text: t.fee_text,
          fee_value: t.fee_value,
          season_label: t.season_label,
          footballer_id: t.footballer_id,
        })),
      })
      const total = result.importSummary.linked + result.importSummary.queued
      setImportProgress({
        clubId: result.club.id,
        total,
        linked: result.importSummary.linked,
        done: result.importSummary.queued === 0,
      })
      // Hide + reset the scrape/preview form so the admin can go straight to the
      // next team. The progress line above persists until they start a new scrape.
      setMeta(null)
      setSignings([])
      setSelected(new Set())
      setUrl('')
      await load()
      if (result.importSummary.queued > 0) startPolling(result.club.id, total)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(id: number, label: string) {
    if (!confirm(`Delete ${label} and all its signings?`)) return
    setDeletingId(id)
    try {
      await deleteRecordSigningsClub(id)
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleActive(item: RecordSigningsClubListItem) {
    await updateRecordSigningsClub(item.id, { active: !item.active })
    await load()
  }

  async function handleRelink(id: number) {
    setRelinkingId(id)
    try {
      await relinkRecordSigningsClub(id)
      await load()
    } finally {
      setRelinkingId(null)
    }
  }

  const selectedCount = selected.size
  const newSelected = signings.filter((t, i) => selected.has(i) && !t.in_db).length

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Record Signings</h1>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/record-signings/schedule')}>
          <Calendar className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

      {/* Scrape panel */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Import a club's record signings from Transfermarkt</p>
        <p className="text-xs text-muted-foreground">
          e.g. <code className="bg-muted px-1 rounded">{EXAMPLE_URL}</code>
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="Transfermarkt record signings URL…"
            value={url}
            onChange={e => { setUrl(e.target.value); resetPreview() }}
            onKeyDown={e => e.key === 'Enter' && !scraping && handleScrape()}
            className="flex-1 text-sm border border-input rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-ring"
            disabled={importing}
          />
          <Button size="sm" onClick={handleScrape} disabled={scraping || importing || !url.trim()}>
            {scraping ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Scraping…</> : 'Scrape'}
          </Button>
        </div>

        {scrapeError && <p className="text-sm text-destructive">{scrapeError}</p>}

        {importProgress && (
          importProgress.done ? (
            <p className="text-sm text-green-600 font-medium">
              ✓ Imported — {importProgress.linked}/{importProgress.total} players linked
              {importProgress.linked < importProgress.total && (
                <span className="text-amber-600 font-normal"> · {importProgress.total - importProgress.linked} couldn't be matched (try Rescrape)</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-blue-600 font-medium inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Linking players… {importProgress.linked}/{importProgress.total}
            </p>
          )
        )}

        {meta && signings.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="font-semibold">
                {meta.club}{meta.transfermarkt_id ? ` (#${meta.transfermarkt_id})` : ''} — {signings.length} signings
              </span>
              <span className="text-muted-foreground">{selectedCount} selected</span>
              {newSelected > 0 && (
                <span className="text-blue-600 flex items-center gap-1">
                  <Circle className="h-3.5 w-3.5" /> {newSelected} will be imported
                </span>
              )}
            </div>

            <div className="border rounded-md overflow-hidden max-h-112 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0 z-20 border-b">
                  <tr>
                    <th className="px-2 py-1.5 w-6"></th>
                    <th className="text-left px-2 py-1.5 font-medium">Player</th>
                    <th className="px-2 py-1.5 font-medium w-8">Pos</th>
                    <th className="text-left px-2 py-1.5 font-medium">From</th>
                    <th className="text-left px-2 py-1.5 font-medium">Season</th>
                    <th className="text-right px-2 py-1.5 font-medium">Fee</th>
                    <th className="px-2 py-1.5 font-medium w-10">DB</th>
                  </tr>
                </thead>
                <tbody>
                  {signings.map((t, i) => {
                    const isSel = selected.has(i)
                    return (
                      <tr
                        key={i}
                        onClick={() => { if (!importing) toggle(i) }}
                        className="border-t cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            checked={isSel}
                            readOnly
                            className="pointer-events-none accent-primary"
                          />
                        </td>
                        <td className="px-2 py-1 font-medium">
                          <span className="flex items-center gap-1.5">
                            <NationalityFlag nationality={t.nationality} />
                            <span>{t.player_name}</span>
                            {!t.in_db && (
                              <FootballerPicker
                                onPick={(id, name) => setFootballer(i, id, name)}
                                scrape={(query) => resolvePlayer(query, t.from_club)}
                                scrapeUrl={(u) => resolvePlayerByUrl(u)}
                                initialQuery={t.player_name}
                                title="Link to an existing player, or scrape the correct name / Wikipedia URL"
                                className="inline-flex items-center gap-0.5 rounded bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-semibold hover:bg-blue-200 transition-colors"
                              >
                                <Link2 className="h-3 w-3" /> link
                              </FootballerPicker>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center">
                          <PositionBadge position={t.position} className="inline-block text-[10px] font-semibold px-1.5" />
                        </td>
                        <td className="px-2 py-1 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                          <ClubLabel name={t.from_club} matched={t.from_club_matched} onPick={(n) => setClub(i, n)} />
                        </td>
                        <td className="px-2 py-1 text-muted-foreground tabular-nums">{t.season_label}</td>
                        <td className="px-2 py-1 tabular-nums text-right font-medium">{t.fee_text}</td>
                        <td className="px-2 py-1 text-center">
                          {t.in_db
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline" />
                            : <span className="text-[10px] text-blue-500">new</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {importError && <p className="text-sm text-destructive">{importError}</p>}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {newSelected > 0
                  ? `${newSelected} player${newSelected !== 1 ? 's' : ''} not in the DB will be scraped from Wikipedia and added.`
                  : ''}
              </p>
              <Button size="sm" onClick={handleImport} disabled={importing || selectedCount === 0}>
                {importing
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Importing…</>
                  : `Import ${selectedCount} signing${selectedCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Imported clubs */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Imported ({items.length})
        </p>
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No clubs imported yet.</p>
        )}
        {items.map(item => (
          <div key={item.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 ${item.active ? '' : 'opacity-60'} ${item.unlinked_count > 0 ? 'border-amber-300 bg-amber-50/50' : ''}`}>
            <button
              onClick={() => navigate(`/admin/record-signings/${item.id}`)}
              className="flex-1 min-w-0 text-left group"
              title={item.unlinked_count > 0 ? `${item.unlinked_count} player${item.unlinked_count !== 1 ? 's' : ''} not linked — click to fix` : 'View signings as they appear in the game'}
            >
              <p className="text-sm font-semibold truncate group-hover:underline">{item.club}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {item.player_count} signings
                {item.unlinked_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                    <AlertTriangle className="h-3 w-3" /> {item.unlinked_count} to fix
                  </span>
                )}
              </p>
            </button>
            <button
              onClick={() => handleToggleActive(item)}
              title={item.active ? 'Active — click to disable' : 'Disabled — click to enable'}
              className={item.active ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'}
            >
              <Power className="h-3.5 w-3.5" />
            </button>
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button
              variant="outline" size="sm"
              className="h-7"
              disabled={relinkingId === item.id}
              onClick={() => handleRelink(item.id)}
              title="Re-attempt the Wikipedia match/import for unmatched players"
            >
              {relinkingId === item.id
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Rescraping…</>
                : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Rescrape</>}
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              disabled={deletingId === item.id}
              onClick={() => handleDelete(item.id, item.club)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
