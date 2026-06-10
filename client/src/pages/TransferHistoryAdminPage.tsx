import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import {
  Trash2, ExternalLink, Calendar, CheckCircle2, Loader2, Circle, Power, RefreshCw, ChevronDown, Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NationalityFlag } from '@/components/NationalityFlag'
import { PositionBadge } from '@/components/PositionBadge'
import { ClubPicker } from '@/components/ClubPicker'
import { FootballerPicker } from '@/components/FootballerPicker'
import {
  scrapeTransferWindow,
  importTransferWindow,
  getTransferWindows,
  deleteTransferWindow,
  updateTransferWindow,
  relinkTransferWindow,
  resolvePlayer,
  type CheckedTransfer,
  type TransferWindowListItem,
} from '@/api/transfer-history-admin'

const EXAMPLE_URL = 'https://www.transfermarkt.com/laliga/transfers/wettbewerb/ES1/saison_id/1997'

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

export function TransferHistoryAdminPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<TransferWindowListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)

  const [meta, setMeta] = useState<{ league: string; league_code: string; season_id: number; season_label: string; source_url: string } | null>(null)
  const [transfers, setTransfers] = useState<CheckedTransfer[]>([])
  // Indices the admin has selected as "major" (included in the game).
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<{ added: number; alreadyExisted: number; failed: string[] } | null>(null)

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [relinkingId, setRelinkingId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      setItems(await getTransferWindows())
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  function resetPreview() {
    setMeta(null)
    setTransfers([])
    setSelected(new Set())
    setScrapeError(null)
    setImportError(null)
    setImportSummary(null)
  }

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
    setTransfers(prev => prev.map((t, idx) =>
      idx === i ? { ...t, footballer_id: id, player_name: name, in_db: true } : t,
    ))
  }

  // Manually link an unmatched club to a chosen DB club for one transfer; the
  // import sends this name, which the server resolves to the DB club + badge.
  function setClub(i: number, side: 'from' | 'to', name: string) {
    setTransfers(prev => prev.map((t, idx) =>
      idx === i
        ? side === 'from'
          ? { ...t, from_club: name, from_club_matched: true }
          : { ...t, to_club: name, to_club_matched: true }
        : t,
    ))
  }

  async function handleScrape() {
    if (!url.trim()) return
    setScraping(true)
    resetPreview()
    try {
      const result = await scrapeTransferWindow(url.trim())
      setMeta({
        league: result.league,
        league_code: result.league_code,
        season_id: result.season_id,
        season_label: result.season_label,
        source_url: result.source_url,
      })
      setTransfers(result.transfers)
      // All transfers start unchecked — the admin picks the major ones.
      setSelected(new Set())
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
      const chosen = transfers.filter((_, i) => selected.has(i))
      const result = await importTransferWindow({
        ...meta,
        transfers: chosen.map(t => ({
          player_name: t.player_name,
          nationality: t.nationality,
          position: t.position,
          from_club: t.from_club,
          to_club: t.to_club,
          fee_text: t.fee_text,
          fee_value: t.fee_value,
          footballer_id: t.footballer_id,
        })),
      })
      setImportSummary({
        added: result.importSummary.added.length,
        alreadyExisted: result.importSummary.alreadyExisted.length,
        failed: result.importSummary.failed,
      })
      await load()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(id: number, label: string) {
    if (!confirm(`Delete ${label} and all its transfers?`)) return
    setDeletingId(id)
    try {
      await deleteTransferWindow(id)
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleActive(item: TransferWindowListItem) {
    await updateTransferWindow(item.id, { active: !item.active })
    await load()
  }

  async function handleRelink(id: number) {
    setRelinkingId(id)
    try {
      await relinkTransferWindow(id)
      await load()
    } finally {
      setRelinkingId(null)
    }
  }

  const selectedCount = selected.size
  const newSelected = transfers.filter((t, i) => selected.has(i) && !t.in_db).length

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Transfer History</h1>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/transfer-history/schedule')}>
          <Calendar className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

      {/* Scrape panel */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Import a season from Transfermarkt</p>
        <p className="text-xs text-muted-foreground">
          e.g. <code className="bg-muted px-1 rounded">{EXAMPLE_URL}</code>
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="Transfermarkt transfers URL…"
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

        {meta && transfers.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="font-semibold">
                {meta.league} {meta.season_label} — {transfers.length} transfers
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
                    <th className="text-left px-2 py-1.5 font-medium">From → To</th>
                    <th className="text-right px-2 py-1.5 font-medium">Fee</th>
                    <th className="px-2 py-1.5 font-medium w-10">DB</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t, i) => {
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
                                scrape={(query) => resolvePlayer(query, t.to_club)}
                                initialQuery={t.player_name}
                                title="Link to an existing player, or scrape the correct name from Wikipedia"
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
                          <ClubLabel name={t.from_club} matched={t.from_club_matched} onPick={(n) => setClub(i, 'from', n)} />
                          <span className="text-gray-400 mx-1">→</span>
                          <ClubLabel name={t.to_club} matched={t.to_club_matched} onPick={(n) => setClub(i, 'to', n)} />
                        </td>
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
            {importSummary && (
              <p className="text-sm text-green-600 font-medium">
                ✓ Imported — {importSummary.added} new players, {importSummary.alreadyExisted} existing
                {importSummary.failed.length > 0 && (
                  <span className="text-red-500 font-normal"> · {importSummary.failed.length} could not be matched: {importSummary.failed.join(', ')}</span>
                )}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {newSelected > 0
                  ? `${newSelected} player${newSelected !== 1 ? 's' : ''} not in the DB will be scraped from Wikipedia and added.`
                  : ''}
              </p>
              <Button size="sm" onClick={handleImport} disabled={importing || selectedCount === 0}>
                {importing
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Importing…</>
                  : `Import ${selectedCount} transfer${selectedCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Imported windows */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Imported ({items.length})
        </p>
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No seasons imported yet.</p>
        )}
        {items.map(item => (
          <div key={item.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 ${item.active ? '' : 'opacity-60'}`}>
            <button
              onClick={() => navigate(`/admin/transfer-history/${item.id}`)}
              className="flex-1 min-w-0 text-left group"
              title="View transfers as they appear in the game"
            >
              <p className="text-sm font-semibold truncate group-hover:underline">{item.league} {item.season_label}</p>
              <p className="text-xs text-muted-foreground">{item.player_count} transfers</p>
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
              onClick={() => handleDelete(item.id, `${item.league} ${item.season_label}`)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
