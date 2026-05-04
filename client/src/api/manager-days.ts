export interface ManagerDay {
  id: number
  date: string
  manager_id: number | null
  manager_name: string | null
  created_at: string
}

export async function getManagerDays(from?: string, to?: string): Promise<ManagerDay[]> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  const res = await fetch(`/api/manager-days${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to fetch manager days')
  return res.json()
}

export async function assignManagerDay(date: string, manager_id: number | null): Promise<ManagerDay> {
  const res = await fetch(`/api/manager-days/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manager_id }),
  })
  if (!res.ok) throw new Error('Failed to assign manager day')
  return res.json()
}

export async function clearManagerSchedule(): Promise<void> {
  const res = await fetch('/api/manager-days', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear manager schedule')
}
