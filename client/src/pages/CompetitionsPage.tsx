import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCompetitions, deleteCompetition, type CompetitionListItem } from '@/api/competitions'

export function CompetitionsPage() {
  const navigate = useNavigate()
  const [competitions, setCompetitions] = useState<CompetitionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      setCompetitions(await getCompetitions())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: number) {
    if (!confirm('Delete this competition and all its stats?')) return
    setDeletingId(id)
    try {
      await deleteCompetition(id)
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Competitions</h1>
        <Button size="sm" onClick={() => navigate('/competitions/add')}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add competition
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : competitions.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <p className="text-sm">No competitions yet.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/competitions/add')}>
            Add your first competition
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg divide-y overflow-hidden">
          {competitions.map(comp => (
            <div
              key={comp.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/competitions/${comp.id}`)}
            >
              <div className="h-7 w-7 shrink-0 flex items-center justify-center">
                {comp.image_url
                  ? <img src={comp.image_url} alt="" className="max-h-full max-w-full object-contain" />
                  : <div className="h-7 w-7 rounded bg-muted" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{comp.name}</p>
              </div>
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
          ))}
        </div>
      )}
    </div>
  )
}
