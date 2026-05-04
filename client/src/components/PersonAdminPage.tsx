import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Search, Trash2, Eye, Globe, RefreshCw, CheckCircle2, XCircle, Circle, Loader2, Copy, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

type RStatus = 'pending' | 'scraping' | 'done' | 'failed'
type RPlayer = {
  id: number
  name: string
  status: RStatus
  stints?: number
  extra?: string | null
  error?: string
}

function RescrapeModal({ open, onClose, onComplete, rescrapeUrl }: {
  open: boolean
  onClose: () => void
  onComplete: () => void
  rescrapeUrl: string
}) {
  const [players, setPlayers] = useState<RPlayer[]>([])
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(false)
  const scrapingRef = useRef<HTMLDivElement>(null)

  const doneCount = players.filter(p => p.status === 'done').length
  const failedCount = players.filter(p => p.status === 'failed').length
  const scrapingId = players.find(p => p.status === 'scraping')?.id

  useEffect(() => {
    scrapingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [scrapingId])

  useEffect(() => {
    if (!open) return

    setPlayers([])
    setTotal(0)
    setDone(false)

    const es = new EventSource(rescrapeUrl)

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'init') {
        setTotal(data.total)
        setPlayers(data.players.map((p: { id: number; name: string }) => ({
          id: p.id, name: p.name, status: 'pending',
        })))
      } else if (data.type === 'start') {
        setPlayers(prev => prev.map(p => p.id === data.id ? { ...p, status: 'scraping' } : p))
      } else if (data.type === 'done') {
        setPlayers(prev => prev.map(p => p.id === data.id
          ? { ...p, status: 'done', stints: data.stints, extra: data.nationality ?? data.place_of_birth ?? null }
          : p))
      } else if (data.type === 'failed') {
        setPlayers(prev => prev.map(p => p.id === data.id ? { ...p, status: 'failed', error: data.error } : p))
      } else if (data.type === 'complete') {
        setDone(true)
        es.close()
      }
    }

    es.onerror = () => {
      es.close()
      setDone(true)
    }

    return () => es.close()
  }, [open, rescrapeUrl])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Rescraping all</span>
            {total > 0 && (
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {doneCount + failedCount} / {total}
              </span>
            )}
          </DialogTitle>
          {done && (
            <p className="text-sm text-muted-foreground mt-1">
              Done — {doneCount} updated{failedCount > 0 ? `, ${failedCount} failed` : ''}.
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border-t border-b min-h-0">
          {players.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting…
            </div>
          ) : (
            <div className="divide-y">
              {players.map((p) => (
                <div
                  key={p.id}
                  ref={p.status === 'scraping' ? scrapingRef : undefined}
                  className="flex items-center gap-3 px-4 py-2"
                >
                  <span className="shrink-0">
                    {p.status === 'pending'  && <Circle       className="h-4 w-4 text-muted-foreground/30" />}
                    {p.status === 'scraping' && <Loader2      className="h-4 w-4 text-blue-500 animate-spin" />}
                    {p.status === 'done'     && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {p.status === 'failed'   && <XCircle      className="h-4 w-4 text-destructive" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${p.status === 'pending' ? 'text-muted-foreground' : ''}`}>
                      {p.name}
                    </p>
                    {p.status === 'done' && (
                      <p className="text-xs text-muted-foreground">
                        {p.stints} stint{p.stints !== 1 ? 's' : ''}{p.extra ? ` · ${p.extra}` : ''}
                      </p>
                    )}
                    {p.status === 'failed' && (
                      <p className="text-xs text-destructive truncate">{p.error}</p>
                    )}
                    {p.status === 'scraping' && (
                      <p className="text-xs text-muted-foreground">scraping…</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 shrink-0 flex justify-end">
          <Button
            variant={done ? 'default' : 'outline'}
            onClick={() => { onClose(); if (done) onComplete() }}
          >
            {done ? 'Done' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DuplicatesModal<T extends { id: number; name: string; wikipedia_url: string }>({
  open, onClose, onDelete, getDuplicates, deletePerson,
}: {
  open: boolean
  onClose: () => void
  onDelete: () => void
  getDuplicates: () => Promise<T[][]>
  deletePerson: (id: number) => Promise<void>
}) {
  const [groups, setGroups] = useState<T[][]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getDuplicates().then(setGroups).finally(() => setLoading(false))
  }, [open, getDuplicates])

  async function handleDelete(item: T) {
    setDeletingId(item.id)
    try {
      await deletePerson(item.id)
      setGroups(prev =>
        prev.map(g => g.filter(x => x.id !== item.id)).filter(g => g.length > 1)
      )
      onDelete()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle>Duplicate entries</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto border-t min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No duplicates found.</p>
          ) : (
            <div className="divide-y">
              {groups.map((group, gi) => (
                <div key={gi} className="px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group[0].name}</p>
                  {group.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate text-muted-foreground">{item.wikipedia_url.split('/wiki/')[1]?.replace(/_/g, ' ')}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item)}
                      >
                        {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 py-3 shrink-0 border-t flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export interface ExtraColumn<T> {
  header: string
  className?: string
  render: (item: T) => React.ReactNode
}

export interface PersonAdminConfig<T extends { id: number; name: string; wikipedia_url: string }> {
  label: string
  schedulePath: string
  addPath: string
  detailPath: (id: number) => string
  rescrapeUrl: string
  extraColumns: ExtraColumn<T>[]
  getPeople: (opts?: { search?: string }) => Promise<T[]>
  deletePerson: (id: number) => Promise<void>
  deleteAllPeople: () => Promise<void>
  getDuplicates: () => Promise<T[][]>
}

export function PersonAdminPage<T extends { id: number; name: string; wikipedia_url: string }>({
  config,
}: {
  config: PersonAdminConfig<T>
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [people, setPeople] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [rescrapeOpen, setRescrapeOpen] = useState(false)
  const [dupesOpen, setDupesOpen] = useState(false)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const debouncedSearch = useDebounce(search, 250)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPeople(await config.getPeople(debouncedSearch ? { search: debouncedSearch } : undefined))
    } catch {
      setError(`Failed to load ${config.label.toLowerCase()}s`)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, config])

  useEffect(() => { load() }, [load])

  async function handleDelete(item: T) {
    if (!confirm(`Delete ${item.name}? This cannot be undone.`)) return
    setDeletingId(item.id)
    try {
      await config.deletePerson(item.id)
      setPeople((prev) => prev.filter((x) => x.id !== item.id))
    } catch {
      alert(`Failed to delete ${config.label.toLowerCase()}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold">{config.label}s</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {people.length} {config.label.toLowerCase()}{people.length !== 1 ? 's' : ''} in database
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteAllConfirm(true)}
            disabled={deletingAll}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Delete all</span>
            <span className="sm:hidden">Delete</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDupesOpen(true)}>
            <Copy className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Duplicates</span>
            <span className="sm:hidden">Dupes</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRescrapeOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Rescrape all</span>
            <span className="sm:hidden">Rescrape</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(config.schedulePath)}>
            <CalendarDays className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Schedule</span>
            <span className="sm:hidden">Schedule</span>
          </Button>
          <Button onClick={() => navigate(config.addPath)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Add {config.label.toLowerCase()}</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search by name…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {deleteAllConfirm && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="text-destructive">Delete all {people.length} {config.label.toLowerCase()}s? This cannot be undone.</span>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteAllConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deletingAll}
              onClick={async () => {
                setDeletingAll(true)
                try {
                  await config.deleteAllPeople()
                  await load()
                  setDeleteAllConfirm(false)
                } catch (e) {
                  alert(e instanceof Error ? e.message : `Failed to delete`)
                } finally {
                  setDeletingAll(false)
                }
              }}
            >
              {deletingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Delete all
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
      ) : people.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          {search ? `No ${config.label.toLowerCase()}s match "${search}"` : `No ${config.label.toLowerCase()}s yet. Add one to get started.`}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="min-w-125 px-4 md:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {config.extraColumns.map((col) => (
                    <TableHead key={col.header} className={col.className}>{col.header}</TableHead>
                  ))}
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    {config.extraColumns.map((col) => (
                      <TableCell key={col.header} className={col.className}>{col.render(item)}</TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View on Wikipedia"
                          onClick={() => window.open(item.wikipedia_url, '_blank')}
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navigate(config.detailPath(item.id))}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <DuplicatesModal
        open={dupesOpen}
        onClose={() => setDupesOpen(false)}
        onDelete={load}
        getDuplicates={config.getDuplicates}
        deletePerson={config.deletePerson}
      />
      <RescrapeModal
        open={rescrapeOpen}
        onClose={() => setRescrapeOpen(false)}
        onComplete={() => load()}
        rescrapeUrl={config.rescrapeUrl}
      />
    </div>
  )
}
