import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import {
  getAdminClubs,
  getClubPlayers,
  setClubEnabled,
  type AdminClub,
  type ClubLegendPlayer,
} from '@/api/club-legends-admin'

const PAGE_SIZE = 25

const POSITION_COLOURS: Record<string, string> = {
  GK: 'bg-purple-100 text-purple-700',
  DF: 'bg-blue-100 text-blue-700',
  MF: 'bg-green-100 text-green-700',
  FW: 'bg-orange-100 text-orange-700',
}

function PositionBadge({ position }: { position: 'GK' | 'DF' | 'MF' | 'FW' }) {
  return (
    <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${POSITION_COLOURS[position]}`}>
      {position}
    </span>
  )
}

export function ClubLegendsAdminPage() {
  const navigate = useNavigate()
  const [clubs, setClubs] = useState<AdminClub[]>([])
  const [total, setTotal] = useState(0)
  const [enabledCount, setEnabledCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [playersByClub, setPlayersByClub] = useState<Record<string, ClubLegendPlayer[]>>({})
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
        .then(players => setPlayersByClub(prev => ({ ...prev, [club]: players })))
        .catch(() => setPlayersByClub(prev => ({ ...prev, [club]: [] })))
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
          <h1 className="text-xl font-semibold">Club Legends</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${total} qualifying clubs · ${enabledCount} enabled`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/club-legends/schedule')}>
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
                <TableHead className="w-32 text-right">Legends (100+ apps)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clubs.map(club => (
                <Fragment key={club.club}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => toggleExpand(club.club)}
                  >
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
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {club.legendCount}
                      </span>
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
                          <ul className="divide-y">
                            {(playersByClub[club.club] ?? []).map(p => (
                              <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                                <PlayerAvatar
                                  id={p.id}
                                  name={p.name}
                                  wikipediaUrl=""
                                  storedPhotoUrl={p.photo_url}
                                  size="sm"
                                  variant="admin"
                                />
                                <span className="text-sm font-medium">{p.name}</span>
                                {p.nationality && <NationalityFlag nationality={p.nationality} size={14} />}
                                {p.position && <PositionBadge position={p.position} />}
                                <span className="ml-auto text-sm font-semibold tabular-nums">{p.apps}</span>
                                <span className="text-xs text-muted-foreground">apps</span>
                              </li>
                            ))}
                          </ul>
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
