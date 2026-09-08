import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
  Loader2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  Link2,
  Trash2,
  Plus,
} from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'
import { FootballerPicker } from '@/components/FootballerPicker'
import {
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  linkEntryPlayer,
  seedEntries,
  type OnlyPlayerEntry,
} from '@/api/only-player-admin'
import { resolvePlayer, resolvePlayerByUrl } from '@/api/record-signings-admin'

const PAGE_SIZE = 25

export function OnlyPlayerAdminPage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<OnlyPlayerEntry[]>([])
  const [total, setTotal] = useState(0)
  const [enabledCount, setEnabledCount] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  // Add-entry form
  const [showAdd, setShowAdd] = useState(false)
  const [newNat, setNewNat] = useState('')
  const [newClub, setNewClub] = useState('')
  const [newPlayer, setNewPlayer] = useState('')
  const [saving, setSaving] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback((p: number, query: string) => {
    setLoading(true)
    getEntries(p, PAGE_SIZE, query)
      .then(res => {
        setEntries(res.data)
        setTotal(res.total)
        setEnabledCount(res.enabledCount)
        setPage(res.page)
      })
      .catch(() => setError('Failed to load entries'))
      .finally(() => setLoading(false))
  }, [])

  // Debounced search (also drives the initial load with q='').
  useEffect(() => {
    const id = setTimeout(() => load(1, q), 250)
    return () => clearTimeout(id)
  }, [q, load])

  function patchLocal(id: number, patch: Partial<OnlyPlayerEntry>) {
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)))
  }

  async function handleToggle(entry: OnlyPlayerEntry, enabled: boolean) {
    patchLocal(entry.id, { enabled })
    setEnabledCount(prev => prev + (enabled ? 1 : -1))
    try {
      await updateEntry(entry.id, { enabled })
    } catch {
      patchLocal(entry.id, { enabled: !enabled })
      setEnabledCount(prev => prev + (enabled ? -1 : 1))
    }
  }

  async function handleLink(entryId: number, footballerId: number) {
    try {
      const res = await linkEntryPlayer(entryId, { footballerId })
      patchLocal(entryId, {
        footballerId: res.footballer.id,
        footballerPhoto: res.footballer.photo_url,
      })
    } catch {
      setError('Failed to link player')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this entry?')) return
    const prev = entries
    setEntries(e => e.filter(x => x.id !== id))
    setTotal(t => t - 1)
    try {
      await deleteEntry(id)
    } catch {
      setEntries(prev)
      setTotal(t => t + 1)
    }
  }

  async function handleAdd() {
    if (!newNat.trim() || !newClub.trim() || !newPlayer.trim()) return
    setSaving(true)
    try {
      await createEntry({
        nationality: newNat.trim(),
        club: newClub.trim(),
        player_name: newPlayer.trim(),
      })
      setNewNat('')
      setNewClub('')
      setNewPlayer('')
      setShowAdd(false)
      load(1, q)
    } catch {
      setError('Failed to add entry')
    } finally {
      setSaving(false)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      await seedEntries()
      load(1, q)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Only Player</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${total} entries · ${enabledCount} enabled`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAdd(v => !v)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/only-player/schedule')}>
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            Schedule
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg border bg-muted/30 p-3">
          <Input value={newNat} onChange={e => setNewNat(e.target.value)} placeholder="Nationality" />
          <Input value={newClub} onChange={e => setNewClub(e.target.value)} placeholder="Club" />
          <Input value={newPlayer} onChange={e => setNewPlayer(e.target.value)} placeholder="Player name" />
          <Button size="sm" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
          </Button>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by club, nationality or player…"
          className="pl-9"
        />
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading entries…
        </div>
      ) : total === 0 && !q ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-muted-foreground">No entries yet.</p>
          <Button size="sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Seed from list
          </Button>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">On</TableHead>
                <TableHead>Nationality</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>The only player</TableHead>
                <TableHead className="w-24 text-right">Link</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={entry.enabled}
                      onChange={e => handleToggle(entry, e.target.checked)}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <NationalityFlag nationality={entry.nationality} size={16} />
                      <span className="text-sm">{entry.nationality}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MiniClubBadge club={entry.club} wikipediaUrl={entry.clubWikiUrl} />
                      <span className="text-sm">{entry.club}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {entry.footballerPhoto && (
                        <img
                          src={entry.footballerPhoto}
                          alt={entry.playerName}
                          className="w-6 h-6 rounded-full object-cover bg-muted shrink-0"
                        />
                      )}
                      <span className="text-sm font-medium">{entry.playerName}</span>
                      {entry.period && (
                        <span className="text-xs text-muted-foreground">{entry.period}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <FootballerPicker
                      onPick={fid => handleLink(entry.id, fid)}
                      scrape={query => resolvePlayer(query, entry.club)}
                      scrapeUrl={u => resolvePlayerByUrl(u)}
                      initialQuery={entry.playerName}
                      title="Find this player in the database, or scrape by name / Wikipedia URL"
                      className={
                        entry.footballerId
                          ? 'inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700'
                          : 'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
                      }
                    >
                      {entry.footballerId ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Linked
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3.5 w-3.5" />
                          Link
                        </>
                      )}
                    </FootballerPicker>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No entries match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} entries
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => load(page - 1, q)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => load(page + 1, q)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
