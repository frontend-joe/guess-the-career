import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { NationalityFlag } from '@/components/NationalityFlag'
import { getAdminCombos, setComboEnabled, type AdminCombo } from '@/api/nationals-admin'

export function NationalsAdminPage() {
  const navigate = useNavigate()
  const [combos, setCombos] = useState<AdminCombo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getAdminCombos()
      .then(setCombos)
      .catch(() => setError('Failed to load combos'))
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle(combo: AdminCombo, e: React.ChangeEvent<HTMLInputElement>) {
    const enabled = e.target.checked
    setCombos(prev =>
      prev.map(c =>
        c.nationality === combo.nationality && c.club === combo.club ? { ...c, enabled } : c
      )
    )
    try {
      await setComboEnabled(combo.nationality, combo.club, enabled)
    } catch {
      setCombos(prev =>
        prev.map(c =>
          c.nationality === combo.nationality && c.club === combo.club ? { ...c, enabled: !enabled } : c
        )
      )
    }
  }

  const enabledCount = combos.filter(c => c.enabled).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Nationals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${combos.length} qualifying combos · ${enabledCount} enabled`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/nationals/schedule')}>
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
          Computing combos…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">On</TableHead>
              <TableHead>Nationality</TableHead>
              <TableHead>Club</TableHead>
              <TableHead className="w-20 text-right">Players</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combos.map(combo => (
              <TableRow
                key={`${combo.nationality}|||${combo.club}`}
                className="cursor-pointer"
                onClick={() =>
                  navigate(
                    `/nationals/${encodeURIComponent(combo.nationality)}/${encodeURIComponent(combo.club)}`,
                    { state: { clubWikiUrl: combo.clubWikiUrl } }
                  )
                }
              >
                <TableCell onClick={e => e.stopPropagation()}>
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
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {combo.playerCount <= 6 && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Solid
                      </span>
                    )}
                    <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {combo.playerCount}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
