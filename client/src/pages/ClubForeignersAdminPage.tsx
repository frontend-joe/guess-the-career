import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PositionBadge } from '@/components/PositionBadge'
import { Button } from '@/components/ui/button'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import {
  getAdminClubs,
  getClubPlayers,
  setClubEnabled,
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
      await setClubEnabled(club.club, enabled)
    } catch {
      setClubs(prev => prev.map(c => (c.club === club.club ? { ...c, enabled: !enabled } : c)))
      setEnabledCount(prev => prev + (enabled ? -1 : 1))
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
                  </TableRow>
                  {expanded === club.club && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="bg-muted/30 p-0">
                        {playersLoading === club.club ? (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading players…
                          </div>
                        ) : (
                          <div className="divide-y">
                            {(playersByClub[club.club]?.groups ?? []).map(group => (
                              <div key={group.country} className="py-1">
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/40">
                                  <NationalityFlag nationality={group.country} size={14} />
                                  <span className="text-xs font-semibold">{group.country}</span>
                                  <span className="text-xs text-muted-foreground">· {group.players.length}</span>
                                </div>
                                <ul>
                                  {group.players.map(p => (
                                    <li key={p.id} className="flex items-center gap-3 px-4 py-1.5">
                                      <PlayerAvatar id={p.id} name={p.name} wikipediaUrl="" storedPhotoUrl={p.photo_url} size="sm" variant="admin" />
                                      <span className="text-sm">{p.name}</span>
                                      {p.position && <PositionBadge position={p.position} />}
                                      {p.years && <span className="text-xs text-muted-foreground">{p.years}</span>}
                                      <span className="ml-auto text-sm font-semibold tabular-nums">{p.apps}</span>
                                      <span className="text-xs text-muted-foreground">apps</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
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
