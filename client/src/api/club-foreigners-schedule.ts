export interface ClubForeignersScheduleAdminEntry {
  id: number
  date: string
  club: string
  created_at: string
}

export interface ClubForeignersScheduleRound {
  date: string
  club: string
  clubWikiUrl: string | null
  foreignerCount: number
  roundSize: number
}

export async function getClubForeignersSchedule(): Promise<ClubForeignersScheduleAdminEntry[]> {
  const res = await fetch('/api/club-foreigners/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getClubForeignersScheduleRounds(): Promise<ClubForeignersScheduleRound[]> {
  const res = await fetch('/api/club-foreigners/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignClubForeignersDay(date: string, club: string): Promise<void> {
  const res = await fetch(`/api/club-foreigners/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ club }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteClubForeignersDay(date: string): Promise<void> {
  const res = await fetch(`/api/club-foreigners/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearClubForeignersSchedule(): Promise<void> {
  const res = await fetch('/api/club-foreigners/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
