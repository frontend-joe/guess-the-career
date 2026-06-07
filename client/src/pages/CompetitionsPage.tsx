import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Trash2, ExternalLink, RefreshCw, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCompetitions, deleteCompetition, rescrapeCompetition, type CompetitionListItem } from '@/api/competitions'

type RowStatus = 'idle' | 'scraping' | 'done' | 'failed'

export function CompetitionsPage() {
  const navigate = useNavigate()
  const [competitions, setCompetitions] = useState<CompetitionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [rowStatus, setRowStatus] = useState<Record<number, RowStatus>>({})
  const [rescraping, setRescraping] = useState(false)
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setCompetitions(await getCompetitions())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === competitions.length ? new Set() : new Set(competitions.map(c => c.id))
    )
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this competition and all its stats?')) return
    setDeletingId(id)
    try {
      await deleteCompetition(id)
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  function handleCopySelected() {
    const urls = competitions
      .filter(c => selected.has(c.id))
      .map(c => c.wikipedia_url)
      .join('\n')
    navigator.clipboard.writeText(urls)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRescrapeSelected() {
    const ids = [...selected]
    setRescraping(true)
    setRowStatus(Object.fromEntries(ids.map(id => [id, 'idle'])))

    for (const id of ids) {
      setRowStatus(prev => ({ ...prev, [id]: 'scraping' }))
      try {
        await rescrapeCompetition(id)
        setRowStatus(prev => ({ ...prev, [id]: 'done' }))
      } catch {
        setRowStatus(prev => ({ ...prev, [id]: 'failed' }))
      }
    }

    setRescraping(false)
    setSelected(new Set())
    await load()
  }

  const allSelected = competitions.length > 0 && selected.size === competitions.length

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Competitions</h1>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={handleCopySelected}>
                {copied
                  ? <><Check className="h-3.5 w-3.5 mr-1.5" />Copied!</>
                  : <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy data</>
                }
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rescraping}
                onClick={handleRescrapeSelected}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${rescraping ? 'animate-spin' : ''}`} />
                Rescrape {selected.size} selected
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/competitions/top-scorers-schedule')}>
            Top Scorers Schedule
          </Button>
          <Button size="sm" onClick={() => navigate('/admin/competitions/add')}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add competition
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : competitions.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <p className="text-sm">No competitions yet.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/admin/competitions/add')}>
            Add your first competition
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg divide-y overflow-hidden">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/20">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 accent-primary shrink-0"
            />
            <span className="text-xs text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
            </span>
          </div>

          {competitions.map(comp => {
            const status = rowStatus[comp.id]
            return (
              <div
                key={comp.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(comp.id)}
                  onChange={() => toggleSelect(comp.id)}
                  className="h-4 w-4 accent-primary shrink-0"
                  onClick={e => e.stopPropagation()}
                />
                <div
                  className="h-7 w-7 shrink-0 flex items-center justify-center cursor-pointer"
                  onClick={() => navigate(`/admin/competitions/${comp.id}`)}
                >
                  {comp.image_url
                    ? <img src={comp.image_url} alt="" className="max-h-full max-w-full object-contain" />
                    : <div className="h-7 w-7 rounded bg-muted" />
                  }
                </div>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/admin/competitions/${comp.id}`)}
                >
                  <p className="text-sm font-medium truncate">{comp.name}</p>
                </div>
                {status === 'scraping' && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                )}
                {status === 'done' && (
                  <span className="text-xs text-green-600 shrink-0">Done</span>
                )}
                {status === 'failed' && (
                  <span className="text-xs text-destructive shrink-0">Failed</span>
                )}
                <a
                  href={comp.wikipedia_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  title="Open Wikipedia"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={deletingId === comp.id}
                  onClick={e => { e.stopPropagation(); handleDelete(comp.id) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
