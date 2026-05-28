import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import {
  Trash2, ExternalLink, Calendar, Loader2, RefreshCw,
  CheckCircle2, XCircle, Circle, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getWorldCupSquads,
  scrapeWorldCupSquads,
  checkWorldCupPlayers,
  importWorldCupSquads,
  refreshWorldCupSquad,
  deleteWorldCupSquad,
  type WorldCupSquadListItem,
  type WorldCupScrapedSquad,
  type WorldCupScrapedPlayer,
} from '@/api/world-cup-squads'

type SquadImportState = 'pending' | 'importing' | 'done' | 'failed'

interface CheckedPlayer extends WorldCupScrapedPlayer {
  in_db: boolean
  footballer_id: number | null
}

interface SquadRow {
  squad: WorldCupScrapedSquad
  checked: boolean
  alreadyImported: boolean
  importState: SquadImportState
  error?: string
  expanded: boolean
  checkedPlayers: CheckedPlayer[] | null  // null = not yet checked
  checking: boolean
}

export function WorldCupAdminPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<WorldCupSquadListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)

  const [scrapedYear, setScrapedYear] = useState<number | null>(null)
  const [squadRows, setSquadRows] = useState<SquadRow[]>([])

  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [refreshingId, setRefreshingId] = useState<number | null>(null)
  const [rescrapeAllRunning, setRescrapeAllRunning] = useState(false)
  const [rescrapeAllDone, setRescrapeAllDone] = useState(false)

  async function load() {
    setLoading(true)
    try { setItems(await getWorldCupSquads()) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function resetPreview() {
    setScrapedYear(null)
    setSquadRows([])
    setScrapeError(null)
    setImportError(null)
    setImportDone(false)
  }

  async function handleScrape() {
    if (!url.trim()) return
    setScraping(true)
    setScrapeError(null)
    resetPreview()
    try {
      const result = await scrapeWorldCupSquads(url.trim())
      setScrapedYear(result.year)
      const importedKeys = new Set(items.map(i => `${i.year}:${i.team}`))
      const rows: SquadRow[] = result.squads.map(squad => ({
        squad,
        checked: !importedKeys.has(`${result.year}:${squad.team}`),
        alreadyImported: importedKeys.has(`${result.year}:${squad.team}`),
        importState: 'pending',
        expanded: false,
        checkedPlayers: null,
        checking: false,
      }))
      setSquadRows(rows)
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'Scrape failed')
    } finally {
      setScraping(false)
    }
  }

  async function toggleExpand(i: number) {
    const row = squadRows[i]
    if (!row) return

    if (row.expanded) {
      setSquadRows(prev => prev.map((r, idx) => idx === i ? { ...r, expanded: false } : r))
      return
    }

    // Expand and check players if not yet done
    setSquadRows(prev => prev.map((r, idx) =>
      idx === i ? { ...r, expanded: true, checking: r.checkedPlayers === null } : r
    ))

    if (row.checkedPlayers === null) {
      try {
        const checked = await checkWorldCupPlayers(
          row.squad.players.map(p => ({ name: p.name, wikipedia_url: p.wikipedia_url ?? null }))
        )
        const merged: CheckedPlayer[] = row.squad.players.map((p, pi) => ({
          ...p,
          in_db: checked[pi].in_db,
          footballer_id: checked[pi].footballer_id,
        }))
        setSquadRows(prev => prev.map((r, idx) =>
          idx === i ? { ...r, checkedPlayers: merged, checking: false } : r
        ))
      } catch {
        setSquadRows(prev => prev.map((r, idx) =>
          idx === i ? { ...r, checking: false } : r
        ))
      }
    }
  }

  function toggleSquad(i: number) {
    setSquadRows(prev => prev.map((r, idx) =>
      idx === i ? { ...r, checked: !r.checked } : r
    ))
  }

  function toggleAll(checked: boolean) {
    setSquadRows(prev => prev.map(r => r.alreadyImported ? r : { ...r, checked }))
  }

  async function handleImport() {
    if (!scrapedYear || squadRows.length === 0) return
    setImporting(true)
    setImportError(null)

    const updatedRows = [...squadRows]
    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i]
      if (!row.checked || row.alreadyImported) continue

      updatedRows[i] = { ...updatedRows[i], importState: 'importing' }
      setSquadRows([...updatedRows])

      try {
        await importWorldCupSquads({
          year: scrapedYear,
          wikipedia_url: url.trim(),
          squads: [row.squad],
        })
        updatedRows[i] = { ...updatedRows[i], importState: 'done' }
      } catch (e) {
        updatedRows[i] = {
          ...updatedRows[i],
          importState: 'failed',
          error: e instanceof Error ? e.message : 'Import failed',
        }
      }
      setSquadRows([...updatedRows])
    }

    const failed = updatedRows.filter(r => r.importState === 'failed')
    if (failed.length > 0) setImportError(`${failed.length} squad(s) failed to import`)
    else if (updatedRows.some(r => r.importState === 'done')) setImportDone(true)

    setImporting(false)
    await load()
  }

  async function handleRefresh(id: number) {
    setRefreshingId(id)
    try { await refreshWorldCupSquad(id) } catch { /* silent */ } finally { setRefreshingId(null) }
  }

  async function handleRescrapeAll() {
    setRescrapeAllRunning(true)
    setRescrapeAllDone(false)
    try {
      for (const item of items) {
        setRefreshingId(item.id)
        try { await refreshWorldCupSquad(item.id) } catch { /* continue */ }
      }
      setRescrapeAllDone(true)
    } finally {
      setRescrapeAllRunning(false)
      setRefreshingId(null)
    }
  }

  async function handleDelete(id: number, team: string, yr: number) {
    if (!confirm(`Delete ${team} ${yr} squad and all its players?`)) return
    setDeletingId(id)
    try { await deleteWorldCupSquad(id); await load() } finally { setDeletingId(null) }
  }

  const checkedCount = squadRows.filter(r => r.checked && !r.alreadyImported).length
  const newCount = squadRows.filter(r => !r.alreadyImported).length
  const allChecked = newCount > 0 && squadRows.filter(r => !r.alreadyImported).every(r => r.checked)

  function squadStateIcon(row: SquadRow) {
    if (row.alreadyImported) return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
    if (!importing && !importDone) return null
    switch (row.importState) {
      case 'importing': return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />
      case 'done':      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
      case 'failed':    return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
      default:          return null
    }
  }

  const byYear = items.reduce<Record<number, WorldCupSquadListItem[]>>((acc, item) => {
    if (!acc[item.year]) acc[item.year] = []
    acc[item.year].push(item)
    return acc
  }, {})

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">World Cup Squads</h1>
        <Button variant="outline" size="sm" onClick={() => navigate('/world-cup/schedule')}>
          <Calendar className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

      {/* Scrape panel */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Import from Wikipedia</p>
        <p className="text-xs text-muted-foreground">
          e.g. <code className="bg-muted px-1 rounded">https://en.wikipedia.org/wiki/1990_FIFA_World_Cup_squads</code>
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="Wikipedia URL…"
            value={url}
            onChange={e => { setUrl(e.target.value); resetPreview() }}
            onKeyDown={e => e.key === 'Enter' && !scraping && handleScrape()}
            className="flex-1 text-sm border border-input rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-ring"
            disabled={importing}
          />
          <Button size="sm" onClick={handleScrape} disabled={scraping || importing || !url.trim()}>
            {scraping
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Scraping…</>
              : 'Scrape'
            }
          </Button>
        </div>

        {scrapeError && <p className="text-sm text-destructive">{scrapeError}</p>}

        {squadRows.length > 0 && scrapedYear && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="font-semibold">{scrapedYear} World Cup — {squadRows.length} squads found</span>
              {newCount > 0 && (
                <span className="text-muted-foreground">{checkedCount} selected to import</span>
              )}
            </div>

            {/* Squad list with expandable player previews */}
            <div className="border rounded-md overflow-hidden">
              {/* Select-all header */}
              {!importing && !importDone && newCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b text-xs">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={e => toggleAll(e.target.checked)}
                    className="cursor-pointer accent-primary"
                  />
                  <span className="text-muted-foreground font-medium">Select all</span>
                </div>
              )}

              {squadRows.map((row, i) => {
                const inDbCount = row.checkedPlayers?.filter(p => p.in_db).length ?? null
                const newPlayers = row.checkedPlayers?.filter(p => !p.in_db).length ?? null

                return (
                  <div key={row.squad.team} className={`border-b last:border-0 ${row.alreadyImported ? 'opacity-60' : ''}`}>
                    {/* Squad row */}
                    <div className="flex items-center gap-2 px-3 py-2">
                      {/* Checkbox / import state */}
                      <div className="w-5 flex items-center justify-center shrink-0">
                        {importing || importDone
                          ? squadStateIcon(row)
                          : row.alreadyImported
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            : (
                              <input
                                type="checkbox"
                                checked={row.checked}
                                onChange={() => toggleSquad(i)}
                                className="cursor-pointer accent-primary"
                              />
                            )
                        }
                      </div>

                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleExpand(i)}
                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                      >
                        {row.expanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        }
                        <span className="text-sm font-medium truncate">{row.squad.team}</span>
                        {row.alreadyImported && (
                          <span className="text-[10px] text-green-600 font-normal shrink-0">imported</span>
                        )}
                        {row.importState === 'failed' && row.error && (
                          <span className="text-[10px] text-red-500 font-normal shrink-0 truncate">— {row.error}</span>
                        )}
                      </button>

                      {/* Player count / in-db summary */}
                      <div className="text-xs text-muted-foreground shrink-0 text-right">
                        {row.checking
                          ? <Loader2 className="h-3 w-3 animate-spin inline" />
                          : inDbCount !== null
                            ? <><span className="text-green-600">{inDbCount} ✓</span>{newPlayers! > 0 && <span className="ml-1">{newPlayers} new</span>}</>
                            : `${row.squad.players.length} players`
                        }
                      </div>
                    </div>

                    {/* Expanded player list */}
                    {row.expanded && (
                      <div className="border-t bg-muted/20">
                        {row.checking ? (
                          <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Checking players…
                          </div>
                        ) : (
                          <table className="w-full text-xs">
                            <tbody>
                              {row.squad.players.map((player, pi) => {
                                const checked = row.checkedPlayers?.[pi]
                                return (
                                  <tr key={pi} className="border-b last:border-0 hover:bg-muted/30">
                                    <td className="pl-4 pr-2 py-1 w-6 text-center">
                                      {checked
                                        ? checked.in_db
                                          ? <CheckCircle2 className="h-3 w-3 text-green-500 inline" />
                                          : <Circle className="h-3 w-3 text-gray-300 inline" />
                                        : <Circle className="h-3 w-3 text-gray-200 inline" />
                                      }
                                    </td>
                                    <td className="px-2 py-1 w-8 text-muted-foreground tabular-nums">
                                      {player.shirt_number ?? '—'}
                                    </td>
                                    <td className="px-2 py-1 w-8">
                                      {player.position && (
                                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-gray-100 text-gray-600">
                                          {player.position}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1 font-medium">
                                      {player.wikipedia_url
                                        ? <a href={player.wikipedia_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{player.name}</a>
                                        : player.name
                                      }
                                    </td>
                                    <td className="px-2 py-1 text-muted-foreground truncate max-w-30">
                                      {player.club}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {importError && <p className="text-sm text-destructive">{importError}</p>}

            {importDone ? (
              <p className="text-sm text-green-600 font-medium">✓ Imported successfully</p>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {importing ? 'Importing squads…' : checkedCount > 0 ? `${checkedCount} squad${checkedCount !== 1 ? 's' : ''} will be imported.` : ''}
                </p>
                <Button size="sm" onClick={handleImport} disabled={importing || checkedCount === 0}>
                  {importing
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Importing…</>
                    : `Import ${checkedCount} squad${checkedCount !== 1 ? 's' : ''}`
                  }
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Imported list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Imported ({items.length})
          </p>
          {items.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleRescrapeAll} disabled={rescrapeAllRunning || !!refreshingId}>
              {rescrapeAllRunning
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Rescraping…</>
                : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />{rescrapeAllDone ? 'Done' : 'Rescrape all'}</>
              }
            </Button>
          )}
        </div>

        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">No squads imported yet.</p>}

        {Object.entries(byYear).sort(([a], [b]) => Number(a) - Number(b)).map(([yr, yearSquads]) => (
          <div key={yr} className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">
              {yr} World Cup
            </p>
            {yearSquads.map(item => (
              <div key={item.id} className="flex items-center gap-3 border rounded-lg px-3 py-2.5">
                <span className="flex-1 text-sm font-medium">{item.team}</span>
                <a href={item.wikipedia_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  disabled={refreshingId === item.id || rescrapeAllRunning}
                  onClick={() => handleRefresh(item.id)} title="Rescrape player links"
                >
                  {refreshingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  disabled={deletingId === item.id}
                  onClick={() => handleDelete(item.id, item.team, item.year)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
