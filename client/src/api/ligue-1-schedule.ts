export interface Ligue1ScheduleAdminEntry {
  id: number
  date: string
  nationality: string
  created_at: string
}

export interface Ligue1ScheduleRound {
  date: string
  nationality: string
  roundSize: number
  playerCount: number
}

export async function getLigue1Schedule(): Promise<Ligue1ScheduleAdminEntry[]> {
  const res = await fetch('/api/ligue-1/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getLigue1ScheduleRounds(): Promise<Ligue1ScheduleRound[]> {
  const res = await fetch('/api/ligue-1/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignLigue1Day(date: string, nationality: string): Promise<void> {
  const res = await fetch(`/api/ligue-1/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationality }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteLigue1Day(date: string): Promise<void> {
  const res = await fetch(`/api/ligue-1/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearLigue1Schedule(): Promise<void> {
  const res = await fetch('/api/ligue-1/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
