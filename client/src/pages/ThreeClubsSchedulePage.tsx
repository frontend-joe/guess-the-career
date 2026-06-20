import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, X, Wand2, Loader2, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getAdminTrios, type AdminTrio } from '@/api/three-clubs-admin'
import {
  getThreeClubsSchedule,
  assignThreeClubsDay,
  deleteThreeClubsDay,
  clearThreeClubsSchedule,
  type ThreeClubsScheduleAdminEntry,
} from '@/api/three-clubs-schedule'
import { MiniClubBadge } from '@/components/MiniClubBadge'

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

function trioKey(a: string, b: string, c: string): string {
  return [a, b, c].sort((x, y) => x.localeCompare(y)).join('|||')
}

type AutoState = 'idle' | 'running'
type ClearState = 'idle' | 'confirming' | 'running'
type CleanupState = 'idle' | 'confirming' | 'running'

interface AssignModalProps {
  date: string
  trios: AdminTrio[]
  onAssign: (date: string, clubA: string, clubB: string, clubC: string) => Promise<void>
  onClose: () => void
}

function AssignModal({ date, trios, onAssign, onClose }: AssignModalProps) {
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = trios.filter(t => {
    const q = search.toLowerCase()
    return t.clubA.toLowerCase().includes(q) || t.clubB.toLowerCase().includes(q) || t.clubC.toLowerCase().includes(q)
  })

  // Enabled trios first
  const sorted = [...filtered].sort((a, b) => {
    if (a.enabled && !b.enabled) return -1
    if (!a.enabled && b.enabled) return 1
    return b.playerCount - a.playerCount
  })

  async function handlePick(trio: AdminTrio) {
    if (saving) return
    setSaving(true)
    try {
      await onAssign(date, trio.clubA, trio.clubB, trio.clubC)
    } finally {
      setSaving(false)
    }
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
        <div className="px-4 py-2 border-b shrink-0">
          <input
            type="text"
            placeholder="Search clubs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-input rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No trios found</p>
          ) : (
            sorted.map(trio => (
              <button
                key={`${trio.clubA}|||${trio.clubB}|||${trio.clubC}`}
                onClick={() => handlePick(trio)}
                disabled={saving}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-0 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <MiniClubBadge club={trio.clubA} wikipediaUrl={trio.clubAWikiUrl} />
                  <MiniClubBadge club={trio.clubB} wikipediaUrl={trio.clubBWikiUrl} />
                  <MiniClubBadge club={trio.clubC} wikipediaUrl={trio.clubCWikiUrl} />
                  <span className="text-xs font-medium truncate ml-1">{trio.clubA} · {trio.clubB} · {trio.clubC}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">{trio.playerCount}</span>
                  {trio.enabled && <span className="text-xs text-green-600 font-medium shrink-0">●</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function ThreeClubsSchedulePage() {
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [entries, setEntries] = useState<ThreeClubsScheduleAdminEntry[]>([])
  const [trios, setTrios] = useState<AdminTrio[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoState, setAutoState] = useState<AutoState>('idle')
  const [clearState, setClearState] = useState<ClearState>('idle')
  const [cleanupState, setCleanupState] = useState<CleanupState>('idle')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sched, trioList] = await Promise.all([getThreeClubsSchedule(), getAdminTrios()])
      setEntries(sched)
      setTrios(trioList)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  async function handleAssign(date: string, clubA: string, clubB: string, clubC: string) {
    await assignThreeClubsDay(date, clubA, clubB, clubC)
    await loadData()
    setSelectedDate(null)
  }

  async function handleUnassign(date: string) {
    await deleteThreeClubsDay(date)
    await loadData()
  }

  async function handleAutoAssign() {
    setAutoState('running')
    try {
      const enabledTrios = trios.filter(t => t.enabled)
      if (enabledTrios.length === 0) return

      const scheduledKeys = new Set(entries.map(e => trioKey(e.club_a, e.club_b, e.club_c)))
      const unscheduled = enabledTrios.filter(t => !scheduledKeys.has(trioKey(t.clubA, t.clubB, t.clubC)))

      if (unscheduled.length === 0) return

      // Shuffle
      for (let i = unscheduled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unscheduled[i], unscheduled[j]] = [unscheduled[j], unscheduled[i]]
      }

      const todayIso = new Date().toISOString().split('T')[0]
      const assigned = entries
      const latestDate = assigned.length
        ? [...assigned].sort((a, b) => b.date.localeCompare(a.date))[0].date
        : todayIso
      const startDate = latestDate >= todayIso ? addDays(latestDate, 1) : addDays(todayIso, 1)

      const assignedDates = new Set(entries.map(e => e.date))
      let offset = 0
      for (const trio of unscheduled) {
        let date: string
        do { date = addDays(startDate, offset++) } while (assignedDates.has(date))
        assignedDates.add(date)
        await assignThreeClubsDay(date, trio.clubA, trio.clubB, trio.clubC)
      }
    } finally {
      setAutoState('idle')
      await loadData()
    }
  }

  async function handleClearConfirm() {
    setClearState('running')
    try {
      await clearThreeClubsSchedule()
      await loadData()
    } finally {
      setClearState('idle')
    }
  }

  async function handleCleanupConfirm() {
    setCleanupState('running')
    try {
      const enabledKeys = new Set(trios.filter(t => t.enabled).map(t => trioKey(t.clubA, t.clubB, t.clubC)))
      const toRemove = entries.filter(e => !enabledKeys.has(trioKey(e.club_a, e.club_b, e.club_c)))
      for (const entry of toRemove) {
        await deleteThreeClubsDay(entry.date)
      }
    } finally {
      setCleanupState('idle')
      await loadData()
    }
  }

  const entryMap = Object.fromEntries(entries.map(e => [e.date, e]))
  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate())
  const hasAnyAssigned = entries.length > 0
  const hasEnabledTrios = trios.some(t => t.enabled)
  const enabledKeys = new Set(trios.filter(t => t.enabled).map(t => trioKey(t.clubA, t.clubB, t.clubC)))
  const deactivatedEntries = hasEnabledTrios
    ? entries.filter(e => !enabledKeys.has(trioKey(e.club_a, e.club_b, e.club_c)))
    : []

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4 md:mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/three-clubs')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">Three Clubs Schedule</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {cleanupState === 'idle' && clearState === 'idle' && autoState === 'idle' && deactivatedEntries.length > 0 && (
            <Button variant="outline" size="sm" className="text-orange-600 hover:text-orange-700" onClick={() => setCleanupState('confirming')}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Cleanup ({deactivatedEntries.length})
            </Button>
          )}
          {cleanupState === 'running' && (
            <Button variant="outline" size="sm" disabled>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Cleaning…
            </Button>
          )}
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

      {cleanupState === 'confirming' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
          <span className="text-orange-700">Remove {deactivatedEntries.length} de-activated trio{deactivatedEntries.length !== 1 ? 's' : ''} from the schedule?</span>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setCleanupState('idle')}>Cancel</Button>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleCleanupConfirm}>Remove</Button>
          </div>
        </div>
      )}
      {clearState === 'confirming' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="text-destructive">Remove all Three Clubs assignments?</span>
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
            const assigned = !!entry

            return (
              <div
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'min-h-14 md:min-h-20 border-b border-r p-1 md:p-1.5 cursor-pointer transition-colors',
                  'hover:bg-muted/50',
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
                      <p className="text-[10px] sm:text-xs leading-tight font-semibold truncate">{entry.club_a}</p>
                      <p className="text-[9px] sm:text-[10px] leading-tight text-muted-foreground truncate hidden md:block">{entry.club_b} · {entry.club_c}</p>
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
          trios={trios}
          onAssign={handleAssign}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}
