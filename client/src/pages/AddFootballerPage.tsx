import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Link as LinkIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CareerTable } from '@/components/CareerTable'
import { scrapeWikipedia, createFromScrape, type ScrapeResult } from '@/api/footballers'

type EditableStint = Omit<ScrapeResult['stints'][number], never>

export function AddFootballerPage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ScrapeResult | null>(null)
  const [stints, setStints] = useState<EditableStint[]>([])
  const [saving, setSaving] = useState(false)

  async function handleScrape() {
    if (!url.trim()) return
    setScraping(true)
    setScrapeError(null)
    setPreview(null)
    try {
      const result = await scrapeWikipedia(url.trim())
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
      const footballer = await createFromScrape({
        ...preview,
        stints: stints.map((s, i) => ({ ...s, sort_order: i })),
      })
      navigate(`/footballers/${footballer.id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function updateField(field: keyof Omit<ScrapeResult, 'stints' | 'wikipedia_url'>, value: string) {
    if (!preview) return
    setPreview({ ...preview, [field]: value || null })
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate('/footballers')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Button>

      <h1 className="text-xl font-semibold mb-1">Add footballer</h1>
      <p className="text-sm text-muted-foreground mb-6">Paste a Wikipedia URL to scrape career data.</p>

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
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Footballer details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Name</label>
                <Input value={preview.name} onChange={(e) => updateField('name', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Nationality</label>
                <Input
                  value={preview.nationality ?? ''}
                  onChange={(e) => updateField('nationality', e.target.value)}
                  placeholder="e.g. Italian"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Position</label>
                <Input
                  value={preview.position ?? ''}
                  onChange={(e) => updateField('position', e.target.value)}
                  placeholder="e.g. Forward"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Born</label>
                <Input
                  value={preview.born ?? ''}
                  onChange={(e) => updateField('born', e.target.value)}
                  placeholder="e.g. 1976-09-22"
                />
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Senior career ({stints.length} club{stints.length !== 1 ? 's' : ''})
            </h2>
            <CareerTable stints={stints} editable onChange={setStints} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setPreview(null); setStints([]) }}>
              Clear
            </Button>
            <Button onClick={handleSave} disabled={saving || !preview.name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {saving ? 'Saving…' : 'Save footballer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
