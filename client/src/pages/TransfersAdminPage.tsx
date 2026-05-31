import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ArrowRight } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import {
  getAdminPairs,
  getPairPlayers,
  setPairEnabled,
  type AdminPair,
  type TransferPlayer,
} from '@/api/transfers-admin'

const PAGE_SIZE = 25

function pairKey(p: { fromClub: string; toClub: string }) {
  return `${p.fromClub}|||${p.toClub}`
}

export function TransfersAdminPage() {
  const navigate = useNavigate()
  const [pairs, setPairs] = useState<AdminPair[]>([])
  const [total, setTotal] = useState(0)
  const [enabledCount, setEnabledCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [playersByPair, setPlayersByPair] = useState<Record<string, TransferPlayer[]>>({})
  const [playersLoading, setPlayersLoading] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback((p: number) => {
    setLoading(true)
    setExpanded(null)
    getAdminPairs(p, PAGE_SIZE)
      .then(res => {
        setPairs(res.data)
        setTotal(res.total)
        setEnabledCount(res.enabledCount)
        setPage(res.page)
      })
      .catch(() => setError('Failed to load transfers'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(1) }, [load])

  function toggleExpand(pair: AdminPair) {
    const key = pairKey(pair)
    if (expanded === key) { setExpanded(null); return }
    setExpanded(key)
    if (!playersByPair[key]) {
      setPlayersLoading(key)
      getPairPlayers(pair.fromClub, pair.toClub)
        .then(players => setPlayersByPair(prev => ({ ...prev, [key]: players })))
        .catch(() => setPlayersByPair(prev => ({ ...prev, [key]: [] })))
        .finally(() => setPlayersLoading(null))
    }
  }

  async function handleToggle(pair: AdminPair, e: React.ChangeEvent<HTMLInputElement>) {
    const enabled = e.target.checked
    const key = pairKey(pair)
    setPairs(prev => prev.map(p => (pairKey(p) === key ? { ...p, enabled } : p)))
    setEnabledCount(prev => prev + (enabled ? 1 : -1))
    try {
      await setPairEnabled(pair.fromClub, pair.toClub, enabled)
    } catch {
      setPairs(prev => prev.map(p => (pairKey(p) === key ? { ...p, enabled: !enabled } : p)))
      setEnabledCount(prev => prev + (enabled ? -1 : 1))
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Transfers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${total} transfer combos · ${enabledCount} enabled`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/transfers/schedule')}>
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing transfers…
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">On</TableHead>
                <TableHead>Transfer</TableHead>
                <TableHead className="w-20 text-right">Players</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pairs.map(pair => {
                const key = pairKey(pair)
                return (
                  <Fragment key={key}>
                    <TableRow className="cursor-pointer" onClick={() => toggleExpand(pair)}>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={pair.enabled}
                          onChange={e => handleToggle(pair, e)}
                          className="h-4 w-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${expanded === key ? 'rotate-180' : ''}`}
                          />
                          <MiniClubBadge club={pair.fromClub} wikipediaUrl={pair.fromClubWikiUrl} />
                          <span className="text-sm font-medium">{pair.fromClub}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <MiniClubBadge club={pair.toClub} wikipediaUrl={pair.toClubWikiUrl} />
                          <span className="text-sm font-medium">{pair.toClub}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {pair.playerCount}
                        </span>
                      </TableCell>
                    </TableRow>
                    {expanded === key && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={3} className="bg-muted/30 p-0">
                          {playersLoading === key ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading players…
                            </div>
                          ) : (
                            <ul className="divide-y">
                              {(playersByPair[key] ?? []).map(p => (
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
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} combos
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
