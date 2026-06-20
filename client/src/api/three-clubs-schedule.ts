export interface ThreeClubsScheduleAdminEntry {
  id: number
  date: string
  club_a: string
  club_b: string
  club_c: string
  created_at: string
}

export interface ThreeClubsScheduleRound {
  date: string
  clubA: string
  clubAWikiUrl: string | null
  clubB: string
  clubBWikiUrl: string | null
  clubC: string
  clubCWikiUrl: string | null
  playerCount: number
}

export async function getThreeClubsSchedule(): Promise<ThreeClubsScheduleAdminEntry[]> {
  const res = await fetch('/api/three-clubs/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getThreeClubsScheduleRounds(): Promise<ThreeClubsScheduleRound[]> {
  const res = await fetch('/api/three-clubs/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignThreeClubsDay(date: string, clubA: string, clubB: string, clubC: string): Promise<void> {
  const res = await fetch(`/api/three-clubs/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clubA, clubB, clubC }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteThreeClubsDay(date: string): Promise<void> {
  const res = await fetch(`/api/three-clubs/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearThreeClubsSchedule(): Promise<void> {
  const res = await fetch('/api/three-clubs/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
