import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Trash2, ExternalLink, Search, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getXiMatches, deleteXiMatch, type XiMatchListItem } from '@/api/xi-matches'

export function ElevensPage() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState<XiMatchListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    getXiMatches()
      .then(setMatches)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(match: XiMatchListItem) {
    if (!confirm(`Delete "${match.name}"? This will remove all ${match.player_count} associated players.`)) return
    setDeletingId(match.id)
    try {
      await deleteXiMatch(match.id)
      setMatches(prev => prev.filter(m => m.id !== match.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = matches.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.competition.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Elevens</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{matches.length} matches</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/elevens/schedule')}>
            <CalendarDays className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Schedule</span>
          </Button>
          <Button onClick={() => navigate('/elevens/add')} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Add match
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search matches..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {search ? 'No matches found.' : 'No matches yet. Add one to get started.'}
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Year</th>
                <th className="text-left px-4 py-2.5 font-medium">Match</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Competition</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Teams</th>
                <th className="text-right px-4 py-2.5 font-medium">Players</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(match => (
                <tr
                  key={match.id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/elevens/${match.id}`)}
                >
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{match.year}</td>
                  <td className="px-4 py-3 font-medium">{match.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{match.competition}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {match.home_team} vs {match.away_team}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={match.player_count >= 22 ? 'text-green-600' : 'text-amber-600'}>
                      {match.player_count}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={match.wikipedia_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                        title="Open Wikipedia"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(match)}
                        disabled={deletingId === match.id}
                        className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground disabled:opacity-50"
                        title="Delete match"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
