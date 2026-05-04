import { ScheduleAdminPage, type ScheduleAdminConfig, type ScheduleDay, type SchedulePerson } from '@/components/ScheduleAdminPage'
import { getManagerDays, assignManagerDay, clearManagerSchedule } from '@/api/manager-days'
import { getManagers } from '@/api/managers'

const config: ScheduleAdminConfig = {
  label: 'Manager',
  backPath: '/managers',
  getDays: async (from?: string, to?: string): Promise<ScheduleDay[]> => {
    const days = await getManagerDays(from, to)
    return days.map(d => ({
      id: d.id,
      date: d.date,
      person_id: d.manager_id,
      person_name: d.manager_name,
      created_at: d.created_at,
    }))
  },
  assignDay: (date, id) => assignManagerDay(date, id).then(() => undefined),
  clearSchedule: clearManagerSchedule,
  getPeople: async (opts): Promise<SchedulePerson[]> => {
    const managers = await getManagers(opts)
    return managers.map(m => ({
      id: m.id,
      name: m.name,
      subtitle: m.place_of_birth,
    }))
  },
}

export function ManagerSchedulePage() {
  return <ScheduleAdminPage config={config} />
}
