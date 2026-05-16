export interface TwoClubsScheduleAdminEntry {
  id: number
  date: string
  club_a: string
  club_b: string
  created_at: string
}

export interface TwoClubsScheduleRound {
  date: string
  clubA: string
  clubAWikiUrl: string | null
  clubB: string
  clubBWikiUrl: string | null
  playerCount: number
}

export async function getTwoClubsSchedule(): Promise<TwoClubsScheduleAdminEntry[]> {
  const res = await fetch('/api/two-clubs/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getTwoClubsScheduleRounds(): Promise<TwoClubsScheduleRound[]> {
  const res = await fetch('/api/two-clubs/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignTwoClubsDay(date: string, clubA: string, clubB: string): Promise<void> {
  const res = await fetch(`/api/two-clubs/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clubA, clubB }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteTwoClubsDay(date: string): Promise<void> {
  const res = await fetch(`/api/two-clubs/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearTwoClubsSchedule(): Promise<void> {
  const res = await fetch('/api/two-clubs/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
