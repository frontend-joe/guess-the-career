export interface TopScorerPlayer {
  id: number
  footballerId: number | null
  name: string
  club: string
  clubs: { name: string; wikipedia_url: string | null }[]
  goals: number
  rank: number
  nationality: string | null
  position: string | null
  clubWikipediaUrl: string | null
}

export interface TopScorerRound {
  date: string
  competitionId: number
  competitionName: string
  competitionImageUrl: string | null
  players: TopScorerPlayer[]
  playerNames: string[]
}

export interface TopScorersScheduleAdminEntry {
  id: number
  date: string
  competition_id: number | null
  created_at: string
  competition_name: string | null
  competition_image_url: string | null
}

export async function getTopScorersSchedule(): Promise<TopScorersScheduleAdminEntry[]> {
  const res = await fetch('/api/top-scorers-schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getTopScorersRounds(): Promise<TopScorerRound[]> {
  const res = await fetch('/api/top-scorers-schedule/rounds')
  if (!res.ok) throw new Error('Failed to load rounds')
  return res.json()
}

export async function assignTopScorerDay(date: string, competition_id: number): Promise<void> {
  const res = await fetch(`/api/top-scorers-schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competition_id }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteTopScorerDay(date: string): Promise<void> {
  const res = await fetch(`/api/top-scorers-schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearTopScorersSchedule(): Promise<void> {
  const res = await fetch('/api/top-scorers-schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
