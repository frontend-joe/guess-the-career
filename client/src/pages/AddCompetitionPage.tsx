import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft, Link as LinkIcon, Loader2, CheckCircle2, XCircle, Circle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PositionBadge } from '@/components/PositionBadge'
import {
  scrapeCompetition, checkCompetition, importCompetition,
  type CompetitionScrapeResult, type CheckResult, type ImportSummary,
} from '@/api/competitions'

type Mode = 'single' | 'bulk'
type SingleStep = 'idle' | 'scraped' | 'checking' | 'reviewed' | 'importing' | 'done'

type BulkItem = {
  url: string
  state: 'pending' | 'scraping' | 'saved' | 'failed'
  name?: string
  error?: string
}

function buildFootballerEntries(preview: CompetitionScrapeResult) {
  const all = [
    ...preview.topScorers.map(s => ({ name: s.name, url: s.wikipediaUrl })),
    ...preview.hatTricks.map(h => ({ name: h.name, url: h.wikipediaUrl })),
    ...preview.topAssists.map(a => ({ name: a.name, url: a.wikipediaUrl })),
    ...(preview.playerOfSeason ? [{ name: preview.playerOfSeason.name, url: preview.playerOfSeason.wikipediaUrl }] : []),
    ...preview.pfaTeamOfYear.map(p => ({ name: p.name, url: p.wikipediaUrl ?? '' })),
  ]
  // Deduplicate by url (or name if no url)
  const seen = new Set<string>()
  return all.filter(e => {
    const key = e.url || e.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function AddCompetitionPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('single')

  // Single mode state
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [preview, setPreview] = useState<CompetitionScrapeResult | null>(null)
  const [check, setCheck] = useState<CheckResult | null>(null)
  const [step, setStep] = useState<SingleStep>('idle')
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  // Shared settings
  const [maxTopScorers, setMaxTopScorers] = useState<number | ''>(5)

  // Bulk mode state
  const [bulkText, setBulkText] = useState('')
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([])
  const [bulkRunning, setBulkRunning] = useState(false)

  async function handleScrape() {
    if (!url.trim()) return
    setScraping(true)
    setScrapeError(null)
    setPreview(null)
    setCheck(null)
    setImportSummary(null)
    setStep('idle')
    try {
      const result = await scrapeCompetition(url.trim())
      setPreview(result)
      setStep('scraped')
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'Scrape failed')
    } finally {
      setScraping(false)
    }
  }

  async function handleReview() {
    if (!filteredPreview) return
    setStep('checking')
    try {
      const entries = buildFootballerEntries(filteredPreview)
      const result = await checkCompetition(
        entries,
        filteredPreview.managerOfSeason?.wikipediaUrl,
        filteredPreview.managerOfSeason?.name,
      )
      setCheck(result)
      setStep('reviewed')
    } catch {
      setStep('scraped')
    }
  }

  async function handleImport() {
    if (!filteredPreview) return
    setStep('importing')
    try {
      const result = await importCompetition(url.trim(), filteredPreview)
      setImportSummary(result.importSummary)
      setStep('done')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Import failed')
      setStep('reviewed')
    }
  }

  function handleReset() {
    setUrl('')
    setPreview(null)
    setCheck(null)
    setImportSummary(null)
    setScrapeError(null)
    setStep('idle')
  }

  async function handleBulkImport() {
    const urls = bulkText.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'))
    if (!urls.length) return

    const items: BulkItem[] = urls.map(u => ({ url: u, state: 'pending' }))
    setBulkItems(items)
    setBulkRunning(true)

    for (let i = 0; i < items.length; i++) {
      setBulkItems(prev => prev.map((it, idx) => idx === i ? { ...it, state: 'scraping' } : it))
      try {
        const scraped = await scrapeCompetition(items[i].url)
        await importCompetition(items[i].url, { ...scraped, topScorers: applyMaxRank(scraped.topScorers) })
        setBulkItems(prev => prev.map((it, idx) => idx === i ? { ...it, state: 'saved', name: scraped.name } : it))
      } catch (e) {
        setBulkItems(prev => prev.map((it, idx) => idx === i
          ? { ...it, state: 'failed', error: e instanceof Error ? e.message : 'Failed' }
          : it))
      }
      if (i < items.length - 1) await new Promise(r => setTimeout(r, 600))
    }

    setBulkRunning(false)
  }

  const bulkDone = bulkItems.length > 0 && !bulkRunning
  const bulkSaved = bulkItems.filter(i => i.state === 'saved').length
  const bulkFailed = bulkItems.filter(i => i.state === 'failed').length

  function applyMaxRank<T extends { rank: number }>(items: T[]): T[] {
    return maxTopScorers !== '' ? items.filter(s => s.rank <= maxTopScorers) : items
  }

  const filteredPreview = preview
    ? { ...preview, topScorers: applyMaxRank(preview.topScorers) }
    : null

  const newPlayers = check?.footballers.filter(f => !f.exists) ?? []
  const existingPlayers = check?.footballers.filter(f => f.exists) ?? []

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate('/admin/competitions')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Button>

      <h1 className="text-xl font-semibold mb-4">Add competition</h1>

      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm text-muted-foreground shrink-0">Top scorers limit</label>
        <Input
          type="number"
          min={1}
          value={maxTopScorers}
          onChange={e => setMaxTopScorers(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value)))}
          placeholder="All"
          className="w-24 h-8 text-sm"
        />
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
        <button
          onClick={() => setMode('single')}
          className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${mode === 'single' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Single
        </button>
        <button
          onClick={() => setMode('bulk')}
          className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${mode === 'bulk' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Bulk import
        </button>
      </div>

      {mode === 'single' && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Paste a Wikipedia season page URL to scrape top scorers, hat-tricks, assists, awards, and PFA Team of the Year.
          </p>

          <div className="flex gap-2 mb-2">
            <div className="relative flex-1 min-w-0">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://en.wikipedia.org/wiki/1999–2000_FA_Premier_League"
                className="pl-9"
                onKeyDown={e => e.key === 'Enter' && step === 'idle' && handleScrape()}
                disabled={step === 'done'}
              />
            </div>
            {step === 'idle' || step === 'scraped' ? (
              <Button onClick={handleScrape} disabled={!url.trim() || scraping} className="shrink-0">
                {scraping && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                {scraping ? 'Scraping…' : 'Scrape'}
              </Button>
            ) : null}
          </div>

          {scrapeError && <p className="text-destructive text-sm mb-4">{scrapeError}</p>}

          {/* Step 1: Scraped preview */}
          {filteredPreview && (step === 'scraped' || step === 'checking') && (
            <div className="mt-6 space-y-5">
              {(filteredPreview.playerOfSeason || filteredPreview.managerOfSeason) && (
                <section className="border rounded-lg p-4">
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Awards</h2>
                  <div className="flex flex-wrap gap-6 text-sm">
                    {filteredPreview.playerOfSeason && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-0.5">Player of the Season</span>
                        <span className="font-medium">{filteredPreview.playerOfSeason.name}</span>
                      </div>
                    )}
                    {filteredPreview.managerOfSeason && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-0.5">Manager of the Season</span>
                        <span className="font-medium">{filteredPreview.managerOfSeason.name}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {filteredPreview.topScorers.length > 0 && (
                <section className="border rounded-lg p-4">
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Top Scorers ({filteredPreview.topScorers.length}{preview && preview.topScorers.length !== filteredPreview.topScorers.length ? ` of ${preview.topScorers.length}` : ''})
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left pb-2 w-8">#</th>
                        <th className="text-left pb-2">Player</th>
                        <th className="text-left pb-2 hidden sm:table-cell">Club</th>
                        <th className="text-right pb-2">Goals</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredPreview.topScorers.map((s, i) => (
                        <tr key={i}>
                          <td className="py-1.5 text-muted-foreground">{s.rank}</td>
                          <td className="py-1.5 font-medium">{s.name}</td>
                          <td className="py-1.5 text-muted-foreground hidden sm:table-cell">{s.club}</td>
                          <td className="py-1.5 text-right font-mono">{s.goals}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {filteredPreview.hatTricks.length > 0 && (
                <section className="border rounded-lg p-4">
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Hat-tricks ({filteredPreview.hatTricks.length})
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left pb-2">Player</th>
                        <th className="text-left pb-2">For</th>
                        <th className="text-left pb-2">Against</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredPreview.hatTricks.map((h, i) => (
                        <tr key={i}>
                          <td className="py-1.5 font-medium">{h.name}</td>
                          <td className="py-1.5 text-muted-foreground">{h.forClub}</td>
                          <td className="py-1.5 text-muted-foreground">{h.againstClub}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {filteredPreview.topAssists.length > 0 && (
                <section className="border rounded-lg p-4">
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Top Assists ({filteredPreview.topAssists.length})
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left pb-2 w-8">#</th>
                        <th className="text-left pb-2">Player</th>
                        <th className="text-left pb-2 hidden sm:table-cell">Club</th>
                        <th className="text-right pb-2">Assists</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredPreview.topAssists.map((a, i) => (
                        <tr key={i}>
                          <td className="py-1.5 text-muted-foreground">{a.rank}</td>
                          <td className="py-1.5 font-medium">{a.name}</td>
                          <td className="py-1.5 text-muted-foreground hidden sm:table-cell">{a.club}</td>
                          <td className="py-1.5 text-right font-mono">{a.assists}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {filteredPreview.pfaTeamOfYear.length > 0 && (
                <section className="border rounded-lg p-4">
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    PFA Team of the Year ({filteredPreview.pfaTeamOfYear.length} players)
                  </h2>
                  <div className="space-y-1">
                    {filteredPreview.pfaTeamOfYear.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                        <span className="text-xs text-muted-foreground w-4 text-right">{p.squadNumber}</span>
                        <PositionBadge position={p.position} className="text-xs font-medium px-1.5" />
                        <span className="font-medium">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleReset}>Clear</Button>
                <Button onClick={handleReview} disabled={step === 'checking'}>
                  {step === 'checking' && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  {step === 'checking' ? 'Checking…' : 'Review import'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Pre-import summary */}
          {check && step === 'reviewed' && (
            <div className="mt-6 space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
                <h2 className="text-sm font-semibold">Import summary</h2>

                {newPlayers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-700 mb-1.5">
                      {newPlayers.length} new player{newPlayers.length !== 1 ? 's' : ''} will be added
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {newPlayers.map((p, i) => (
                        <span key={i} className="text-xs bg-green-50 text-green-800 border border-green-200 rounded px-2 py-0.5">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {existingPlayers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      {existingPlayers.length} already in database
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {existingPlayers.map((p, i) => (
                        <span key={i} className="text-xs bg-muted text-muted-foreground rounded px-2 py-0.5">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {check.managerExists !== null && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Manager of the Season:{' '}
                      <span className={check.managerExists ? 'text-muted-foreground' : 'text-green-700'}>
                        {check.managerExists
                          ? `${preview?.managerOfSeason?.name} already in database`
                          : `${preview?.managerOfSeason?.name} will be added`}
                      </span>
                    </p>
                  </div>
                )}

                {preview?.pfaTeamOfYear.length === 11 && (
                  <div>
                    <p className="text-xs font-medium text-green-700 mb-1.5">
                      Elevens — PFA Team of the Year will be added
                    </p>
                    <div className="space-y-0.5">
                      {preview?.pfaTeamOfYear.map((p, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <PositionBadge position={p.position} className="text-xs font-medium" />
                          <span className="text-muted-foreground">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('scraped')}>Back</Button>
                <Button onClick={handleImport}>
                  Confirm import
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Importing spinner */}
          {step === 'importing' && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing — this may take a moment while new players are scraped…
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && importSummary && (
            <div className="mt-6 border rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-semibold text-green-700">Imported successfully</h2>
              <p className="text-sm text-muted-foreground font-medium">{preview?.name}</p>

              {importSummary.footballers.added.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium text-green-700">{importSummary.footballers.added.length} new player{importSummary.footballers.added.length !== 1 ? 's' : ''} added: </span>
                  <span className="text-muted-foreground">{importSummary.footballers.added.join(', ')}</span>
                </div>
              )}
              {importSummary.footballers.alreadyExisted.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {importSummary.footballers.alreadyExisted.length} player{importSummary.footballers.alreadyExisted.length !== 1 ? 's' : ''} already existed
                </p>
              )}
              {importSummary.footballers.failed.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium text-destructive">{importSummary.footballers.failed.length} failed: </span>
                  <span className="text-destructive">{importSummary.footballers.failed.join(', ')}</span>
                </div>
              )}
              {importSummary.manager === 'added' && (
                <p className="text-sm text-green-700 font-medium">Manager added to database</p>
              )}
              {preview?.pfaTeamOfYear.length === 11 && (
                <p className="text-sm text-muted-foreground">PFA Team of the Year added to Elevens.</p>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={handleReset}>Add another</Button>
                <Button size="sm" onClick={() => navigate('/admin/competitions')}>View competitions</Button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'bulk' && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Paste one Wikipedia season URL per line. Each competition will be scraped and imported automatically.
          </p>

          {bulkItems.length === 0 ? (
            <>
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={'https://en.wikipedia.org/wiki/1999–2000_FA_Premier_League\nhttps://en.wikipedia.org/wiki/2000–01_FA_Premier_League\n…'}
                className="w-full h-64 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-3 flex justify-end">
                <Button onClick={handleBulkImport} disabled={!bulkText.trim()}>Import all</Button>
              </div>
            </>
          ) : (
            <>
              {bulkDone && (
                <div className="mb-4 text-sm text-muted-foreground">
                  Done — {bulkSaved} saved{bulkFailed > 0 ? `, ${bulkFailed} failed` : ''}.
                </div>
              )}
              <div className="border rounded-lg divide-y overflow-hidden">
                {bulkItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="shrink-0">
                      {item.state === 'pending'  && <Circle       className="h-4 w-4 text-muted-foreground/40" />}
                      {item.state === 'scraping' && <Loader2      className="h-4 w-4 text-blue-500 animate-spin" />}
                      {item.state === 'saved'    && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {item.state === 'failed'   && <XCircle      className="h-4 w-4 text-destructive" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">
                        {item.name ?? item.url.split('/wiki/')[1]?.replace(/_/g, ' ') ?? item.url}
                      </p>
                      {item.error && <p className="text-xs text-destructive mt-0.5">{item.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {bulkDone && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setBulkItems([]); setBulkText('') }}>Import more</Button>
                  <Button onClick={() => navigate('/admin/competitions')}>Done</Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
