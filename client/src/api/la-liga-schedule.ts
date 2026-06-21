export interface LaLigaScheduleAdminEntry {
  id: number
  date: string
  nationality: string
  created_at: string
}

export interface LaLigaScheduleRound {
  date: string
  nationality: string
  roundSize: number
  playerCount: number
}

export async function getLaLigaSchedule(): Promise<LaLigaScheduleAdminEntry[]> {
  const res = await fetch('/api/la-liga/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getLaLigaScheduleRounds(): Promise<LaLigaScheduleRound[]> {
  const res = await fetch('/api/la-liga/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignLaLigaDay(date: string, nationality: string): Promise<void> {
  const res = await fetch(`/api/la-liga/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationality }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteLaLigaDay(date: string): Promise<void> {
  const res = await fetch(`/api/la-liga/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearLaLigaSchedule(): Promise<void> {
  const res = await fetch('/api/la-liga/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
