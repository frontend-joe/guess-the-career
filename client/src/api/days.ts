export interface Day {
  id: number
  date: string
  footballer_id: number | null
  footballer_name: string | null
  created_at: string
}

export async function getDays(from?: string, to?: string): Promise<Day[]> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  const res = await fetch(`/api/days${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to fetch days')
  return res.json()
}

export async function assignDay(date: string, footballer_id: number | null): Promise<Day> {
  const res = await fetch(`/api/days/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ footballer_id }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to assign day')
  return json
}

export async function deleteDay(date: string): Promise<void> {
  const res = await fetch(`/api/days/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}
