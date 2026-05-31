export interface ClubLegendsScheduleAdminEntry {
  id: number
  date: string
  club: string
  created_at: string
}

export interface ClubLegendsScheduleRound {
  date: string
  club: string
  clubWikiUrl: string | null
  legendCount: number
}

export async function getClubLegendsSchedule(): Promise<ClubLegendsScheduleAdminEntry[]> {
  const res = await fetch('/api/club-legends/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getClubLegendsScheduleRounds(): Promise<ClubLegendsScheduleRound[]> {
  const res = await fetch('/api/club-legends/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignClubLegendsDay(date: string, club: string): Promise<void> {
  const res = await fetch(`/api/club-legends/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ club }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteClubLegendsDay(date: string): Promise<void> {
  const res = await fetch(`/api/club-legends/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearClubLegendsSchedule(): Promise<void> {
  const res = await fetch('/api/club-legends/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
