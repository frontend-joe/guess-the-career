import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Check, Loader2, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NationalityFlag } from '@/components/NationalityFlag'
import {
  getNameReview,
  saveNameSplit,
  recomputeNameSplits,
  type NameReviewRow,
} from '@/api/footballers'

const PAGE_SIZE = 50
const FILTERS = [
  { key: 'ambiguous', label: 'Needs review' },
  { key: 'unconfirmed', label: 'Unconfirmed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'all', label: 'All' },
]

// Review and confirm how each player's name splits into first name + surname.
// The splitter handles particles (Del Piero, Di Matteo, van der Vaart) and
// surname-first names (Kim Min-jae); anything debatable lands here.
export function NameSplitPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<NameReviewRow[]>([])
  const [counts, setCounts] = useState({ ambiguous: 0, confirmed: 0, total: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('ambiguous')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  // Local edits keyed by footballer id.
  const [edits, setEdits] = useState<Record<number, { first: string; surname: string }>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback((p: number, f: string, query: string) => {
    setLoading(true)
    getNameReview({ filter: f, q: query, page: p, pageSize: PAGE_SIZE })
      .then(res => {
        setRows(res.data)
        setTotal(res.total)
        setCounts(res.counts)
        setPage(res.page)
        setEdits({})
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(1, filter, q), 250)
    return () => clearTimeout(t)
  }, [filter, q, load])

  function edit(row: NameReviewRow, patch: Partial<{ first: string; surname: string }>) {
    setEdits(prev => ({
      ...prev,
      [row.id]: {
        first: patch.first ?? prev[row.id]?.first ?? row.first_name ?? '',
        surname: patch.surname ?? prev[row.id]?.surname ?? row.surname ?? '',
      },
    }))
  }

  async function confirm(row: NameReviewRow) {
    const e = edits[row.id]
    const first = e?.first ?? row.first_name ?? ''
    const surname = (e?.surname ?? row.surname ?? '').trim()
    if (!surname) return
    setSavingId(row.id)
    try {
      await saveNameSplit(row.id, { first_name: first.trim() || null, surname, confirmed: true })
      // Drop it from the queue when viewing unresolved rows.
      if (filter === 'ambiguous' || filter === 'unconfirmed') {
        setRows(rs => rs.filter(r => r.id !== row.id))
        setTotal(t => Math.max(0, t - 1))
      } else {
        setRows(rs => rs.map(r => r.id === row.id
          ? { ...r, first_name: first.trim() || null, surname, name_confirmed: 1, name_ambiguous: 0 }
          : r))
      }
      setCounts(c => ({ ...c, confirmed: c.confirmed + 1, ambiguous: Math.max(0, c.ambiguous - (row.name_ambiguous ? 1 : 0)) }))
    } finally {
      setSavingId(null)
    }
  }

  async function handleRecompute() {
    setRecomputing(true)
    try {
      await recomputeNameSplits()
      load(page, filter, q)
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/footballers')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Names</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {counts.ambiguous} need review · {counts.confirmed} confirmed · {counts.total} players
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRecompute} disabled={recomputing}>
          {recomputing
            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Recompute splits
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map(f => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name…" className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead className="w-48">First name</TableHead>
                <TableHead className="w-48">Surname</TableHead>
                <TableHead>Why</TableHead>
                <TableHead className="w-24 text-right">Confirm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const e = edits[row.id]
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {row.nationality && <NationalityFlag nationality={row.nationality} size={16} />}
                        <button
                          onClick={() => navigate(`/admin/footballers/${row.id}`)}
                          className="text-sm font-medium hover:underline text-left"
                        >
                          {row.name}
                        </button>
                        {row.name_confirmed === 1 && (
                          <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={e?.first ?? row.first_name ?? ''}
                        onChange={ev => edit(row, { first: ev.target.value })}
                        placeholder="—"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={e?.surname ?? row.surname ?? ''}
                        onChange={ev => edit(row, { surname: ev.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.name_split_reason ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => confirm(row)} disabled={savingId === row.id}>
                        {savingId === row.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Check className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    {filter === 'ambiguous' ? 'Nothing left to review 🎉' : 'No players match.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} players
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => load(page - 1, filter, q)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => load(page + 1, filter, q)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
