export interface SerieAScheduleAdminEntry {
  id: number
  date: string
  nationality: string
  created_at: string
}

export interface SerieAScheduleRound {
  date: string
  nationality: string
  roundSize: number
  playerCount: number
}

export async function getSerieASchedule(): Promise<SerieAScheduleAdminEntry[]> {
  const res = await fetch('/api/serie-a/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getSerieAScheduleRounds(): Promise<SerieAScheduleRound[]> {
  const res = await fetch('/api/serie-a/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignSerieADay(date: string, nationality: string): Promise<void> {
  const res = await fetch(`/api/serie-a/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationality }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteSerieADay(date: string): Promise<void> {
  const res = await fetch(`/api/serie-a/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearSerieASchedule(): Promise<void> {
  const res = await fetch('/api/serie-a/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
