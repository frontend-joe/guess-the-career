import { useState, useRef, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ImageDown, Loader2, BarChart3 } from 'lucide-react'
import { PersonAdminPage, type PersonAdminConfig } from '@/components/PersonAdminPage'
import { NationalityFlag } from '@/components/NationalityFlag'
import {
  getFootballers, getFootballersPaginated, deleteFootballer, deleteAllFootballers, getDuplicates, rescrapeFootballer, updateFootballer,
  type Footballer,
} from '@/api/footballers'

const BASE_COLUMNS: PersonAdminConfig<Footballer>['extraColumns'] = [
  {
    header: 'Nationality',
    className: 'hidden sm:table-cell',
    render: (f) => f.nationality
      ? (
        <div className="flex items-center gap-1.5">
          <NationalityFlag nationality={f.nationality} className="h-3.5 w-auto border border-[#ebebeb]" />
          <Badge variant="secondary">{f.nationality}</Badge>
        </div>
      )
      : <span className="text-muted-foreground">—</span>,
  },
  {
    header: 'Position',
    className: 'hidden md:table-cell text-sm text-muted-foreground',
    render: (f) => f.position ?? '—',
  },
  {
    header: 'Height',
    className: 'hidden xl:table-cell text-sm text-muted-foreground',
    render: (f) => f.height_cm ? `${f.height_cm} cm` : '—',
  },
]

interface BackfillStatus {
  type: 'photos' | 'career-stats' | null
  running: boolean
  total: number
  done: number
  updated: number
  failed: number
  currentName: string | null
  finishedAt: string | null
}

// Server-side backfill jobs (run on the server, independent of this tab / the
// Netlify proxy). Start with a POST, then poll status every 2s.
function BackfillControls() {
  const [status, setStatus] = useState<BackfillStatus | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const r = await fetch('/api/footballers/backfill/status')
      if (!r.ok) return
      const s: BackfillStatus = await r.json()
      setStatus(s)
      if (!s.running && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    } catch { /* ignore */ }
  }, [])

  const startPolling = useCallback(() => {
    if (!pollRef.current) pollRef.current = setInterval(poll, 2000)
  }, [poll])

  useEffect(() => {
    // Pick up a job already running (e.g. started from another tab).
    poll().then(() => { if (pollRef.current === null) startPolling() })
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [poll, startPolling])

  async function start(type: 'photos' | 'career-stats') {
    try {
      const r = await fetch(`/api/footballers/backfill/${type}/start`, { method: 'POST' })
      const d = await r.json()
      if (d.status) setStatus(d.status)
      startPolling()
    } catch { /* ignore */ }
  }

  async function stop() {
    try { await fetch('/api/footballers/backfill/stop', { method: 'POST' }) } catch { /* ignore */ }
    poll()
  }

  const running = !!status?.running
  const label = status?.type === 'career-stats' ? 'Career stats' : 'Photos'

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => start('photos')} disabled={running} className="shrink-0">
        <ImageDown className="h-3.5 w-3.5 mr-1.5" />
        Backfill photos
      </Button>
      <Button variant="outline" size="sm" onClick={() => start('career-stats')} disabled={running} className="shrink-0">
        <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
        Backfill career stats
      </Button>
      {running && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {label} {status!.done}/{status!.total} ({status!.updated} done)
          {status!.currentName ? ` · ${status!.currentName}` : ''}
          <button onClick={stop} className="underline ml-1">stop</button>
        </span>
      )}
      {!running && status?.finishedAt && status.total > 0 && (
        <span className="text-xs text-muted-foreground shrink-0">
          {label} done — {status.updated}/{status.total}
        </span>
      )}
    </>
  )
}

export function FootballersPage() {
  const [missingNationality, setMissingNationality] = useState(false)
  const [missingPhoto, setMissingPhoto] = useState(false)
  const [nonRetired, setNonRetired] = useState(false)
  const [missingCaps, setMissingCaps] = useState(false)
  const [singleGenericPosition, setSingleGenericPosition] = useState(false)

  const config: PersonAdminConfig<Footballer> = {
    label: 'Footballer',
    scheduleButtons: [
      { label: 'GTC Schedule', path: '/admin/footballers/schedule' },
      { label: 'SOP Schedule', path: '/admin/footballers/sop-schedule' },
    ],
    addPath: '/admin/footballers/add',
    detailPath: (id) => `/admin/footballers/${id}`,
    rescrapeUrl: '/api/footballers/rescrape-all',
    extraColumns: BASE_COLUMNS,
    getPeople: (opts) => getFootballers(opts),
    getPeoplePaged: (opts) => getFootballersPaginated({ ...opts, missingNationality, missingPhoto, nonRetired, missingCaps }),
    pageSize: 25,
    deletePerson: deleteFootballer,
    deleteAllPeople: deleteAllFootballers,
    getDuplicates,
    rescrapePerson: (id) => rescrapeFootballer(id),
    updatePhotoUrl: (id, url) => updateFootballer(id, { photo_url: url }).then(() => {}),
    updateCustomPosition: (id, val) => updateFootballer(id, { custom_position: val }).then(() => {}),
    customPositionOptions: [
      { abbr: 'GK', value: 'Goalkeeper' },
      { abbr: 'RB', value: 'Right Back' },
      { abbr: 'LB', value: 'Left Back' },
      { abbr: 'CB', value: 'Centre Back' },
      { abbr: 'DM', value: 'Defensive Midfielder' },
      { abbr: 'CM', value: 'Central Midfielder' },
      { abbr: 'AM', value: 'Attacking Midfielder' },
      { abbr: 'WG', value: 'Winger' },
      { abbr: 'ST', value: 'Striker' },
    ],
    filterPeople: singleGenericPosition
      ? (people) => people.filter(f => {
          const isGenericOrEmpty = (v: string | null) => !v || v.toLowerCase() === 'defender' || v.toLowerCase() === 'midfielder'
          return (
            (f.position?.toLowerCase() === 'defender' || f.position?.toLowerCase() === 'midfielder') &&
            !f.all_positions &&
            isGenericOrEmpty(f.custom_position)
          )
        })
      : undefined,
    extraFilters: (
      <>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer shrink-0 whitespace-nowrap">
          <input
            type="checkbox"
            checked={missingNationality}
            onChange={e => setMissingNationality(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Missing nationality
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer shrink-0 whitespace-nowrap">
          <input
            type="checkbox"
            checked={missingPhoto}
            onChange={e => setMissingPhoto(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Missing photo
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer shrink-0 whitespace-nowrap">
          <input
            type="checkbox"
            checked={nonRetired}
            onChange={e => setNonRetired(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Non-retired
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer shrink-0 whitespace-nowrap">
          <input
            type="checkbox"
            checked={missingCaps}
            onChange={e => setMissingCaps(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Missing caps
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer shrink-0 whitespace-nowrap">
          <input
            type="checkbox"
            checked={singleGenericPosition}
            onChange={e => setSingleGenericPosition(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Single Defender/Midfielder
        </label>
        <BackfillControls />
      </>
    ),
  }

  return <PersonAdminPage config={config} />
}
