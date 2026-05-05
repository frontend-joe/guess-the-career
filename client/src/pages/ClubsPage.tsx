import { useState, useEffect, useCallback } from 'react'
import { Search, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getAllClubs, deleteAllClubs, rebuildClubs, type Club } from '@/api/clubs'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function ClubsPage() {
  const [search, setSearch] = useState('')
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)

  const debouncedSearch = useDebounce(search, 250)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setClubs(await getAllClubs(debouncedSearch ? { search: debouncedSearch } : undefined))
    } catch {
      setError('Failed to load clubs')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { load() }, [load])

  async function handleDeleteAll() {
    setDeletingAll(true)
    try {
      await deleteAllClubs()
      await load()
      setDeleteAllConfirm(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete clubs')
    } finally {
      setDeletingAll(false)
    }
  }

  async function handleRebuild() {
    setRebuilding(true)
    try {
      const { count } = await rebuildClubs()
      await load()
      alert(`Rebuilt clubs — ${count} clubs now in database.`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to rebuild clubs')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold">Clubs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clubs.length} club{clubs.length !== 1 ? 's' : ''} in database
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteAllConfirm(true)}
            disabled={deletingAll || rebuilding}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Clear all</span>
            <span className="sm:hidden">Clear</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRebuild}
            disabled={rebuilding || deletingAll}
          >
            {rebuilding
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <RefreshCw className="h-4 w-4 mr-1.5" />
            }
            <span className="hidden sm:inline">Rebuild from footballers</span>
            <span className="sm:hidden">Rebuild</span>
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clubs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {deleteAllConfirm && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="text-destructive">Clear all {clubs.length} clubs? This cannot be undone.</span>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteAllConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deletingAll}
              onClick={handleDeleteAll}
            >
              {deletingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Clear all
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
      ) : clubs.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          {search ? `No clubs match "${search}"` : 'No clubs yet. Use "Rebuild from footballers" to populate.'}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="min-w-60 px-4 md:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Club name</TableHead>
                  <TableHead className="text-muted-foreground">Wikipedia URL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubs.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell className="font-medium">{club.name}</TableCell>
                    <TableCell className="text-sm">
                      {club.wikipedia_url
                        ? <a href={club.wikipedia_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate block max-w-xs">{club.wikipedia_url}</a>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
