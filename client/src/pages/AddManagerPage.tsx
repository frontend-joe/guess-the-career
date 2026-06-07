import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Link as LinkIcon, Loader2, CheckCircle2, XCircle, Circle, MinusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CareerTable } from '@/components/CareerTable'
import { scrapeManagerWikipedia, createManagerFromScrape, ApiError, type ScrapeManagerResult } from '@/api/managers'

type EditableStint = Omit<ScrapeManagerResult['stints'][number], never>
type Mode = 'single' | 'bulk'

type BulkItem = {
  url: string
  state: 'pending' | 'scraping' | 'saved' | 'skipped' | 'failed'
  name?: string
  error?: string
}

export function AddManagerPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('single')

  // Single mode
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ScrapeManagerResult | null>(null)
  const [stints, setStints] = useState<EditableStint[]>([])
  const [saving, setSaving] = useState(false)

  // Bulk mode
  const [bulkText, setBulkText] = useState('')
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([])
  const [bulkRunning, setBulkRunning] = useState(false)

  async function handleScrape() {
    if (!url.trim()) return
    setScraping(true)
    setScrapeError(null)
    setPreview(null)
    try {
      const result = await scrapeManagerWikipedia(url.trim())
      setPreview(result)
      setStints(result.stints)
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'Scrape failed')
    } finally {
      setScraping(false)
    }
  }

  async function handleSave() {
    if (!preview) return
    setSaving(true)
    try {
      const manager = await createManagerFromScrape({
        ...preview,
        stints: stints.map((s, i) => ({ ...s, sort_order: i })),
      })
      navigate(`/admin/managers/${manager.id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function updateField(field: keyof Omit<ScrapeManagerResult, 'stints' | 'wikipedia_url'>, value: string) {
    if (!preview) return
    setPreview({ ...preview, [field]: value || null })
  }

  async function handleBulkImport() {
    const urls = bulkText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('http'))

    if (!urls.length) return

    const items: BulkItem[] = urls.map(u => ({ url: u, state: 'pending' }))
    setBulkItems(items)
    setBulkRunning(true)

    for (let i = 0; i < items.length; i++) {
      setBulkItems(prev => prev.map((it, idx) => idx === i ? { ...it, state: 'scraping' } : it))
      try {
        const result = await scrapeManagerWikipedia(items[i].url)
        await createManagerFromScrape({ ...result, stints: result.stints.map((s, si) => ({ ...s, sort_order: si })) })
        setBulkItems(prev => prev.map((it, idx) => idx === i ? { ...it, state: 'saved', name: result.name } : it))
      } catch (e) {
        const isAlreadyExists = e instanceof ApiError && e.code === 'already_exists'
        const error = e instanceof Error ? e.message : 'Failed'
        setBulkItems(prev => prev.map((it, idx) => idx === i
          ? { ...it, state: isAlreadyExists ? 'skipped' : 'failed', name: isAlreadyExists ? error.replace(' is already in the database', '') : undefined, error: isAlreadyExists ? undefined : error }
          : it))
      }
      if (i < items.length - 1) await new Promise(r => setTimeout(r, 400))
    }

    setBulkRunning(false)
  }

  const bulkDone = bulkItems.length > 0 && !bulkRunning
  const bulkSaved = bulkItems.filter(i => i.state === 'saved').length
  const bulkSkipped = bulkItems.filter(i => i.state === 'skipped').length
  const bulkFailed = bulkItems.filter(i => i.state === 'failed').length

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate('/admin/managers')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Button>

      <h1 className="text-xl font-semibold mb-4">Add manager</h1>

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
          <p className="text-sm text-muted-foreground mb-4">Paste a Wikipedia URL to scrape and review managerial career data.</p>
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1 min-w-0">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://en.wikipedia.org/wiki/…"
                className="pl-9"
                onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              />
            </div>
            <Button onClick={handleScrape} disabled={!url.trim() || scraping} className="shrink-0">
              {scraping ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {scraping ? 'Scraping…' : 'Scrape'}
            </Button>
          </div>

          {scrapeError && <p className="text-destructive text-sm mb-4">{scrapeError}</p>}

          {preview && (
            <div className="mt-6 space-y-6">
              <div className="border rounded-lg p-4 space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Manager details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Name</label>
                    <Input value={preview.name} onChange={(e) => updateField('name', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Place of birth</label>
                    <Input value={preview.place_of_birth ?? ''} onChange={(e) => updateField('place_of_birth', e.target.value)} placeholder="e.g. Manchester, England" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Born</label>
                    <Input value={preview.born ?? ''} onChange={(e) => updateField('born', e.target.value)} placeholder="e.g. 1971-09-02" />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Managerial career ({stints.length} stint{stints.length !== 1 ? 's' : ''})
                </h2>
                <CareerTable stints={stints} editable onChange={s => setStints(s as EditableStint[])} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setPreview(null); setStints([]) }}>Clear</Button>
                <Button onClick={handleSave} disabled={saving || !preview.name}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  {saving ? 'Saving…' : 'Save manager'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'bulk' && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Paste one Wikipedia URL per line. Each manager will be scraped and saved automatically.
          </p>

          {bulkItems.length === 0 ? (
            <>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'https://en.wikipedia.org/wiki/Pep_Guardiola\nhttps://en.wikipedia.org/wiki/José_Mourinho\n…'}
                className="w-full h-64 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-3 flex justify-end">
                <Button onClick={handleBulkImport} disabled={!bulkText.trim()}>
                  Import all
                </Button>
              </div>
            </>
          ) : (
            <>
              {bulkDone && (
                <div className="mb-4 text-sm text-muted-foreground">
                  Done — {bulkSaved} saved{bulkSkipped > 0 ? `, ${bulkSkipped} already existed` : ''}{bulkFailed > 0 ? `, ${bulkFailed} failed` : ''}.
                </div>
              )}
              <div className="border rounded-lg divide-y overflow-hidden">
                {bulkItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="shrink-0">
                      {item.state === 'pending'  && <Circle       className="h-4 w-4 text-muted-foreground/40" />}
                      {item.state === 'scraping' && <Loader2      className="h-4 w-4 text-blue-500 animate-spin" />}
                      {item.state === 'saved'    && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {item.state === 'skipped'  && <MinusCircle  className="h-4 w-4 text-amber-500" />}
                      {item.state === 'failed'   && <XCircle      className="h-4 w-4 text-destructive" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate flex items-center gap-2">
                        {item.name ?? item.url.split('/wiki/')[1]?.replace(/_/g, ' ') ?? item.url}
                        {item.state === 'skipped' && (
                          <span className="text-xs text-amber-600 font-medium shrink-0">already exists</span>
                        )}
                      </p>
                      {item.error && <p className="text-xs text-destructive mt-0.5">{item.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {bulkDone && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setBulkItems([]); setBulkText('') }}>
                    Import more
                  </Button>
                  <Button onClick={() => navigate('/admin/managers')}>
                    Done
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
