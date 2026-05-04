import { Badge } from '@/components/ui/badge'
import { PersonAdminPage, type PersonAdminConfig } from '@/components/PersonAdminPage'
import {
  getFootballers, deleteFootballer, deleteAllFootballers, getDuplicates,
  type Footballer,
} from '@/api/footballers'

const config: PersonAdminConfig<Footballer> = {
  label: 'Footballer',
  schedulePath: '/footballers/schedule',
  addPath: '/footballers/add',
  detailPath: (id) => `/footballers/${id}`,
  rescrapeUrl: '/api/footballers/rescrape-all',
  extraColumns: [
    {
      header: 'Nationality',
      className: 'hidden sm:table-cell',
      render: (f) => f.nationality
        ? <Badge variant="secondary">{f.nationality}</Badge>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      header: 'Position',
      className: 'hidden md:table-cell text-sm text-muted-foreground',
      render: (f) => f.position ?? '—',
    },
    {
      header: 'Born',
      className: 'hidden md:table-cell text-sm text-muted-foreground',
      render: (f) => f.born ?? '—',
    },
  ],
  getPeople: (opts) => getFootballers(opts),
  deletePerson: deleteFootballer,
  deleteAllPeople: deleteAllFootballers,
  getDuplicates,
}

export function FootballersPage() {
  return <PersonAdminPage config={config} />
}
