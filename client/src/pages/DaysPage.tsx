import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getDays, assignDay, type Day } from '@/api/days'
import { getFootballers, type Footballer } from '@/api/footballers'
import { DayAssignModal } from '@/components/DayAssignModal'

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1  // Monday = 0
}

export function DaysPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [days, setDays] = useState<Day[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalFootballers, setModalFootballers] = useState<Footballer[]>([])
  const [loadingModal, setLoadingModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const monthStart = isoDate(year, month, 1)
  const monthEnd = isoDate(year, month, getDaysInMonth(year, month))

  const loadDays = useCallback(async () => {
    setLoading(true)
    try {
      setDays(await getDays(monthStart, monthEnd))
    } catch {
      // keep previous data
    } finally {
      setLoading(false)
    }
  }, [monthStart, monthEnd])

  useEffect(() => { loadDays() }, [loadDays])

  useEffect(() => {
    if (!selectedDate) { setModalFootballers([]); return }
    setLoadingModal(true)
    getFootballers({ unassigned: true, excludeDate: selectedDate })
      .then(setModalFootballers)
      .catch(() => setModalFootballers([]))
      .finally(() => setLoadingModal(false))
  }, [selectedDate])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const dayMap = Object.fromEntries(days.map(d => [d.date, d]))
  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate())

  const selectedDay = selectedDate ? dayMap[selectedDate] ?? null : null

  async function handleAssign(date: string, footballer_id: number | null) {
    await assignDay(date, footballer_id)
    await loadDays()
    setSelectedDate(null)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-xl font-semibold">Schedule</h1>
        <div className="flex items-center gap-1 md:gap-2">
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

      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="py-1.5 md:py-2 text-center text-xs font-medium text-muted-foreground">
              <span className="md:hidden">{d}</span>
              <span className="hidden md:inline">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {/* Empty leading cells */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-14 md:min-h-20 border-b border-r last:border-r-0 bg-muted/20" />
          ))}

          {/* Day cells */}
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
                {entry?.footballer_name && (
                  <div className="mt-0.5 flex items-start gap-0.5">
                    <span className="text-[10px] sm:text-xs leading-tight truncate flex-1">
                      {entry.footballer_name}
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

      {selectedDate && (
        <DayAssignModal
          date={selectedDate}
          current={selectedDay}
          footballers={modalFootballers}
          loading={loadingModal}
          onAssign={handleAssign}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}
