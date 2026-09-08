export interface OnlyPlayerScheduleAdminEntry {
  id: number
  date: string
  entry_id: number | null
  nationality: string | null
  club: string | null
  player_name: string | null
}

export interface OnlyPlayerRoundPlayer {
  name: string
  footballerId: number | null
  photoUrl: string | null
  position: string | null
  period: string | null
  apps: number | null
}

export interface OnlyPlayerScheduleRound {
  date: string
  entryId: number
  nationality: string
  club: string
  clubWikiUrl: string | null
  player: OnlyPlayerRoundPlayer
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

export async function assignOnlyPlayerDay(date: string, entryId: number): Promise<void> {
  const res = await fetch(`/api/only-player/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryId }),
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
