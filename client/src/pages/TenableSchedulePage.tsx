import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, X, Wand2, Loader2, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getTenableRounds,
  getTenableSchedule,
  assignTenableDay,
  deleteTenableDay,
  clearTenableSchedule,
  autoAssignTenable,
  type TenableRound,
  type TenableScheduleEntry,
} from '@/api/tenable'

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
function firstDow(y: number, m: number) {
  const d = new Date(y, m, 1).getDay()
  return d === 0 ? 6 : d - 1
}
function AssignModal({ date, rounds, onAssign, onClose }: {
  date: string
  rounds: TenableRound[]
  onAssign: (date: string, roundId: number) => Promise<void>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const filtered = rounds.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <span className="text-sm font-semibold">Assign {date}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-2 border-b shrink-0">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rounds…"
            className="w-full text-sm border border-input rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No selected rounds. Pick some from the Tenable cards first.
            </p>
          ) : filtered.map(r => (
            <button
              key={r.id}
              disabled={saving}
              onClick={async () => { setSaving(true); try { await onAssign(date, r.id) } finally { setSaving(false) } }}
              className="w-full text-left px-4 py-2.5 hover:bg-muted/50 border-b last:border-0"
            >
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.answer_count} answers · {r.metric}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TenableSchedulePage() {
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [schedule, setSchedule] = useState<TenableScheduleEntry[]>([])
  const [rounds, setRounds] = useState<TenableRound[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [auto, setAuto] = useState(false)
  const [clearing, setClearing] = useState<'idle' | 'confirming' | 'running'>('idle')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r] = await Promise.all([getTenableSchedule(), getTenableRounds()])
      setSchedule(s)
      setRounds(r)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleAssign(date: string, roundId: number) {
    await assignTenableDay(date, roundId)
    await loadData()
    setSelectedDate(null)
  }

  async function handleAutoAssign() {
    setAuto(true)
    try {
      const r = await autoAssignTenable()
      await loadData()
      if (r.assigned) alert(`Scheduled ${r.assigned} rounds: ${r.from} → ${r.to}`)
    } finally {
      setAuto(false)
    }
  }

  const byDate = Object.fromEntries(schedule.map(s => [s.date, s]))
  const dim = daysInMonth(year, month)
  const fd = firstDow(year, month)
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate())
  const unscheduled = rounds.filter(r => !schedule.some(s => s.round_id === r.id)).length

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/tenable')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Tenable Schedule</h1>
            <p className="text-xs text-muted-foreground">
              {rounds.length} selected rounds · {unscheduled} not yet scheduled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {clearing === 'idle' && schedule.length > 0 && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
              onClick={() => setClearing('confirming')}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Clear
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleAutoAssign} disabled={auto || unscheduled === 0}>
            {auto ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
            Auto-assign
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-28 text-center">
            {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {clearing === 'confirming' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="text-destructive">Remove all Tenable assignments?</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setClearing('idle')}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={async () => {
              setClearing('running'); await clearTenableSchedule(); await loadData(); setClearing('idle')
            }}>Clear all</Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
            <div key={i} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: fd }).map((_, i) => (
            <div key={`e${i}`} className="min-h-16 md:min-h-20 border-b border-r bg-muted/20" />
          ))}
          {Array.from({ length: dim }).map((_, i) => {
            const day = i + 1
            const date = isoDate(year, month, day)
            const entry = byDate[date]
            return (
              <div key={date} onClick={() => setSelectedDate(date)}
                className={cn('min-h-16 md:min-h-20 border-b border-r p-1 md:p-1.5 cursor-pointer hover:bg-muted/50',
                  (i + fd) % 7 === 6 && 'border-r-0')}>
                <span className={cn('text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full',
                  date === todayIso ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{day}</span>
                {entry && (
                  <div className="mt-0.5 flex items-start gap-0.5">
                    <p className="flex-1 min-w-0 text-[10px] leading-tight line-clamp-3">{entry.title ?? '—'}</p>
                    <button onClick={e => { e.stopPropagation(); deleteTenableDay(date).then(loadData) }}
                      className="shrink-0 text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {loading && <p className="text-xs text-muted-foreground mt-2">Loading…</p>}

      {selectedDate && (
        <AssignModal date={selectedDate} rounds={rounds} onAssign={handleAssign}
          onClose={() => setSelectedDate(null)} />
      )}
    </div>
  )
}
