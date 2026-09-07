import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'
import { getAdminCombos, setComboEnabled, type AdminCombo } from '@/api/only-player-admin'

const PAGE_SIZE = 25

export function OnlyPlayerAdminPage() {
  const navigate = useNavigate()
  const [combos, setCombos] = useState<AdminCombo[]>([])
  const [total, setTotal] = useState(0)
  const [enabledCount, setEnabledCount] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback((p: number, query: string) => {
    setLoading(true)
    getAdminCombos(p, PAGE_SIZE, query)
      .then(res => {
        setCombos(res.data)
        setTotal(res.total)
        setEnabledCount(res.enabledCount)
        setPage(res.page)
      })
      .catch(() => setError('Failed to load combos'))
      .finally(() => setLoading(false))
  }, [])

  // Debounced search (also drives the initial load with q='').
  useEffect(() => {
    const id = setTimeout(() => load(1, q), 250)
    return () => clearTimeout(id)
  }, [q, load])

  async function handleToggle(combo: AdminCombo, e: React.ChangeEvent<HTMLInputElement>) {
    const enabled = e.target.checked
    setCombos(prev =>
      prev.map(c =>
        c.nationality === combo.nationality && c.club === combo.club ? { ...c, enabled } : c
      )
    )
    setEnabledCount(prev => prev + (enabled ? 1 : -1))
    try {
      await setComboEnabled(combo.nationality, combo.club, enabled)
    } catch {
      setCombos(prev =>
        prev.map(c =>
          c.nationality === combo.nationality && c.club === combo.club ? { ...c, enabled: !enabled } : c
        )
      )
      setEnabledCount(prev => prev + (enabled ? -1 : 1))
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Only Player</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${total} single-player combos · ${enabledCount} enabled`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/only-player/schedule')}>
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

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
          Computing combos…
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {combos.map(combo => (
                <TableRow key={`${combo.nationality}|||${combo.club}`}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={combo.enabled}
                      onChange={e => handleToggle(combo, e)}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <NationalityFlag nationality={combo.nationality} size={16} />
                      <span className="text-sm">{combo.nationality}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MiniClubBadge club={combo.club} wikipediaUrl={combo.clubWikiUrl} />
                      <span className="text-sm">{combo.club}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{combo.playerName}</span>
                  </TableCell>
                </TableRow>
              ))}
              {combos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    No combos match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} combos
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
