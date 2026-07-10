import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays, ChevronDown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PositionBadge } from '@/components/PositionBadge'
import { Button } from '@/components/ui/button'
import { NationalityFlag } from '@/components/NationalityFlag'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import {
  getAdminLists,
  getListPlayers,
  setListConfig,
  type AdminList,
  type RandomListPlayer,
} from '@/api/random-lists-admin'

export function RandomListsAdminPage() {
  const navigate = useNavigate()
  const [lists, setLists] = useState<AdminList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [playersByList, setPlayersByList] = useState<Record<string, RandomListPlayer[]>>({})
  const [playersLoading, setPlayersLoading] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getAdminLists()
      .then(res => setLists(res.data))
      .catch(() => setError('Failed to load lists'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!playersByList[id]) {
      setPlayersLoading(id)
      getListPlayers(id)
        .then(players => setPlayersByList(prev => ({ ...prev, [id]: players })))
        .catch(() => setPlayersByList(prev => ({ ...prev, [id]: [] })))
        .finally(() => setPlayersLoading(null))
    }
  }

  async function handleToggle(list: AdminList, e: React.ChangeEvent<HTMLInputElement>) {
    const enabled = e.target.checked
    setLists(prev => prev.map(l => (l.id === list.id ? { ...l, enabled } : l)))
    try {
      await setListConfig(list.id, { enabled })
    } catch {
      setLists(prev => prev.map(l => (l.id === list.id ? { ...l, enabled: !enabled } : l)))
    }
  }

  function handleTargetChange(id: string, raw: string) {
    const n = parseInt(raw, 10)
    setLists(prev => prev.map(l => (l.id === id ? { ...l, target: isNaN(n) ? 0 : n } : l)))
  }

  async function commitTarget(list: AdminList) {
    const target = Math.max(0, Math.min(list.target || 0, list.poolCount))
    setLists(prev => prev.map(l => (l.id === list.id ? { ...l, target } : l)))
    try {
      await setListConfig(list.id, { target })
    } catch {
      load()
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Random Lists</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${lists.length} lists · ${lists.filter(l => l.enabled).length} enabled`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/random-lists/schedule')}>
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing lists…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">On</TableHead>
              <TableHead>List</TableHead>
              <TableHead className="w-20 text-right">Pool</TableHead>
              <TableHead className="w-24 text-right">To guess</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lists.map(list => (
              <Fragment key={list.id}>
                <TableRow className="cursor-pointer" onClick={() => toggleExpand(list.id)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={list.enabled}
                      onChange={e => handleToggle(list, e)}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded === list.id ? 'rotate-180' : ''}`} />
                      <div>
                        <div className="text-sm font-medium">{list.title}</div>
                        <div className="text-xs text-muted-foreground">{list.subtitle}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {list.poolCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      min={0}
                      max={list.poolCount}
                      value={list.target}
                      onChange={e => handleTargetChange(list.id, e.target.value)}
                      onBlur={() => commitTarget(list)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      className="h-8 w-16 rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-ring"
                    />
                  </TableCell>
                </TableRow>
                {expanded === list.id && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="bg-muted/30 p-0">
                      {playersLoading === list.id ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading players…
                        </div>
                      ) : (
                        <ul className="divide-y">
                          {(playersByList[list.id] ?? []).map((p, i) => (
                            <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                              <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                              <PlayerAvatar id={p.id} name={p.name} wikipediaUrl="" storedPhotoUrl={p.photo_url} size="sm" variant="admin" />
                              <span className="text-sm font-medium">{p.name}</span>
                              {p.nationality && <NationalityFlag nationality={p.nationality} size={14} />}
                              {p.position && <PositionBadge position={p.position} />}
                              <span className="ml-auto text-sm font-semibold tabular-nums">{p.stat}</span>
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
      )}
    </div>
  )
}
