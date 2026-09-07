export interface OnlyPlayerScheduleAdminEntry {
  id: number
  date: string
  nationality: string
  club: string
  created_at: string
}

export interface OnlyPlayerScheduleRound {
  date: string
  nationality: string
  club: string
  clubWikiUrl: string | null
  playerCount: number
}

export async function getOnlyPlayerSchedule(): Promise<OnlyPlayerScheduleAdminEntry[]> {
  const res = await fetch('/api/only-player/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getOnlyPlayerScheduleRounds(): Promise<OnlyPlayerScheduleRound[]> {
  const res = await fetch('/api/only-player/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignOnlyPlayerDay(date: string, nationality: string, club: string): Promise<void> {
  const res = await fetch(`/api/only-player/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationality, club }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteOnlyPlayerDay(date: string): Promise<void> {
  const res = await fetch(`/api/only-player/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearOnlyPlayerSchedule(): Promise<void> {
  const res = await fetch('/api/only-player/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
