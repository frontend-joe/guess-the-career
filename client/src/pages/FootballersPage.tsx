import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
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

export function FootballersPage() {
  const [missingNationality, setMissingNationality] = useState(false)
  const [missingPhoto, setMissingPhoto] = useState(false)
  const [singleGenericPosition, setSingleGenericPosition] = useState(false)

  const config: PersonAdminConfig<Footballer> = {
    label: 'Footballer',
    scheduleButtons: [
      { label: 'GTC Schedule', path: '/footballers/schedule' },
      { label: 'SOP Schedule', path: '/footballers/sop-schedule' },
    ],
    addPath: '/footballers/add',
    detailPath: (id) => `/footballers/${id}`,
    rescrapeUrl: '/api/footballers/rescrape-all',
    extraColumns: BASE_COLUMNS,
    getPeople: (opts) => getFootballers(opts),
    getPeoplePaged: (opts) => getFootballersPaginated({ ...opts, missingNationality, missingPhoto }),
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
            checked={singleGenericPosition}
            onChange={e => setSingleGenericPosition(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Single Defender/Midfielder
        </label>
      </>
    ),
  }

  return <PersonAdminPage config={config} />
}
