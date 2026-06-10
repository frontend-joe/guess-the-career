export interface ClubMarksmanScheduleAdminEntry {
  id: number
  date: string
  club: string
  created_at: string
}

export interface ClubMarksmanScheduleRound {
  date: string
  club: string
  clubWikiUrl: string | null
  marksmanCount: number
}

export async function getClubMarksmanSchedule(): Promise<ClubMarksmanScheduleAdminEntry[]> {
  const res = await fetch('/api/club-marksman/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getClubMarksmanScheduleRounds(): Promise<ClubMarksmanScheduleRound[]> {
  const res = await fetch('/api/club-marksman/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignClubMarksmanDay(date: string, club: string): Promise<void> {
  const res = await fetch(`/api/club-marksman/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ club }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteClubMarksmanDay(date: string): Promise<void> {
  const res = await fetch(`/api/club-marksman/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearClubMarksmanSchedule(): Promise<void> {
  const res = await fetch('/api/club-marksman/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
