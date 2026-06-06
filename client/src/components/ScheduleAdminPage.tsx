import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, X, Wand2, Loader2, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DayAssignModal } from '@/components/DayAssignModal'

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

export interface ScheduleDay {
  id: number
  date: string
  person_id: number | null
  person_name: string | null
  created_at: string
}

export interface SchedulePerson {
  id: number
  name: string
  subtitle?: string | null
}

export interface ScheduleAdminConfig {
  label: string
  backPath: string
  getDays: (from?: string, to?: string) => Promise<ScheduleDay[]>
  assignDay: (date: string, id: number | null) => Promise<void>
  clearSchedule: () => Promise<void>
  getPeople: (opts?: { unassigned?: boolean; excludeDate?: string }) => Promise<SchedulePerson[]>
}

type AutoState = 'idle' | 'running'
type ClearState = 'idle' | 'confirming' | 'running'

export function ScheduleAdminPage({ config }: { config: ScheduleAdminConfig }) {
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [days, setDays] = useState<ScheduleDay[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalPeople, setModalPeople] = useState<SchedulePerson[]>([])
  const [loadingModal, setLoadingModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [autoState, setAutoState] = useState<AutoState>('idle')
  const [clearState, setClearState] = useState<ClearState>('idle')

  // Load the full schedule (all dates) so the calendar and the table below both
  // reflect every assignment, not just the current month.
  const loadDays = useCallback(async () => {
    setLoading(true)
    try {
      setDays(await config.getDays())
    } catch {
      // keep previous data
    } finally {
      setLoading(false)
    }
  }, [config])

  useEffect(() => { loadDays() }, [loadDays])

  useEffect(() => {
    if (!selectedDate) { setModalPeople([]); return }
    setLoadingModal(true)
    config.getPeople({ unassigned: true, excludeDate: selectedDate })
      .then(setModalPeople)
      .catch(() => setModalPeople([]))
      .finally(() => setLoadingModal(false))
  }, [selectedDate, config])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  async function handleAutoAssign() {
    setAutoState('running')
    try {
      const [unassigned, allDays] = await Promise.all([
        config.getPeople({ unassigned: true }),
        config.getDays(),
      ])
      if (!unassigned.length) return
      for (let i = unassigned.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unassigned[i], unassigned[j]] = [unassigned[j], unassigned[i]]
      }
      const assigned = allDays.filter(d => d.person_id !== null)
      const earliestDate = assigned.length
        ? assigned.sort((a, b) => a.date.localeCompare(b.date))[0].date
        : new Date().toISOString().split('T')[0]
      const endDate = addDays(earliestDate, -1)
      for (let i = 0; i < unassigned.length; i++) {
        await config.assignDay(addDays(endDate, -(unassigned.length - 1 - i)), unassigned[i].id)
      }
    } finally {
      setAutoState('idle')
      await loadDays()
    }
  }

  async function handleClearConfirm() {
    setClearState('running')
    try {
      await config.clearSchedule()
      await loadDays()
    } finally {
      setClearState('idle')
    }
  }

  const dayMap = Object.fromEntries(days.map(d => [d.date, d]))
  const assignedDays = days
    .filter(d => d.person_id !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate())
  const selectedDay = selectedDate ? dayMap[selectedDate] ?? null : null

  async function handleAssign(date: string, id: number | null) {
    await config.assignDay(date, id)
    await loadDays()
    setSelectedDate(null)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(config.backPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">{config.label} Schedule</h1>
        </div>
        <div className="flex items-center gap-2">
          {clearState === 'idle' && autoState === 'idle' && days.some(d => d.person_id !== null) && (
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
          <span className="text-destructive">
            Remove all {config.label.toLowerCase()} assignments from the schedule?
          </span>
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
              <span className="hidden md:inline">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
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
            const entry = dayMap[date]
            const isToday = date === todayIso

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
                <span
                  className={cn(
                    'text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full',
                    isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  )}
                >
                  {day}
                </span>
                {entry?.person_name && (
                  <div className="mt-0.5 flex items-start gap-0.5">
                    <span className="text-[10px] sm:text-xs leading-tight truncate flex-1">
                      {entry.person_name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAssign(date, null) }}
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

      {/* Full schedule as a flat table (every date, chronological) */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold mb-2">
          Full schedule
          <span className="text-muted-foreground font-normal"> ({assignedDays.length})</span>
        </h2>
        {assignedDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium w-16">#</th>
                    <th className="text-left px-3 py-1.5 font-medium w-32">Date</th>
                    <th className="text-left px-3 py-1.5 font-medium">{config.label}</th>
                    <th className="px-3 py-1.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {assignedDays.map((d, i) => {
                    const isPast = d.date < todayIso
                    const isToday = d.date === todayIso
                    return (
                      <tr key={d.id} className={cn('border-t', isPast && 'text-muted-foreground')}>
                        <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                          {d.date}
                          {isToday && <span className="ml-2 text-[10px] font-semibold text-primary uppercase">Today</span>}
                        </td>
                        <td className="px-3 py-1.5 font-medium">{d.person_name}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() => handleAssign(d.date, null)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedDate && (
        <DayAssignModal
          date={selectedDate}
          currentId={selectedDay?.person_id ?? null}
          people={modalPeople}
          label={config.label}
          loading={loadingModal}
          onAssign={handleAssign}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}
