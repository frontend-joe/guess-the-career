import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { PersonAdminPage, type PersonAdminConfig } from '@/components/PersonAdminPage'
import { NationalityFlag } from '@/components/NationalityFlag'
import {
  getFootballers, deleteFootballer, deleteAllFootballers, getDuplicates, rescrapeFootballer, updateFootballer,
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
    header: 'All Positions',
    className: 'hidden lg:table-cell text-sm text-muted-foreground',
    render: (f) => f.all_positions ?? '—',
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

  const config: PersonAdminConfig<Footballer> = {
    label: 'Footballer',
    schedulePath: '/footballers/schedule',
    addPath: '/footballers/add',
    detailPath: (id) => `/footballers/${id}`,
    rescrapeUrl: '/api/footballers/rescrape-all',
    extraColumns: BASE_COLUMNS,
    getPeople: (opts) => getFootballers(opts),
    deletePerson: deleteFootballer,
    deleteAllPeople: deleteAllFootballers,
    getDuplicates,
    rescrapePerson: (id) => rescrapeFootballer(id),
    updatePhotoUrl: (id, url) => updateFootballer(id, { photo_url: url }).then(() => {}),
    filterPeople: (missingNationality || missingPhoto)
      ? (people) => people.filter(f =>
          (!missingNationality || !f.nationality) &&
          (!missingPhoto || !f.photo_url)
        )
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
      </>
    ),
  }

  return <PersonAdminPage config={config} />
}
