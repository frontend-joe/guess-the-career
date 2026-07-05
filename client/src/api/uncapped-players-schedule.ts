export interface UncappedScheduleAdminEntry {
  id: number
  date: string
  nationality: string
  created_at: string
}

export interface UncappedScheduleRound {
  date: string
  nationality: string
  roundSize: number
  playerCount: number
}

export async function getUncappedSchedule(): Promise<UncappedScheduleAdminEntry[]> {
  const res = await fetch('/api/uncapped-players/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getUncappedScheduleRounds(): Promise<UncappedScheduleRound[]> {
  const res = await fetch('/api/uncapped-players/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignUncappedDay(date: string, nationality: string): Promise<void> {
  const res = await fetch(`/api/uncapped-players/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationality }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteUncappedDay(date: string): Promise<void> {
  const res = await fetch(`/api/uncapped-players/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearUncappedSchedule(): Promise<void> {
  const res = await fetch('/api/uncapped-players/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
