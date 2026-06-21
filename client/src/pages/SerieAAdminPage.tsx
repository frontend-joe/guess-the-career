import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays, ChevronRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'
import {
  getCountries,
  getCountryPlayers,
  setCountryEnabled,
  type SerieACountry,
  type SerieAPlayer,
} from '@/api/serie-a-admin'

export function SerieAAdminPage() {
  const navigate = useNavigate()
  const [countries, setCountries] = useState<SerieACountry[]>([])
  const [enabledCount, setEnabledCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [players, setPlayers] = useState<Record<string, SerieAPlayer[]>>({})

  const load = useCallback(() => {
    setLoading(true)
    getCountries()
      .then((res) => { setCountries(res.data); setEnabledCount(res.enabledCount) })
      .catch(() => setError('Failed to load countries'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  function patch(nationality: string, changes: Partial<SerieACountry>) {
    setCountries((prev) => prev.map((c) => (c.nationality === nationality ? { ...c, ...changes } : c)))
  }

  async function toggle(c: SerieACountry, enabled: boolean) {
    patch(c.nationality, { enabled })
    setEnabledCount((n) => n + (enabled ? 1 : -1))
    try {
      await setCountryEnabled(c.nationality, enabled, c.roundSize)
    } catch {
      patch(c.nationality, { enabled: !enabled })
      setEnabledCount((n) => n + (enabled ? -1 : 1))
    }
  }

  async function changeSize(c: SerieACountry, roundSize: number) {
    patch(c.nationality, { roundSize, enabled: true })
    if (!c.enabled) setEnabledCount((n) => n + 1)
    try {
      await setCountryEnabled(c.nationality, true, roundSize)
    } catch {
      load()
    }
  }

  async function toggleExpand(nationality: string) {
    if (expanded === nationality) { setExpanded(null); return }
    setExpanded(nationality)
    if (!players[nationality]) {
      try {
        const list = await getCountryPlayers(nationality)
        setPlayers((prev) => ({ ...prev, [nationality]: list }))
      } catch { /* ignore */ }
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-6 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Serie A</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${countries.length} countries · ${enabledCount} in schedule`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/serie-a/schedule')}>
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Schedule
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Computing countries…
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {countries.map((c) => {
            const isOpen = expanded === c.nationality
            const list = players[c.nationality]
            return (
              <div key={c.nationality}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => toggle(c, e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-primary shrink-0"
                    title="Include in the schedule"
                  />
                  <NationalityFlag nationality={c.nationality} size={18} />
                  <button onClick={() => toggleExpand(c.nationality)} className="flex-1 min-w-0 text-left flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{c.nationality}</span>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>
                  <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                    {c.playerCount}
                  </span>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    Round
                    <select
                      value={c.roundSize}
                      onChange={(e) => changeSize(c, Number(e.target.value))}
                      className="border border-input rounded-md px-1.5 py-1 text-xs bg-background outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      <option value={5}>5</option>
                      <option value={10} disabled={c.playerCount < 10}>10</option>
                    </select>
                  </label>
                </div>

                {isOpen && (
                  <div className="bg-muted/30 px-3 py-2 border-t">
                    {!list ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading players…</div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                        {list.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 text-sm py-0.5">
                            <MiniClubBadge club={p.hintClub ?? ''} wikipediaUrl={p.clubWikiUrl} size={16} />
                            <span className="truncate flex-1">{p.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{p.apps}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
