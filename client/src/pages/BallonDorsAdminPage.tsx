import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Trash2, ExternalLink, Calendar, CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getBallonDors,
  scrapeBallonDor,
  checkBallonDorPlayers,
  importBallonDor,
  deleteBallonDor,
  type BallonDorListItem,
  type BallonDorScrapedPlayer,
} from '@/api/ballon-dor-schedule'
import { scrapeWikipedia, createFromScrape, ApiError } from '@/api/footballers'

interface CheckedPlayer extends BallonDorScrapedPlayer {
  in_db: boolean
  footballer_id: number | null
  // set during import
  import_state?: 'pending' | 'scraping' | 'saved' | 'skipped' | 'failed'
  import_error?: string
}

export function BallonDorsAdminPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<BallonDorListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)

  // After scrape + check
  const [year, setYear] = useState<number | null>(null)
  const [players, setPlayers] = useState<CheckedPlayer[]>([])
  const [checking, setChecking] = useState(false)

  // Import state
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importDone, setImportDone] = useState(false)

  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      setItems(await getBallonDors())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function resetPreview() {
    setYear(null)
    setPlayers([])
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
      const result = await scrapeBallonDor(url.trim())
      setYear(result.year)

      // Check DB for each player
      setChecking(true)
      const checked = await checkBallonDorPlayers(result.players.map(p => ({ name: p.name })))
      const merged: CheckedPlayer[] = result.players.map((p, i) => ({
        ...p,
        in_db: checked[i].in_db,
        footballer_id: checked[i].footballer_id,
        import_state: 'pending',
      }))
      setPlayers(merged)
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'Scrape failed')
    } finally {
      setScraping(false)
      setChecking(false)
    }
  }

  async function handleImport() {
    if (!year || players.length === 0) return
    setImporting(true)
    setImportError(null)

    const updatedPlayers = [...players]

    // Step 1: scrape + add missing players
    const missingIndices = updatedPlayers
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => !p.in_db)

    for (const { p, i } of missingIndices) {
      if (!p.wikipedia_url) {
        updatedPlayers[i] = { ...updatedPlayers[i], import_state: 'failed', import_error: 'No Wikipedia URL' }
        setPlayers([...updatedPlayers])
        continue
      }

      updatedPlayers[i] = { ...updatedPlayers[i], import_state: 'scraping' }
      setPlayers([...updatedPlayers])

      try {
        const scraped = await scrapeWikipedia(p.wikipedia_url)
        const footballer = await createFromScrape({
          ...scraped,
          stints: scraped.stints.map((s, si) => ({ ...s, sort_order: si })),
        })
        updatedPlayers[i] = {
          ...updatedPlayers[i],
          import_state: 'saved',
          in_db: true,
          footballer_id: footballer.id,
        }
      } catch (e) {
        const isAlreadyExists = e instanceof ApiError && e.code === 'already_exists'
        updatedPlayers[i] = {
          ...updatedPlayers[i],
          import_state: isAlreadyExists ? 'skipped' : 'failed',
          import_error: isAlreadyExists ? undefined : (e instanceof Error ? e.message : 'Scrape failed'),
        }
      }
      setPlayers([...updatedPlayers])

      // Small delay between Wikipedia requests
      await new Promise(r => setTimeout(r, 400))
    }

    // Step 2: import the Ballon d'Or entry
    try {
      await importBallonDor({
        year,
        wikipedia_url: url.trim(),
        players: updatedPlayers.map(p => ({
          rank: p.rank,
          name: p.name,
          nationality: p.nationality,
          club: p.club,
          points: p.points,
          wikipedia_url: p.wikipedia_url ?? null,
        })),
      })
      setImportDone(true)
      await load()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(id: number, yr: number) {
    if (!confirm(`Delete ${yr} Ballon d'Or and all its players?`)) return
    setDeletingId(id)
    try {
      await deleteBallonDor(id)
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  const inDbCount = players.filter(p => p.in_db).length
  const newCount = players.length - inDbCount
  const noWikiCount = players.filter(p => !p.in_db && !p.wikipedia_url).length

  function playerStateIcon(p: CheckedPlayer) {
    if (!importing && !importDone) {
      return p.in_db
        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
        : <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
    }
    switch (p.import_state) {
      case 'scraping': return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />
      case 'saved':    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
      case 'skipped':  return <CheckCircle2 className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
      case 'failed':   return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
      default:         return p.in_db
        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
        : <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Ballon d&apos;Or</h1>
        <Button variant="outline" size="sm" onClick={() => navigate('/ballon-dors/schedule')}>
          <Calendar className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

      {/* Scrape panel */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Import from Wikipedia</p>
        <p className="text-xs text-muted-foreground">
          e.g. <code className="bg-muted px-1 rounded">https://en.wikipedia.org/wiki/1994_Ballon_d%27Or</code>
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
            {scraping || checking ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Checking…</> : 'Scrape'}
          </Button>
        </div>

        {scrapeError && <p className="text-sm text-destructive">{scrapeError}</p>}

        {/* Preview */}
        {players.length > 0 && year && (
          <div className="space-y-3 pt-1">
            {/* Summary bar */}
            <div className="flex items-center gap-4 text-sm">
              <span className="font-semibold">{year} Ballon d&apos;Or — {players.length} players</span>
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {inDbCount} in DB
              </span>
              {newCount > 0 && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Circle className="h-3.5 w-3.5" /> {newCount} new
                  {noWikiCount > 0 && <span className="text-red-500 ml-1">({noWikiCount} no wiki URL)</span>}
                </span>
              )}
            </div>

            {/* Player list */}
            <div className="border rounded-md overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium w-6"></th>
                    <th className="text-left px-3 py-1.5 font-medium w-8">#</th>
                    <th className="text-left px-3 py-1.5 font-medium">Player</th>
                    <th className="text-left px-3 py-1.5 font-medium">Club</th>
                    <th className="text-right px-3 py-1.5 font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={i} className={`border-t ${!p.in_db && !p.wikipedia_url ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-1">{playerStateIcon(p)}</td>
                      <td className="px-3 py-1 tabular-nums text-muted-foreground">{p.rank}</td>
                      <td className="px-3 py-1 font-medium">
                        {p.wikipedia_url
                          ? <a href={p.wikipedia_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.name}</a>
                          : p.name
                        }
                        {p.import_error && <span className="ml-1 text-red-500">— {p.import_error}</span>}
                      </td>
                      <td className="px-3 py-1 text-muted-foreground">{p.club}</td>
                      <td className="px-3 py-1 tabular-nums text-right">{p.points ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importError && <p className="text-sm text-destructive">{importError}</p>}

            {importDone ? (
              <p className="text-sm text-green-600 font-medium">✓ Imported successfully</p>
            ) : (
              <div className="flex items-center justify-between">
                {newCount > 0 && !importing && (
                  <p className="text-xs text-muted-foreground">
                    {newCount} player{newCount !== 1 ? 's' : ''} will be scraped from Wikipedia and added to the database.
                  </p>
                )}
                {importing && (
                  <p className="text-xs text-muted-foreground">
                    Scraping missing players…
                  </p>
                )}
                <div className="ml-auto">
                  <Button size="sm" onClick={handleImport} disabled={importing}>
                    {importing
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Importing…</>
                      : `Import ${year}`
                    }
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Imported list */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Imported ({items.length})
        </p>
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No years imported yet.</p>
        )}
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 border rounded-lg px-3 py-2.5">
            <span className="flex-1 text-sm font-semibold">{item.year} Ballon d&apos;Or</span>
            <a
              href={item.wikipedia_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              disabled={deletingId === item.id}
              onClick={() => handleDelete(item.id, item.year)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
