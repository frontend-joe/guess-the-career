import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { getCareerStats, type CareerStatRow } from '@/api/footballers'

interface Props {
  footballerId: number
  /** Bump to refetch (e.g. after a rescrape replaces the rows). */
  reloadKey?: number
}

interface LeagueTotal {
  league: string
  apps: number
  goals: number
  seasons: number
}

function summarise(rows: CareerStatRow[]): LeagueTotal[] {
  const byLeague = new Map<string, LeagueTotal>()
  for (const r of rows) {
    const key = r.league ?? r.division ?? '—'
    const cur = byLeague.get(key) ?? { league: key, apps: 0, goals: 0, seasons: 0 }
    cur.apps += r.league_apps ?? 0
    cur.goals += r.league_goals ?? 0
    cur.seasons += 1
    byLeague.set(key, cur)
  }
  return [...byLeague.values()].sort((a, b) => b.apps - a.apps || b.goals - a.goals)
}

export function CareerStatistics({ footballerId, reloadKey = 0 }: Props) {
  const [rows, setRows] = useState<CareerStatRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setRows(null)
    setError(null)
    getCareerStats(footballerId)
      .then(r => { if (active) setRows(r) })
      .catch(() => { if (active) setError('Failed to load career statistics') })
    return () => { active = false }
  }, [footballerId, reloadKey])

  if (error) return <p className="text-sm text-red-600">{error}</p>

  if (rows === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading career statistics…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No career statistics scraped yet. Rescrape this player, or run “Backfill career stats”
        on the Footballers page. (Some older players have no career statistics table on Wikipedia.)
      </p>
    )
  }

  const totals = summarise(rows)
  const grandApps = totals.reduce((n, t) => n + t.apps, 0)
  const grandGoals = totals.reduce((n, t) => n + t.goals, 0)

  return (
    <div className="space-y-4">
      {/* Per-league summary — the aggregate games will query */}
      <div className="flex flex-wrap gap-2">
        {totals.map(t => (
          <div key={t.league} className="rounded-lg border bg-muted/30 px-3 py-2">
            <div className="text-sm font-medium">{t.league}</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {t.apps} apps · {t.goals} goals
              <span className="opacity-60"> · {t.seasons} {t.seasons === 1 ? 'season' : 'seasons'}</span>
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="text-sm font-medium">All leagues</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {grandApps} apps · {grandGoals} goals
          </div>
        </div>
      </div>

      {/* Season-by-season */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Club</TableHead>
            <TableHead>Season</TableHead>
            <TableHead>League</TableHead>
            <TableHead className="text-right">Apps</TableHead>
            <TableHead className="text-right">Goals</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Total apps</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Total goals</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            // Only show the club on its first row in a run, like Wikipedia does.
            const newClub = i === 0 || rows[i - 1].club !== r.club
            return (
              <TableRow key={i}>
                <TableCell>
                  {newClub ? (
                    <div className="flex items-center gap-2">
                      <MiniClubBadge club={r.club} wikipediaUrl={r.club_wikipedia_url} />
                      <span className="text-sm">{r.club}</span>
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm tabular-nums">{r.season}</TableCell>
                <TableCell className="text-sm">{r.division ?? '—'}</TableCell>
                <TableCell className="text-sm text-right tabular-nums">{r.league_apps ?? '—'}</TableCell>
                <TableCell className="text-sm text-right tabular-nums">{r.league_goals ?? '—'}</TableCell>
                <TableCell className="text-sm text-right tabular-nums text-muted-foreground hidden sm:table-cell">{r.total_apps ?? '—'}</TableCell>
                <TableCell className="text-sm text-right tabular-nums text-muted-foreground hidden sm:table-cell">{r.total_goals ?? '—'}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
