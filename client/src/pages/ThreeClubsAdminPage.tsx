import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { getAdminTrios, setTrioEnabled, type AdminTrio } from '@/api/three-clubs-admin'

export function ThreeClubsAdminPage() {
  const navigate = useNavigate()
  const [trios, setTrios] = useState<AdminTrio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getAdminTrios()
      .then(setTrios)
      .catch(() => setError('Failed to load trios'))
      .finally(() => setLoading(false))
  }, [])

  function sameTrio(a: AdminTrio, b: AdminTrio) {
    return a.clubA === b.clubA && a.clubB === b.clubB && a.clubC === b.clubC
  }

  async function handleToggle(trio: AdminTrio, e: React.ChangeEvent<HTMLInputElement>) {
    const enabled = e.target.checked
    setTrios(prev => prev.map(t => (sameTrio(t, trio) ? { ...t, enabled } : t)))
    try {
      await setTrioEnabled(trio.clubA, trio.clubB, trio.clubC, enabled)
    } catch {
      setTrios(prev => prev.map(t => (sameTrio(t, trio) ? { ...t, enabled: !enabled } : t)))
    }
  }

  const enabledCount = trios.filter(t => t.enabled).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Three Clubs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${trios.length} qualifying trios · ${enabledCount} enabled`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/three-clubs/schedule')}>
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
          Computing trios…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">On</TableHead>
              <TableHead>Club A</TableHead>
              <TableHead>Club B</TableHead>
              <TableHead>Club C</TableHead>
              <TableHead className="w-20 text-right">Players</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trios.map(trio => (
              <TableRow
                key={`${trio.clubA}|||${trio.clubB}|||${trio.clubC}`}
                className="cursor-pointer"
                onClick={() =>
                  navigate(
                    `/admin/three-clubs/${encodeURIComponent(trio.clubA)}/${encodeURIComponent(trio.clubB)}/${encodeURIComponent(trio.clubC)}`,
                    { state: { clubAWikiUrl: trio.clubAWikiUrl, clubBWikiUrl: trio.clubBWikiUrl, clubCWikiUrl: trio.clubCWikiUrl } }
                  )
                }
              >
                <TableCell onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={trio.enabled}
                    onChange={e => handleToggle(trio, e)}
                    className="h-4 w-4 cursor-pointer"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MiniClubBadge club={trio.clubA} wikipediaUrl={trio.clubAWikiUrl} />
                    <span className="text-sm">{trio.clubA}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MiniClubBadge club={trio.clubB} wikipediaUrl={trio.clubBWikiUrl} />
                    <span className="text-sm">{trio.clubB}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MiniClubBadge club={trio.clubC} wikipediaUrl={trio.clubCWikiUrl} />
                    <span className="text-sm">{trio.clubC}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {trio.playerCount}
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
