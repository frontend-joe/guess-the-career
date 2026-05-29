export interface NationalsScheduleAdminEntry {
  id: number
  date: string
  nationality: string
  club: string
  created_at: string
}

export interface NationalsScheduleRound {
  date: string
  nationality: string
  club: string
  clubWikiUrl: string | null
  playerCount: number
}

export async function getNationalsSchedule(): Promise<NationalsScheduleAdminEntry[]> {
  const res = await fetch('/api/nationals/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getNationalsScheduleRounds(): Promise<NationalsScheduleRound[]> {
  const res = await fetch('/api/nationals/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignNationalsDay(date: string, nationality: string, club: string): Promise<void> {
  const res = await fetch(`/api/nationals/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationality, club }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteNationalsDay(date: string): Promise<void> {
  const res = await fetch(`/api/nationals/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearNationalsSchedule(): Promise<void> {
  const res = await fetch('/api/nationals/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
