import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, X, Wand2, Loader2, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getWorldCupSquads,
  getWorldCupSchedule,
  assignWorldCupDay,
  deleteWorldCupDay,
  clearWorldCupSchedule,
  type WorldCupScheduleAdminEntry,
  type WorldCupSquadListItem,
} from '@/api/world-cup-squads'

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

interface AssignModalProps {
  date: string
  squads: WorldCupSquadListItem[]
  onAssign: (date: string, squadId: number) => Promise<void>
  onClose: () => void
}

function AssignModal({ date, squads, onAssign, onClose }: AssignModalProps) {
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = squads.filter(s =>
    `${s.team} ${s.year}`.toLowerCase().includes(search.toLowerCase())
  )

  async function handlePick(item: WorldCupSquadListItem) {
    if (saving) return
    setSaving(true)
    try { await onAssign(date, item.id) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <span className="text-sm font-semibold">Assign {date}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3 py-2 border-b shrink-0">
          <input
            type="text"
            placeholder="Search team or year…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-input rounded px-2 py-1 outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No squads found</p>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                onClick={() => handlePick(item)}
                disabled={saving}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-0 transition-colors"
              >
                <p className="text-sm font-medium">{item.team} <span className="text-muted-foreground font-normal">{item.year}</span></p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function WorldCupSchedulePage() {
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [entries, setEntries] = useState<WorldCupScheduleAdminEntry[]>([])
  const [squads, setSquads] = useState<WorldCupSquadListItem[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoState, setAutoState] = useState<'idle' | 'running'>('idle')
  const [clearState, setClearState] = useState<'idle' | 'confirming' | 'running'>('idle')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sched, sq] = await Promise.all([getWorldCupSchedule(), getWorldCupSquads()])
      setEntries(sched)
      setSquads(sq)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  async function handleAssign(date: string, squadId: number) {
    await assignWorldCupDay(date, squadId)
    await loadData()
    setSelectedDate(null)
  }

  async function handleUnassign(date: string) {
    await deleteWorldCupDay(date)
    await loadData()
  }

  async function handleAutoAssign() {
    setAutoState('running')
    try {
      const todayIso = new Date().toISOString().split('T')[0]

      // Squads already shown (scheduled on a past/today date) stay put.
      const doneSquadIds = new Set(
        entries.filter(e => e.squad_id !== null && e.date <= todayIso).map(e => e.squad_id!)
      )

      // Everything not yet shown, in chronological order (year then team). We
      // repack the whole upcoming schedule each time so newly-added squads slot
      // into their correct chronological position rather than being appended.
      const toSchedule = squads
        .filter(s => !doneSquadIds.has(s.id))
        .sort((a, b) => a.year !== b.year ? a.year - b.year : a.team.localeCompare(b.team))
      if (toSchedule.length === 0) return

      const startDate = addDays(todayIso, 1)
      const targetDates = toSchedule.map((_, i) => addDays(startDate, i))
      for (let i = 0; i < toSchedule.length; i++) {
        await assignWorldCupDay(targetDates[i], toSchedule[i].id)
      }

      // Remove any stale future entries left beyond the repacked range.
      const lastDate = targetDates[targetDates.length - 1]
      for (const e of entries.filter(e => e.date > lastDate)) {
        await deleteWorldCupDay(e.date)
      }
    } finally {
      setAutoState('idle')
      await loadData()
    }
  }

  async function handleClearConfirm() {
    setClearState('running')
    try { await clearWorldCupSchedule(); await loadData() }
    finally { setClearState('idle') }
  }

  const entryMap = Object.fromEntries(entries.map(e => [e.date, e]))
  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate())
  const hasAnyAssigned = entries.some(e => e.squad_id !== null)

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4 md:mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/world-cup')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">World Cup Schedule</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {clearState === 'idle' && autoState === 'idle' && hasAnyAssigned && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setClearState('confirming')}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear schedule
            </Button>
          )}
          {clearState === 'running' && (
            <Button variant="outline" size="sm" disabled>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Clearing…
            </Button>
          )}
          {autoState === 'idle' ? (
            <Button variant="outline" size="sm" onClick={handleAutoAssign} disabled={clearState !== 'idle'}>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Auto-assign
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Assigning…
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8 md:h-9 md:w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-28 text-center">
            {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8 md:h-9 md:w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {clearState === 'confirming' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="text-destructive">Remove all World Cup squad assignments from the schedule?</span>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setClearState('idle')}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleClearConfirm}>Clear all</Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="py-1.5 md:py-2 text-center text-xs font-medium text-muted-foreground">
              <span className="md:hidden">{d}</span>
              <span className="hidden md:inline">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-14 md:min-h-20 border-b border-r last:border-r-0 bg-muted/20" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const date = isoDate(year, month, day)
            const entry = entryMap[date]
            const isToday = date === todayIso
            const assigned = entry?.squad_id != null

            return (
              <div
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'min-h-14 md:min-h-20 border-b border-r p-1 md:p-1.5 cursor-pointer transition-colors hover:bg-muted/50',
                  (i + firstDow) % 7 === 6 && 'border-r-0'
                )}
              >
                <span className={cn(
                  'text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full',
                  isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}>
                  {day}
                </span>
                {assigned && (
                  <div className="mt-0.5 flex items-start gap-0.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs leading-tight font-semibold truncate">
                        {entry.squad_team}
                      </p>
                      <p className="text-[9px] text-muted-foreground leading-tight">
                        {entry.squad_year}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleUnassign(date) }}
                      className="shrink-0 text-muted-foreground hover:text-destructive mt-px"
                      title="Remove"
                    >
                      <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
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
        <AssignModal
          date={selectedDate}
          squads={squads}
          onAssign={handleAssign}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}
