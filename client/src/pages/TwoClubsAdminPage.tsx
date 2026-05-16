import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { getAdminPairs, setPairEnabled, type AdminPair } from '@/api/two-clubs-admin'

export function TwoClubsAdminPage() {
  const navigate = useNavigate()
  const [pairs, setPairs] = useState<AdminPair[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getAdminPairs()
      .then(setPairs)
      .catch(() => setError('Failed to load pairs'))
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle(pair: AdminPair, e: React.ChangeEvent<HTMLInputElement>) {
    const enabled = e.target.checked
    setPairs(prev =>
      prev.map(p =>
        p.clubA === pair.clubA && p.clubB === pair.clubB ? { ...p, enabled } : p
      )
    )
    try {
      await setPairEnabled(pair.clubA, pair.clubB, enabled)
    } catch {
      // revert on error
      setPairs(prev =>
        prev.map(p =>
          p.clubA === pair.clubA && p.clubB === pair.clubB ? { ...p, enabled: !enabled } : p
        )
      )
    }
  }

  const enabledCount = pairs.filter(p => p.enabled).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Two Clubs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${pairs.length} qualifying pairs · ${enabledCount} enabled`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/two-clubs/schedule')}>
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing pairs…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">On</TableHead>
              <TableHead>Club A</TableHead>
              <TableHead>Club B</TableHead>
              <TableHead className="w-20 text-right">Players</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pairs.map(pair => (
              <TableRow
                key={`${pair.clubA}|||${pair.clubB}`}
                className="cursor-pointer"
                onClick={() =>
                  navigate(
                    `/two-clubs/${encodeURIComponent(pair.clubA)}/${encodeURIComponent(pair.clubB)}`,
                    { state: { clubAWikiUrl: pair.clubAWikiUrl, clubBWikiUrl: pair.clubBWikiUrl } }
                  )
                }
              >
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
                    <MiniClubBadge club={pair.clubA} wikipediaUrl={pair.clubAWikiUrl} />
                    <span className="text-sm">{pair.clubA}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MiniClubBadge club={pair.clubB} wikipediaUrl={pair.clubBWikiUrl} />
                    <span className="text-sm">{pair.clubB}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {pair.playerCount}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
