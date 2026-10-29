import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Loader2, Search, Eye, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getTenableCandidates,
  selectTenableRound,
  deselectTenableRound,
  bulkSelectTenable,
  previewTenableRound,
  type TenableCandidate,
  type TenableAnswer,
} from '@/api/tenable'

// Every round of one question type that has 10+ answers. Tick the ones to add
// to the schedule pool; expand a row to preview its ten answers.
export function TenableTypePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [rows, setRows] = useState<TenableCandidate[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [preview, setPreview] = useState<TenableAnswer[] | null>(null)

  const keyOf = (c: TenableCandidate) => `${JSON.stringify(c.params)}|${c.metric}`

  const load = useCallback((query: string) => {
    setLoading(true)
    getTenableCandidates(slug, query)
      .then(r => setRows(r.data))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    const t = setTimeout(() => load(q), 250)
    return () => clearTimeout(t)
  }, [q, load])

  async function toggle(c: TenableCandidate) {
    const k = keyOf(c)
    setBusy(k)
    try {
      if (c.roundId) {
        await deselectTenableRound(c.roundId)
        setRows(rs => rs.map(r => (keyOf(r) === k ? { ...r, roundId: null } : r)))
      } else {
        const { id } = await selectTenableRound(c)
        setRows(rs => rs.map(r => (keyOf(r) === k ? { ...r, roundId: id } : r)))
      }
    } finally {
      setBusy(null)
    }
  }

  async function showPreview(c: TenableCandidate) {
    const k = keyOf(c)
    if (openKey === k) { setOpenKey(null); setPreview(null); return }
    setOpenKey(k)
    setPreview(null)
    setPreview(await previewTenableRound(c.type, c.params, c.metric))
  }

  const selectedCount = rows.filter(r => r.roundId).length

  const [bulking, setBulking] = useState(false)
  async function selectAll(deselect = false) {
    setBulking(true)
    try {
      await bulkSelectTenable({ type: slug, deselect })
      load(q)
    } finally { setBulking(false) }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/tenable/football')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold capitalize">{slug.replace(/-/g, ' ')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : `${rows.length} rounds · ${selectedCount} selected`}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="sm" onClick={() => selectAll(false)} disabled={loading || bulking}>
            {bulking ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Select all
          </Button>
          <Button variant="ghost" size="sm" onClick={() => selectAll(true)} disabled={loading || bulking}>
            Clear
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter rounds…" className="pl-9" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rounds…
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(c => {
            const k = keyOf(c)
            const isOpen = openKey === k
            return (
              <div key={k} className="rounded-lg border">
                <div className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={!!c.roundId}
                    onChange={() => toggle(c)}
                    disabled={busy === k}
                    className="h-4 w-4 cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.answer_count} possible answers · ranked by {c.metric}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => showPreview(c)} className="shrink-0">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {isOpen && (
                  <div className="border-t bg-muted/30 px-3 py-2">
                    {preview === null ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading answers…
                      </div>
                    ) : (
                      <ol className="text-sm space-y-0.5">
                        {preview.map((a, i) => (
                          <li key={a.footballer_id} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-5 tabular-nums">{i + 1}.</span>
                            <span className="flex-1 truncate">{a.name}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{a.value}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              No rounds of this type reach 10 answers yet.
            </p>
          )}
        </div>
      )}

      {selectedCount > 0 && (
        <div className="mt-5 flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <span className="text-sm flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            {selectedCount} selected on this page
          </span>
          <Button size="sm" onClick={() => navigate('/admin/tenable/schedule')}>
            Go to schedule
          </Button>
        </div>
      )}
    </div>
  )
}
