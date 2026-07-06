import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'
import {
  getAdminClubs,
  getClubPlayers,
  setClubEnabled,
  setClubHome,
  type AdminClub,
  type ClubPlayersResult,
} from '@/api/club-foreigners-admin'

const PAGE_SIZE = 25

export function ClubForeignersAdminPage() {
  const navigate = useNavigate()
  const [clubs, setClubs] = useState<AdminClub[]>([])
  const [total, setTotal] = useState(0)
  const [enabledCount, setEnabledCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [playersByClub, setPlayersByClub] = useState<Record<string, ClubPlayersResult>>({})
  const [playersLoading, setPlayersLoading] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback((p: number) => {
    setLoading(true)
    setExpanded(null)
    getAdminClubs(p, PAGE_SIZE)
      .then(res => {
        setClubs(res.data)
        setTotal(res.total)
        setEnabledCount(res.enabledCount)
        setPage(res.page)
      })
      .catch(() => setError('Failed to load clubs'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(1) }, [load])

  function toggleExpand(club: string) {
    if (expanded === club) { setExpanded(null); return }
    setExpanded(club)
    if (!playersByClub[club]) {
      setPlayersLoading(club)
      getClubPlayers(club)
        .then(res => setPlayersByClub(prev => ({ ...prev, [club]: res })))
        .catch(() => setPlayersByClub(prev => ({ ...prev, [club]: { homeCountry: null, groups: [] } })))
        .finally(() => setPlayersLoading(null))
    }
  }

  async function handleToggle(club: AdminClub, e: React.ChangeEvent<HTMLInputElement>) {
    const enabled = e.target.checked
    setClubs(prev => prev.map(c => (c.club === club.club ? { ...c, enabled } : c)))
    setEnabledCount(prev => prev + (enabled ? 1 : -1))
    try {
      await setClubEnabled(club.club, enabled, club.roundSize)
    } catch {
      setClubs(prev => prev.map(c => (c.club === club.club ? { ...c, enabled: !enabled } : c)))
      setEnabledCount(prev => prev + (enabled ? -1 : 1))
    }
  }

  async function changeHome(clubName: string, homeCountry: string) {
    try {
      await setClubHome(clubName, homeCountry)
      const res = await getClubPlayers(clubName)
      setPlayersByClub(prev => ({ ...prev, [clubName]: res }))
      const foreignerCount = res.groups.reduce((n, g) => n + g.players.length, 0)
      setClubs(prev => prev.map(c => (c.club === clubName ? { ...c, homeCountry: res.homeCountry, foreignerCount } : c)))
    } catch { /* ignore */ }
  }

  async function changeSize(club: AdminClub, roundSize: number) {
    const size = Math.max(1, Math.floor(roundSize))
    setClubs(prev => prev.map(c => (c.club === club.club ? { ...c, roundSize: size, enabled: true } : c)))
    if (!club.enabled) setEnabledCount(prev => prev + 1)
    try {
      await setClubEnabled(club.club, true, size)
    } catch {
      load(page)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Club Foreigners</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${total} qualifying clubs · ${enabledCount} enabled`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/club-foreigners/schedule')}>
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing clubs…
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">On</TableHead>
                <TableHead>Club</TableHead>
                <TableHead className="w-40 text-right">Nationalities (10+)</TableHead>
                <TableHead className="w-32 text-right">Round</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clubs.map(club => (
                <Fragment key={club.club}>
                  <TableRow className="cursor-pointer" onClick={() => toggleExpand(club.club)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={club.enabled}
                        onChange={e => handleToggle(club, e)}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded === club.club ? 'rotate-180' : ''}`}
                        />
                        <MiniClubBadge club={club.club} wikipediaUrl={club.clubWikiUrl} />
                        <span className="text-sm font-medium">{club.club}</span>
                        {club.homeCountry && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <NationalityFlag nationality={club.homeCountry} size={12} />
                            {club.homeCountry}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {club.nationalityCount}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">{club.foreignerCount} foreign</span>
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="inline-flex items-center border border-input rounded-md overflow-hidden">
                        <button
                          type="button"
                          onClick={() => changeSize(club, club.roundSize - 1)}
                          className="px-2 py-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
                          disabled={club.roundSize <= 1}
                        >−</button>
                        <input
                          type="number"
                          min={1}
                          value={club.roundSize}
                          onChange={e => changeSize(club, Number(e.target.value) || 1)}
                          className="w-10 text-center text-xs bg-background outline-none border-x border-input py-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => changeSize(club, club.roundSize + 1)}
                          className="px-2 py-1 text-muted-foreground hover:bg-muted"
                        >+</button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded === club.club && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="bg-muted/30 p-0">
                        {playersLoading === club.club ? (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading players…
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const res = playersByClub[club.club]
                              if (!res) return null
                              const options = [res.homeCountry, ...res.groups.map(g => g.country)]
                                .filter((v): v is string => !!v)
                                .filter((v, i, a) => a.indexOf(v) === i)
                                .sort((a, b) => a.localeCompare(b))
                              return (
                                <div className="flex items-center gap-2 px-4 py-2 border-b bg-background/60">
                                  <span className="text-xs text-muted-foreground">Home country (excluded):</span>
                                  <select
                                    value={res.homeCountry ?? ''}
                                    onChange={e => changeHome(club.club, e.target.value)}
                                    className="border border-input rounded-md px-1.5 py-1 text-xs bg-background outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                  >
                                    {options.map(c => (<option key={c} value={c}>{c}</option>))}
                                  </select>
                                </div>
                              )
                            })()}
                            <ul className="divide-y">
                              {(playersByClub[club.club]?.groups ?? []).map(group => (
                                <li key={group.country} className="flex items-center gap-2 px-4 py-2">
                                  <NationalityFlag nationality={group.country} size={16} />
                                  <span className="text-sm font-medium">{group.country}</span>
                                  <span className="ml-auto text-sm font-semibold tabular-nums">{group.players.length}</span>
                                  <span className="text-xs text-muted-foreground">players</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} clubs
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => load(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => load(page + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
