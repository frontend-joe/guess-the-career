import { useState, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ImageDown, Loader2 } from 'lucide-react'
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

// Photo-only backfill for players missing a photo (SSE-driven, non-blocking).
function BackfillPhotosButton() {
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0, filled: 0 })
  const esRef = useRef<EventSource | null>(null)

  function start() {
    if (state === 'running') return
    setState('running')
    setProgress({ done: 0, total: 0, filled: 0 })
    const es = new EventSource('/api/footballers/backfill-photos')
    esRef.current = es
    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data)
      if (data.type === 'init') setProgress(p => ({ ...p, total: data.total }))
      else if (data.type === 'done') setProgress(p => ({ ...p, done: p.done + 1, filled: p.filled + (data.filled ? 1 : 0) }))
      else if (data.type === 'failed') setProgress(p => ({ ...p, done: p.done + 1 }))
      else if (data.type === 'complete') { es.close(); setState('done') }
    }
    es.onerror = () => { es.close(); setState('done') }
  }

  if (state === 'idle') {
    return (
      <Button variant="outline" size="sm" onClick={start} className="shrink-0">
        <ImageDown className="h-3.5 w-3.5 mr-1.5" />
        Backfill photos
      </Button>
    )
  }
  return (
    <Button variant="outline" size="sm" disabled className="shrink-0">
      {state === 'running' && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
      {state === 'running'
        ? `Photos ${progress.done}/${progress.total} (${progress.filled} filled)`
        : `Done — ${progress.filled} filled`}
    </Button>
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
        <BackfillPhotosButton />
      </>
    ),
  }

  return <PersonAdminPage config={config} />
}
