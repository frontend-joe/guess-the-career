export interface ForeignersScheduleAdminEntry {
  id: number
  date: string
  nationality: string
  created_at: string
}

export interface ForeignersScheduleRound {
  date: string
  nationality: string
  roundSize: number
  playerCount: number
}

export async function getForeignersSchedule(): Promise<ForeignersScheduleAdminEntry[]> {
  const res = await fetch('/api/foreigners/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getForeignersScheduleRounds(): Promise<ForeignersScheduleRound[]> {
  const res = await fetch('/api/foreigners/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignForeignersDay(date: string, nationality: string): Promise<void> {
  const res = await fetch(`/api/foreigners/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationality }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteForeignersDay(date: string): Promise<void> {
  const res = await fetch(`/api/foreigners/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearForeignersSchedule(): Promise<void> {
  const res = await fetch('/api/foreigners/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
