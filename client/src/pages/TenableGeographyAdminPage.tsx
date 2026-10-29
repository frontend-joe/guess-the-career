import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, ChevronRight, Loader2, Plus, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getGeographyRounds, type GeographyRound, type GeographyTopic } from '@/api/tenable'

// Every geography round, grouped by topic. Unlike football's screens there is
// nothing to browse and tick: a round exists because somebody wrote it, so this
// is a list of what has been written and a button to write another.
export function TenableGeographyAdminPage() {
  const navigate = useNavigate()
  const [rounds, setRounds] = useState<GeographyRound[]>([])
  const [topics, setTopics] = useState<GeographyTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGeographyRounds()
      .then(r => { setRounds(r.data); setTopics(r.topics) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const labelFor = (slug: string) => topics.find(t => t.slug === slug)?.label ?? slug
  const byTopic = [...new Set(rounds.map(r => r.topic))].sort()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
        <div>
          <button
            onClick={() => navigate('/admin/tenable')}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Tenable categories
          </button>
          <h1 className="text-xl font-semibold">Geography Tenable</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${rounds.length} round${rounds.length === 1 ? '' : 's'} across ${byTopic.length} topic${byTopic.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/admin/tenable/geography/new')}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New round
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rounds…
        </div>
      ) : rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          No rounds yet. Start one with “New round”.
        </p>
      ) : (
        <div className="space-y-5">
          {byTopic.map(topic => (
            <section key={topic}>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                {labelFor(topic)}
              </h2>
              <div className="rounded-xl border divide-y">
                {rounds.filter(r => r.topic === topic).map(r => (
                  <button
                    key={r.slug}
                    onClick={() => navigate(`/admin/tenable/geography/${r.slug}`)}
                    className="group w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.answerCount} answer{r.answerCount === 1 ? '' : 's'}
                        {' · '}
                        {r.ordered ? `ranked${r.unit ? ` by ${r.unit}` : ''}` : 'name any ten'}
                        {' · '}
                        <span className="font-mono">{r.slug}</span>
                      </p>
                    </div>
                    {/* A round with fewer than ten answers cannot be played:
                        the multiplayer freeze refuses a board it cannot fill. */}
                    {r.answerCount < 10 && (
                      <span className="shrink-0 flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Needs {10 - r.answerCount} more
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
