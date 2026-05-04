import { useRef, useState } from 'react'
import { Download, Upload, Loader2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function DatabasePage() {
  const [adminKey, setAdminKey] = useState('')
  const [exportState, setExportState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [importState, setImportState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [importResult, setImportResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleCopyUrls() {
    setCopyError(null)
    try {
      const res = await fetch('/api/footballers')
      if (!res.ok) throw new Error('Failed to fetch footballers')
      const data = await res.json() as { wikipedia_url: string }[]
      const urls = data.map(f => f.wikipedia_url).join('\n')
      await navigator.clipboard.writeText(urls)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : 'Copy failed')
    }
  }

  async function handleExport() {
    if (!adminKey.trim()) return
    setExportState('loading')
    try {
      const res = await fetch('/api/admin/export-db', {
        headers: { 'x-admin-key': adminKey },
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `db-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportState('idle')
    } catch {
      setExportState('error')
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !adminKey.trim()) return
    setImportState('loading')
    setImportResult(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch('/api/admin/import-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setImportResult(
        `Imported ${json.imported.footballers} footballers, ${json.imported.career_stints} stints, ${json.imported.days} days.`
      )
      setImportState('done')
    } catch (err) {
      setImportResult(err instanceof Error ? err.message : 'Import failed')
      setImportState('error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-lg">
      <h1 className="text-xl font-semibold mb-1">Database</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Export from local, import on production. Requires <code className="text-xs bg-muted px-1 rounded">ADMIN_KEY</code> env var set on the server.
      </p>

      <div className="space-y-6">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Admin key</label>
          <Input
            type="password"
            value={adminKey}
            onChange={e => setAdminKey(e.target.value)}
            placeholder="Enter ADMIN_KEY value"
          />
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-medium">Export</h2>
          <p className="text-xs text-muted-foreground">Downloads all footballers, stints and schedule as JSON.</p>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={!adminKey.trim() || exportState === 'loading'}
            >
              {exportState === 'loading'
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Exporting…</>
                : <><Download className="h-4 w-4 mr-1.5" />Export database</>}
            </Button>
            <Button
              variant={copied ? 'default' : 'outline'}
              onClick={handleCopyUrls}
              className={copied ? 'bg-green-600 hover:bg-green-600 text-white border-green-600' : ''}
            >
              {copied
                ? <><Check className="h-4 w-4 mr-1.5" />Copied!</>
                : <><Copy className="h-4 w-4 mr-1.5" />Copy Wikipedia URLs</>}
            </Button>
          </div>
          {exportState === 'error' && <p className="text-xs text-destructive">Export failed — check your admin key.</p>}
          {copyError && <p className="text-xs text-destructive">{copyError}</p>}
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-medium">Import</h2>
          <p className="text-xs text-muted-foreground">
            Replaces <strong>all data</strong> on this server with the contents of an exported JSON file.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={!adminKey.trim() || importState === 'loading'}
            >
              {importState === 'loading'
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Importing…</>
                : <><Upload className="h-4 w-4 mr-1.5" />Choose file…</>}
            </Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
          {importState === 'done' && <p className="text-xs text-green-600">{importResult}</p>}
          {importState === 'error' && <p className="text-xs text-destructive">{importResult}</p>}
        </div>
      </div>
    </div>
  )
}
