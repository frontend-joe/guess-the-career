import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCompetition, deleteCompetition, patchCompetition, type CompetitionDetail } from '@/api/competitions'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'

export function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<CompetitionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [savingImage, setSavingImage] = useState(false)

  useEffect(() => {
    if (!id) return
    getCompetition(parseInt(id))
      .then(d => { setData(d); setImageUrl(d.competition.image_url ?? '') })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSaveImage() {
    if (!data) return
    setSavingImage(true)
    try {
      await patchCompetition(data.competition.id, { image_url: imageUrl.trim() || null })
      setData(d => d ? { ...d, competition: { ...d.competition, image_url: imageUrl.trim() || null } } : d)
    } finally {
      setSavingImage(false)
    }
  }

  async function handleDelete() {
    if (!data || !confirm(`Delete "${data.competition.name}" and all its stats?`)) return
    setDeleting(true)
    try {
      await deleteCompetition(data.competition.id)
      navigate('/admin/competitions')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  if (!data) return <div className="p-6 text-sm text-destructive">Competition not found.</div>

  const { competition, topScorers, hatTricks, topAssists, playerOfSeason, managerOfSeason } = data

  // Group PFA TOTY players from xi_players (fetched via pfa_toty_match_id) —
  // for now we show the stats we have; TOTY is accessible via Elevens
  const hasToty = competition.pfa_toty_match_id != null

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-6 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/admin/competitions')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold truncate">{competition.name}</h1>
          <a
            href={competition.wikipedia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-destructive hover:text-destructive"
          disabled={deleting}
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete
        </Button>
      </div>

      <div className="space-y-5">
        {/* Logo */}
        <section className="border rounded-lg p-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Logo</h2>
          <div className="flex items-center gap-3">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-10 w-10 object-contain shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded bg-muted shrink-0" />
            )}
            <Input
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://…"
              className="flex-1 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleSaveImage()}
            />
            <Button size="sm" onClick={handleSaveImage} disabled={savingImage}>
              {savingImage ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </section>

        {/* Awards */}
        {(playerOfSeason || managerOfSeason) && (
          <section className="border rounded-lg p-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Awards</h2>
            <div className="flex flex-wrap gap-8 text-sm">
              {playerOfSeason && (
                <div className="flex items-center gap-2">
                  {playerOfSeason.photo_url && (
                    <img src={playerOfSeason.photo_url} alt="" className="h-8 w-8 rounded-full object-cover object-top" />
                  )}
                  <div>
                    <span className="text-xs text-muted-foreground block">Player of the Season</span>
                    <span className="font-medium">{playerOfSeason.name}</span>
                  </div>
                </div>
              )}
              {managerOfSeason && (
                <div className="flex items-center gap-2">
                  {managerOfSeason.photo_url && (
                    <img src={managerOfSeason.photo_url} alt="" className="h-8 w-8 rounded-full object-cover object-top" />
                  )}
                  <div>
                    <span className="text-xs text-muted-foreground block">Manager of the Season</span>
                    <span className="font-medium">{managerOfSeason.name}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Top Scorers */}
        {topScorers.length > 0 && (
          <section className="border rounded-lg p-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Top Scorers
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
                {topScorers.map(s => (
                  <tr key={s.id}>
                    <td className="py-2 text-muted-foreground">{s.rank}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <NationalityFlag nationality={s.nationality} className="w-4 h-4 object-cover border border-border shrink-0" />
                        <span className="font-medium">{s.footballer_name ?? s.name}</span>
                        {s.footballer_name && s.footballer_name !== s.name && (
                          <span className="text-xs text-muted-foreground">({s.name})</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        {s.clubs.map(c => (
                          <MiniClubBadge key={c.name} club={c.name} wikipediaUrl={c.wikipedia_url} />
                        ))}
                        <span className="text-muted-foreground text-sm">{s.club}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right font-mono font-medium">{s.goals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Hat-tricks */}
        {hatTricks.length > 0 && (
          <section className="border rounded-lg p-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Hat-tricks ({hatTricks.length})
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
                {hatTricks.map(h => (
                  <tr key={h.id}>
                    <td className="py-2 font-medium">{h.footballer_name ?? h.name}</td>
                    <td className="py-2 text-muted-foreground">{h.for_club}</td>
                    <td className="py-2 text-muted-foreground">{h.against_club}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Top Assists */}
        {topAssists.length > 0 && (
          <section className="border rounded-lg p-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Top Assists
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
                {topAssists.map(a => (
                  <tr key={a.id}>
                    <td className="py-2 text-muted-foreground">{a.rank}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <NationalityFlag nationality={a.nationality} className="w-4 h-4 object-cover border border-border shrink-0" />
                        <span className="font-medium">{a.footballer_name ?? a.name}</span>
                      </div>
                    </td>
                    <td className="py-2 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        {a.clubs.map(c => (
                          <MiniClubBadge key={c.name} club={c.name} wikipediaUrl={c.wikipedia_url} />
                        ))}
                        <span className="text-muted-foreground text-sm">{a.club}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right font-mono font-medium">{a.assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* PFA TOTY link */}
        {hasToty && (
          <section className="border rounded-lg p-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">PFA Team of the Year</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/elevens/${competition.pfa_toty_match_id}`)}
            >
              View in Elevens
            </Button>
          </section>
        )}

        {topScorers.length === 0 && hatTricks.length === 0 && topAssists.length === 0 && !playerOfSeason && !managerOfSeason && (
          <p className="text-sm text-muted-foreground">No stats imported for this competition.</p>
        )}
      </div>
    </div>
  )
}
