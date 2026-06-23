import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, Play, Square, Trash2, Users, ExternalLink, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getFamiliesSummary,
  clearFamilies,
  getFamilyPlayers,
  scanFamilyBatch,
  setFamilyIncluded,
  scrapeRelative,
  addManualFamily,
  type FamilyLink,
} from '@/api/football-families'

const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Relative')

function RelationshipRow({ row, onToggle }: { row: FamilyLink; onToggle: (row: FamilyLink, v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
      <input
        type="checkbox"
        checked={row.included}
        onChange={(e) => onToggle(row, e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-primary shrink-0"
      />
      <span className="font-medium">{row.footballerName}</span>
      <span className="text-muted-foreground">|</span>
      <span className="font-medium">{row.relativeName}</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-xs text-muted-foreground">{cap(row.relationship)}</span>
      {!row.inDb && <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-amber-600">needs scraping</span>}
    </label>
  )
}

export function FootballFamiliesAdminPage() {
  const [rows, setRows] = useState<FamilyLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [scanning, setScanning] = useState(false)
  const [total, setTotal] = useState(0)
  const [processed, setProcessed] = useState(0)
  const [failed, setFailed] = useState(0)
  const [current, setCurrent] = useState<string | null>(null)
  const stopRef = useRef(false)
  const seenRef = useRef<Set<string>>(new Set())

  const load = useCallback(() => {
    setLoading(true)
    getFamiliesSummary()
      .then((s) => setRows(s.links))
      .catch(() => setError('Failed to load summary'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => () => { stopRef.current = true }, [])

  // Client-driven batch scan; relationships are appended live as they're found.
  async function startScan() {
    setScanning(true)
    setProcessed(0); setFailed(0); setCurrent(null); setTotal(0)
    setRows([])
    seenRef.current = new Set()
    stopRef.current = false
    try {
      const players = await getFamilyPlayers()
      setTotal(players.length)
      const BATCH = 4
      for (let i = 0; i < players.length; i += BATCH) {
        if (stopRef.current) break
        const batch = players.slice(i, i + BATCH)
        setCurrent(batch[0]?.name ?? null)
        try {
          const results = await scanFamilyBatch(batch.map((p) => p.id))
          const newRows: FamilyLink[] = []
          let fl = 0
          for (const r of results) {
            if (r.error) { fl++; continue }
            for (const rel of r.relatives ?? []) {
              const key = rel.relativeFootballerId != null
                ? [Math.min(r.id, rel.relativeFootballerId), Math.max(r.id, rel.relativeFootballerId)].join('-')
                : `${r.id}|${rel.relativeName}`
              if (seenRef.current.has(key)) continue
              seenRef.current.add(key)
              newRows.push({
                id: rel.linkId,
                footballerName: r.name,
                relativeName: rel.relativeName,
                relativeUrl: rel.relativeUrl,
                relationship: rel.relationship,
                inDb: rel.relativeFootballerId != null,
                included: rel.included,
              })
            }
          }
          if (newRows.length) setRows((prev) => [...prev, ...newRows])
          if (fl) setFailed((n) => n + fl)
        } catch {
          setFailed((n) => n + batch.length)
        }
        setProcessed((n) => n + batch.length)
      }
    } catch {
      setError('Scan failed to start')
    } finally {
      setScanning(false); setCurrent(null)
      if (!stopRef.current) load() // reload canonical, deduped persisted list
    }
  }

  function stopScan() {
    stopRef.current = true
    setScanning(false); setCurrent(null)
  }

  async function toggle(row: FamilyLink, included: boolean) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, included } : r)))
    try {
      await setFamilyIncluded(row.id, included)
    } catch {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, included: !included } : r)))
    }
  }

  async function handleClear() {
    if (!confirm('Clear all detected family links?')) return
    await clearFamilies()
    setRows([])
  }

  const [confirming, setConfirming] = useState(false)
  const [confirmDone, setConfirmDone] = useState(0)
  const [confirmTotal, setConfirmTotal] = useState(0)

  // Scrape the checked relatives that aren't in the DB yet, then refresh.
  async function confirmMissing() {
    const urls = [...new Set(rows.filter((r) => r.included && !r.inDb).map((r) => r.relativeUrl))]
    if (urls.length === 0) return
    setConfirming(true); setConfirmDone(0); setConfirmTotal(urls.length)
    for (const url of urls) {
      try { await scrapeRelative(url) } catch { /* keep going */ }
      setConfirmDone((n) => n + 1)
    }
    setConfirming(false)
    load()
  }

  const [mA, setMA] = useState('')
  const [mB, setMB] = useState('')
  const [mRel, setMRel] = useState('')
  const [mMsg, setMMsg] = useState<string | null>(null)

  async function addManual(e: React.FormEvent) {
    e.preventDefault()
    if (!mA.trim() || !mB.trim() || !mRel.trim()) return
    const res = await addManualFamily(mA.trim(), mB.trim(), mRel.trim())
    if (res.ok) {
      setMMsg(null); setMA(''); setMB(''); setMRel('')
      load()
    } else {
      setMMsg(res.unresolved?.length ? `Not found: ${res.unresolved.join(', ')}` : (res.error ?? 'Failed'))
    }
  }

  const includedCount = rows.filter((r) => r.included).length
  const missingChecked = rows.filter((r) => r.included && !r.inDb).length

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-6 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Footballing Families</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan players' Wikipedia bios for footballer relatives, then tick the valid ones to use in the game.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {scanning ? (
            <Button variant="outline" size="sm" onClick={stopScan}>
              <Square className="h-3.5 w-3.5 mr-1.5" /> Stop
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={startScan}>
              <Play className="h-3.5 w-3.5 mr-1.5" /> Run scan
            </Button>
          )}
          {!scanning && missingChecked > 0 && (
            <Button size="sm" onClick={confirmMissing} disabled={confirming}>
              {confirming
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Scraping {confirmDone}/{confirmTotal}</>
                : <><Check className="h-3.5 w-3.5 mr-1.5" /> Confirm &amp; scrape {missingChecked}</>}
            </Button>
          )}
          {!scanning && !confirming && rows.length > 0 && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleClear}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={addManual} className="mb-6 flex flex-wrap items-center gap-2">
        <input value={mA} onChange={(e) => setMA(e.target.value)} placeholder="Player" className="text-sm border border-input rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring w-40" />
        <input value={mB} onChange={(e) => setMB(e.target.value)} placeholder="Relative" className="text-sm border border-input rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring w-40" />
        <input value={mRel} onChange={(e) => setMRel(e.target.value)} placeholder="Relationship (e.g. uncle)" className="text-sm border border-input rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring w-44" />
        <Button type="submit" size="sm" variant="outline">Add manually</Button>
        {mMsg && <span className="text-xs text-destructive">{mMsg}</span>}
      </form>

      {scanning && (
        <div className="mb-6 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Scanning…</span>
            <span className="tabular-nums text-muted-foreground">{processed} / {total || '…'}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
            <div className="h-full bg-primary transition-all" style={{ width: total ? `${(processed / total) * 100}%` : '0%' }} />
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {current ?? '…'} · {rows.length} found{failed > 0 ? ` · ${failed} failed` : ''}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">
          Relationships <span className="text-muted-foreground font-normal">· {rows.length} found · {includedCount} selected</span>
        </h2>
        {rows.length > 0 && (
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: document.body.scrollHeight }) }} className="text-xs text-muted-foreground hover:underline">
            jump to end
          </a>
        )}
      </div>

      {loading && !scanning ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">No relationships yet — run a scan.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {rows.map((r) => (
            <RelationshipRow key={r.id} row={r} onToggle={toggle} />
          ))}
        </div>
      )}

      {rows.some((r) => !r.inDb) && (
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> "needs scraping" relatives aren't in the DB yet — import them to use that pair in the game.
        </p>
      )}
    </div>
  )
}
