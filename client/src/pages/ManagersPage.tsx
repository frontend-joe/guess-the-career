import { PersonAdminPage, type PersonAdminConfig } from '@/components/PersonAdminPage'
import {
  getManagers, deleteManager, deleteAllManagers, getManagerDuplicates,
  type Manager,
} from '@/api/managers'

const config: PersonAdminConfig<Manager> = {
  label: 'Manager',
  scheduleButtons: [{ label: 'Schedule', path: '/managers/schedule' }],
  addPath: '/managers/add',
  detailPath: (id) => `/managers/${id}`,
  rescrapeUrl: '/api/managers/rescrape-all',
  extraColumns: [
    {
      header: 'Place of birth',
      className: 'hidden sm:table-cell text-sm text-muted-foreground',
      render: (m) => m.place_of_birth ?? '—',
    },
    {
      header: 'Born',
      className: 'hidden md:table-cell text-sm text-muted-foreground',
      render: (m) => m.born ?? '—',
    },
  ],
  getPeople: (opts) => getManagers(opts),
  deletePerson: deleteManager,
  deleteAllPeople: deleteAllManagers,
  getDuplicates: getManagerDuplicates,
}

export function ManagersPage() {
  return <PersonAdminPage config={config} />
}
