import { ScheduleAdminPage, type ScheduleAdminConfig, type ScheduleDay, type SchedulePerson } from '@/components/ScheduleAdminPage'
import { getDays, assignDay, clearSchedule } from '@/api/days'
import { getFootballers } from '@/api/footballers'

const config: ScheduleAdminConfig = {
  label: 'Footballer',
  backPath: '/footballers',
  getDays: async (from?: string, to?: string): Promise<ScheduleDay[]> => {
    const days = await getDays(from, to)
    return days.map(d => ({
      id: d.id,
      date: d.date,
      person_id: d.footballer_id,
      person_name: d.footballer_name,
      created_at: d.created_at,
    }))
  },
  assignDay: (date, id) => assignDay(date, id).then(() => undefined),
  clearSchedule,
  getPeople: async (opts): Promise<SchedulePerson[]> => {
    const footballers = await getFootballers(opts)
    return footballers.map(f => ({
      id: f.id,
      name: f.name,
      subtitle: f.nationality,
    }))
  },
}

export function FootballerSchedulePage() {
  return <ScheduleAdminPage config={config} />
}
