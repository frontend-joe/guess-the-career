import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { NationalityFlag } from '@/components/NationalityFlag'
import {
  getCandidates,
  setIncluded,
  type DualNationalityCandidate,
} from '@/api/dual-nationality'

export function DualNationalityAdminPage() {
  const [players, setPlayers] = useState<DualNationalityCandidate[]>([])
  const [includedCount, setIncludedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getCandidates()
      .then((res) => { setPlayers(res.data); setIncludedCount(res.includedCount) })
      .catch(() => setError('Failed to load candidates'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(p: DualNationalityCandidate, included: boolean) {
    setPlayers((prev) => prev.map((x) => (x.footballerId === p.footballerId ? { ...x, included } : x)))
    setIncludedCount((n) => n + (included ? 1 : -1))
    try {
      await setIncluded(p.footballerId, included)
    } catch {
      setPlayers((prev) => prev.map((x) => (x.footballerId === p.footballerId ? { ...x, included: !included } : x)))
      setIncludedCount((n) => n + (included ? -1 : 1))
    }
  }

  const filtered = players.filter((p) => {
    if (!search.trim()) return true
    const t = search.toLowerCase()
    return p.name.toLowerCase().includes(t) || p.nations.some((n) => n.name.toLowerCase().includes(t))
  })

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-6 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Dual Nationality</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${players.length} candidates · ${includedCount} in game`}
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by player or nation…"
          className="text-sm border border-input rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Computing candidates…
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {filtered.map((p) => (
            <label key={p.footballerId} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
              <input
                type="checkbox"
                checked={p.included}
                onChange={(e) => toggle(p, e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-primary shrink-0"
                title="Include in the game"
              />
              <span className="text-sm font-medium flex-1 min-w-0 truncate">{p.name}</span>
              <span className="flex items-center gap-2 shrink-0">
                {p.nations.map((n, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <NationalityFlag nationality={n.name} size={16} />
                    <span className="text-xs text-muted-foreground">
                      {n.name}{n.years ? ` ${n.years}` : ''}
                    </span>
                  </span>
                ))}
              </span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No candidates found.</p>
          )}
        </div>
      )}
    </div>
  )
}
