import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, Play, Square, Trash2, Users, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getFamiliesSummary,
  clearFamilies,
  FAMILIES_SCAN_URL,
  type FamiliesSummary,
} from '@/api/football-families'

export function FootballFamiliesAdminPage() {
  const [summary, setSummary] = useState<FamiliesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Scan progress
  const [scanning, setScanning] = useState(false)
  const [total, setTotal] = useState(0)
  const [processed, setProcessed] = useState(0)
  const [found, setFound] = useState(0)
  const [failed, setFailed] = useState(0)
  const [current, setCurrent] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const namesRef = useRef<Map<number, string>>(new Map())

  const load = useCallback(() => {
    setLoading(true)
    getFamiliesSummary()
      .then(setSummary)
      .catch(() => setError('Failed to load summary'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => () => esRef.current?.close(), [])

  function startScan() {
    setScanning(true)
    setProcessed(0); setFound(0); setFailed(0); setCurrent(null); setTotal(0)
    const es = new EventSource(FAMILIES_SCAN_URL)
    esRef.current = es
    es.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === 'init') {
        setTotal(d.total)
        namesRef.current = new Map(d.players.map((p: { id: number; name: string }) => [p.id, p.name]))
      } else if (d.type === 'start') {
        setCurrent(namesRef.current.get(d.id) ?? null)
      } else if (d.type === 'done') {
        setProcessed((n) => n + 1)
        setFound((n) => n + (d.relativesFound ?? 0))
      } else if (d.type === 'failed') {
        setProcessed((n) => n + 1)
        setFailed((n) => n + 1)
      } else if (d.type === 'complete') {
        es.close(); esRef.current = null
        setScanning(false); setCurrent(null)
        load()
      }
    }
    es.onerror = () => { es.close(); esRef.current = null; setScanning(false) }
  }

  function stopScan() {
    esRef.current?.close(); esRef.current = null
    setScanning(false); setCurrent(null)
    load()
  }

  async function handleClear() {
    if (!confirm('Clear all detected family links?')) return
    await clearFamilies()
    load()
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-6 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Footballing Families</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan every player's Wikipedia bio for relatives who are footballers.
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
          {!scanning && summary && (summary.inDbCount > 0 || summary.toScrapeCount > 0) && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleClear}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear
            </Button>
          )}
        </div>
      </div>

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
            {current ?? '…'} · {found} relatives found{failed > 0 ? ` · ${failed} failed` : ''}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : summary && (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold mb-2">In the database <span className="text-muted-foreground font-normal">· {summary.inDbCount}</span></h2>
            <p className="text-xs text-muted-foreground mb-3">Related players already in the DB — ready for the game.</p>
            {summary.inDb.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet — run a scan.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden divide-y">
                {summary.inDb.map((p) => (
                  <div key={`${p.aId}-${p.bId}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-medium">{p.aName}</span>
                    <span className="text-muted-foreground text-xs">↔ {p.relationship ?? 'relative'} ↔</span>
                    <span className="font-medium">{p.bName}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-2">Needs scraping <span className="text-muted-foreground font-normal">· {summary.toScrapeCount}</span></h2>
            <p className="text-xs text-muted-foreground mb-3">Footballer relatives not yet in the DB — import them to include in the game.</p>
            {summary.toScrape.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden divide-y">
                {summary.toScrape.map((r) => (
                  <div key={r.relativeUrl} className="px-3 py-2 text-sm">
                    <a href={r.relativeUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
                      {r.relativeName} <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="text-xs text-muted-foreground ml-2">
                      {r.relatedTo.map((x) => `${x.relationship ?? 'relative'} of ${x.name}`).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
