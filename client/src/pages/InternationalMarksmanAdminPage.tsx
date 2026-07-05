import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, CalendarDays, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PositionBadge } from '@/components/PositionBadge'
import { Button } from '@/components/ui/button'
import { NationalityFlag } from '@/components/NationalityFlag'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import {
  getAdminCountries,
  getCountryPlayers,
  setCountryEnabled,
  type AdminCountry,
  type InternationalMarksmanPlayer,
} from '@/api/international-marksman-admin'

const PAGE_SIZE = 25

export function InternationalMarksmanAdminPage() {
  const navigate = useNavigate()
  const [countries, setCountries] = useState<AdminCountry[]>([])
  const [total, setTotal] = useState(0)
  const [enabledCount, setEnabledCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [playersByCountry, setPlayersByCountry] = useState<Record<string, InternationalMarksmanPlayer[]>>({})
  const [playersLoading, setPlayersLoading] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback((p: number) => {
    setLoading(true)
    setExpanded(null)
    getAdminCountries(p, PAGE_SIZE)
      .then(res => {
        setCountries(res.data)
        setTotal(res.total)
        setEnabledCount(res.enabledCount)
        setPage(res.page)
      })
      .catch(() => setError('Failed to load countries'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(1) }, [load])

  function toggleExpand(country: string) {
    if (expanded === country) { setExpanded(null); return }
    setExpanded(country)
    if (!playersByCountry[country]) {
      setPlayersLoading(country)
      getCountryPlayers(country)
        .then(players => setPlayersByCountry(prev => ({ ...prev, [country]: players })))
        .catch(() => setPlayersByCountry(prev => ({ ...prev, [country]: [] })))
        .finally(() => setPlayersLoading(null))
    }
  }

  async function handleToggle(country: AdminCountry, e: React.ChangeEvent<HTMLInputElement>) {
    const enabled = e.target.checked
    setCountries(prev => prev.map(c => (c.country === country.country ? { ...c, enabled } : c)))
    setEnabledCount(prev => prev + (enabled ? 1 : -1))
    try {
      await setCountryEnabled(country.country, enabled)
    } catch {
      setCountries(prev => prev.map(c => (c.country === country.country ? { ...c, enabled: !enabled } : c)))
      setEnabledCount(prev => prev + (enabled ? -1 : 1))
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">International Marksman</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${total} qualifying countries · ${enabledCount} enabled`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/international-marksman/schedule')}>
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
          Schedule
        </Button>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing countries…
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">On</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="w-36 text-right">Marksmen (25+ goals)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {countries.map(country => (
                <Fragment key={country.country}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => toggleExpand(country.country)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={country.enabled}
                        onChange={e => handleToggle(country, e)}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded === country.country ? 'rotate-180' : ''}`}
                        />
                        <NationalityFlag nationality={country.country} size={18} />
                        <span className="text-sm font-medium">{country.country}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {country.marksmanCount}
                      </span>
                    </TableCell>
                  </TableRow>
                  {expanded === country.country && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="bg-muted/30 p-0">
                        {playersLoading === country.country ? (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading players…
                          </div>
                        ) : (
                          <ul className="divide-y">
                            {(playersByCountry[country.country] ?? []).map(p => (
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
                                {p.position && <PositionBadge position={p.position} />}
                                {p.years && <span className="text-xs text-muted-foreground">{p.years}</span>}
                                <span className="ml-auto text-sm font-semibold tabular-nums">{p.goals}</span>
                                <span className="text-xs text-muted-foreground">goals</span>
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

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} countries
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
