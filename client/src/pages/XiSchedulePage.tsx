import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, X, Wand2, Loader2, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getXiMatches, type XiMatchListItem } from '@/api/xi-matches'
import {
  getXiSchedule,
  assignXiDay,
  deleteXiDay,
  clearXiSchedule,
  type XiScheduleAdminEntry,
} from '@/api/xi-schedule'

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

type AutoState = 'idle' | 'running'
type ClearState = 'idle' | 'confirming' | 'running'

interface AssignModalProps {
  date: string
  matches: XiMatchListItem[]
  onAssign: (date: string, matchId: number, team: string) => Promise<void>
  onClose: () => void
}

function AssignModal({ date, matches, onAssign, onClose }: AssignModalProps) {
  const [search, setSearch] = useState('')
  const [selectedMatch, setSelectedMatch] = useState<XiMatchListItem | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = matches.filter(m => {
    const q = search.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      m.competition.toLowerCase().includes(q) ||
      m.home_team.toLowerCase().includes(q) ||
      m.away_team.toLowerCase().includes(q) ||
      String(m.year).includes(q)
    )
  })

  async function handlePickTeam(team: string) {
    if (!selectedMatch || saving) return
    setSaving(true)
    try {
      await onAssign(date, selectedMatch.id, team)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          {selectedMatch ? (
            <button
              onClick={() => setSelectedMatch(null)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <span className="text-sm font-semibold">Assign {date}</span>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!selectedMatch ? (
          <>
            <div className="px-4 py-2 border-b shrink-0">
              <input
                type="text"
                placeholder="Search matches…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-sm border border-input rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No matches found</p>
              ) : (
                filtered.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMatch(m)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-0 transition-colors"
                  >
                    <p className="text-sm font-semibold">{m.home_team} vs {m.away_team}</p>
                    <p className="text-xs text-muted-foreground">{m.competition} {m.year}</p>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="p-4 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold">{selectedMatch.home_team} vs {selectedMatch.away_team}</p>
              <p className="text-xs text-muted-foreground">{selectedMatch.competition} {selectedMatch.year}</p>
            </div>
            <p className="text-sm text-muted-foreground">Pick which team's XI to guess:</p>
            <div className="flex flex-col gap-2">
              {selectedMatch.home_team_active && (
                <Button onClick={() => handlePickTeam(selectedMatch.home_team)} disabled={saving} className="w-full justify-start">
                  {selectedMatch.home_team} (Home)
                </Button>
              )}
              {selectedMatch.away_team_active && (
                <Button onClick={() => handlePickTeam(selectedMatch.away_team)} disabled={saving} variant="outline" className="w-full justify-start">
                  {selectedMatch.away_team} (Away)
                </Button>
              )}
            </div>
            {saving && <p className="text-xs text-muted-foreground text-center">Saving…</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export function XiSchedulePage() {
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [entries, setEntries] = useState<XiScheduleAdminEntry[]>([])
  const [matches, setMatches] = useState<XiMatchListItem[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoState, setAutoState] = useState<AutoState>('idle')
  const [clearState, setClearState] = useState<ClearState>('idle')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sched, matchList] = await Promise.all([getXiSchedule(), getXiMatches()])
      setEntries(sched)
      setMatches(matchList)
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

  async function handleAssign(date: string, matchId: number, team: string) {
    await assignXiDay(date, matchId, team)
    await loadData()
    setSelectedDate(null)
  }

  async function handleUnassign(date: string) {
    await deleteXiDay(date)
    await loadData()
  }

  async function handleAutoAssign() {
    setAutoState('running')
    try {
      const scheduledKeys = new Set(
        entries
          .filter(e => e.match_id !== null && e.team !== null)
          .map(e => `${e.match_id}:${e.team}`)
      )

      const unscheduledSlots: { matchId: number; team: string }[] = []
      for (const m of matches) {
        if (m.home_team_active && !scheduledKeys.has(`${m.id}:${m.home_team}`)) {
          unscheduledSlots.push({ matchId: m.id, team: m.home_team })
        }
        if (m.away_team_active && !scheduledKeys.has(`${m.id}:${m.away_team}`)) {
          unscheduledSlots.push({ matchId: m.id, team: m.away_team })
        }
      }

      if (unscheduledSlots.length === 0) return

      // Shuffle
      for (let i = unscheduledSlots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unscheduledSlots[i], unscheduledSlots[j]] = [unscheduledSlots[j], unscheduledSlots[i]]
      }

      // Resolve consecutive same-team pairs: scan forward and swap with a later non-matching slot
      for (let i = 1; i < unscheduledSlots.length; i++) {
        if (unscheduledSlots[i].team === unscheduledSlots[i - 1].team) {
          for (let j = i + 1; j < unscheduledSlots.length; j++) {
            if (unscheduledSlots[j].team !== unscheduledSlots[i - 1].team) {
              [unscheduledSlots[i], unscheduledSlots[j]] = [unscheduledSlots[j], unscheduledSlots[i]]
              break
            }
          }
        }
      }

      const assigned = entries.filter(e => e.match_id !== null)
      const todayIso = new Date().toISOString().split('T')[0]
      const latestDate = assigned.length
        ? [...assigned].sort((a, b) => b.date.localeCompare(a.date))[0].date
        : todayIso
      const startDate = latestDate > todayIso ? addDays(latestDate, 1) : addDays(todayIso, 1)

      const assignedDates = new Set(entries.map(e => e.date))
      let offset = 0
      for (const slot of unscheduledSlots) {
        let date: string
        do { date = addDays(startDate, offset++) } while (assignedDates.has(date))
        assignedDates.add(date)
        await assignXiDay(date, slot.matchId, slot.team)
      }
    } finally {
      setAutoState('idle')
      await loadData()
    }
  }

  async function handleClearConfirm() {
    setClearState('running')
    try {
      await clearXiSchedule()
      await loadData()
    } finally {
      setClearState('idle')
    }
  }

  const entryMap = Object.fromEntries(entries.map(e => [e.date, e]))
  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate())
  const hasAnyAssigned = entries.some(e => e.match_id !== null)

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4 md:mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/elevens')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">XI Schedule</h1>
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
          <span className="text-destructive">Remove all XI assignments from the schedule?</span>
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
            const assigned = entry?.match_id != null && entry.team != null

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
                {assigned && (
                  <div className="mt-0.5 flex items-start gap-0.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs leading-tight font-semibold truncate">{entry.team}</p>
                      <p className="text-[9px] sm:text-[10px] leading-tight text-muted-foreground truncate hidden md:block">
                        {entry.year} {entry.competition}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUnassign(date) }}
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
          matches={matches}
          onAssign={handleAssign}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}
