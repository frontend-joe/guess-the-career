export interface InternationalLegendsScheduleAdminEntry {
  id: number
  date: string
  country: string
  created_at: string
}

export interface InternationalLegendsScheduleRound {
  date: string
  country: string
  legendCount: number
}

export async function getInternationalLegendsSchedule(): Promise<InternationalLegendsScheduleAdminEntry[]> {
  const res = await fetch('/api/international-legends/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getInternationalLegendsScheduleRounds(): Promise<InternationalLegendsScheduleRound[]> {
  const res = await fetch('/api/international-legends/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignInternationalLegendsDay(date: string, country: string): Promise<void> {
  const res = await fetch(`/api/international-legends/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteInternationalLegendsDay(date: string): Promise<void> {
  const res = await fetch(`/api/international-legends/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearInternationalLegendsSchedule(): Promise<void> {
  const res = await fetch('/api/international-legends/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
