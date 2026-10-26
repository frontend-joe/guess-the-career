import { useEffect, useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { getDerivedSpells, type DerivedSpell, type DerivedSpells as Data } from '@/api/footballers'

interface Props {
  footballerId: number
  /** Bump to refetch (e.g. after a rescrape replaces the stints). */
  reloadKey?: number
}

// Why a spell can or can't be credited to a league. A spell's appearances are
// a single career total, so it only counts when the club stayed in one league
// for the whole spell — anything else has to be dropped rather than split.
const EXPLAIN: Record<DerivedSpell['status'], { label: string; tone: string; detail: string }> = {
  resolved: {
    label: 'Counts',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    detail: 'The club stayed in this league for the whole spell.',
  },
  straddled: {
    label: 'Dropped — spans leagues',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    detail:
      'The club changed division during the spell, and a single career total can’t be split between them.',
  },
  other_league: {
    label: 'Not a round league',
    tone: 'bg-slate-100 text-slate-600 border-slate-200',
    detail: 'The club stayed in one league, but not one the games build rounds from.',
  },
  no_club_data: {
    label: 'No season history',
    tone: 'bg-slate-100 text-slate-600 border-slate-200',
    detail:
      'We have no season-by-season record for this club, so its division during the spell is unknown.',
  },
}

export function DerivedSpells({ footballerId, reloadKey }: Props) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    getDerivedSpells(footballerId)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [footballerId, reloadKey])

  if (error) {
    return <p className="text-sm text-destructive">Couldn’t load career spells.</p>
  }
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Working out spells…
      </p>
    )
  }
  if (data.spells.length === 0) {
    return <p className="text-sm text-muted-foreground">No senior career spells recorded.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {data.usesStintFallback
          ? 'This player has no scraped career statistics, so the games fall back to these spells. What you see here is what they use.'
          : 'This player has scraped career statistics, so the games use those instead. These spells are shown for comparison.'}
      </p>

      <div className="flex flex-col divide-y rounded-lg border">
        {data.spells.map((s, i) => {
          const e = EXPLAIN[s.status]
          return (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
              <MiniClubBadge club={s.club} wikipediaUrl={s.club_wikipedia_url} />
              <span className="font-medium">{s.club}</span>
              {s.is_loan && (
                <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">loan</span>
              )}
              <span className="tabular-nums text-sm text-muted-foreground">{s.years}</span>
              <span className="tabular-nums text-sm text-muted-foreground">
                {s.apps} apps{s.goals > 0 && `, ${s.goals} goals`}
              </span>

              <span className={`ml-auto text-xs border rounded-full px-2 py-0.5 ${e.tone}`}>
                {s.status === 'resolved' ? s.league : e.label}
              </span>

              <div className="w-full flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{e.detail}</span>
                {s.leagues.length > 0 && (
                  <span>
                    Club was in:{' '}
                    <span className="text-foreground">{s.leagues.join(', ')}</span>
                  </span>
                )}
                {s.source_url && (
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                  >
                    source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
