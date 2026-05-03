import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Search, Trash2, Eye, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getFootballers, deleteFootballer, type Footballer } from '@/api/footballers'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function FootballersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [footballers, setFootballers] = useState<Footballer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const debouncedSearch = useDebounce(search, 250)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setFootballers(await getFootballers(debouncedSearch ? { search: debouncedSearch } : undefined))
    } catch {
      setError('Failed to load footballers')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { load() }, [load])

  async function handleDelete(f: Footballer) {
    if (!confirm(`Delete ${f.name}? This cannot be undone.`)) return
    setDeletingId(f.id)
    try {
      await deleteFootballer(f.id)
      setFootballers((prev) => prev.filter((x) => x.id !== f.id))
    } catch {
      alert('Failed to delete footballer')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold">Footballers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {footballers.length} footballer{footballers.length !== 1 ? 's' : ''} in database
          </p>
        </div>
        <Button onClick={() => navigate('/footballers/add')} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          <span className="hidden sm:inline">Add footballer</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
      ) : footballers.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          {search ? `No footballers match "${search}"` : 'No footballers yet. Add one to get started.'}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="min-w-125 px-4 md:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Nationality</TableHead>
                  <TableHead className="hidden md:table-cell">Position</TableHead>
                  <TableHead className="hidden md:table-cell">Born</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {footballers.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <div>{f.name}</div>
                      {/* Show nationality inline on small screens */}
                      <div className="sm:hidden text-xs text-muted-foreground mt-0.5">{f.nationality ?? ''}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {f.nationality
                        ? <Badge variant="secondary">{f.nationality}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{f.position ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{f.born ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View on Wikipedia"
                          onClick={() => window.open(f.wikipedia_url, '_blank')}
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navigate(`/footballers/${f.id}`)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(f)}
                          disabled={deletingId === f.id}
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
    </div>
  )
}
