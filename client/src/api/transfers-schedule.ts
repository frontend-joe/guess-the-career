export interface TransfersScheduleAdminEntry {
  id: number
  date: string
  from_club: string
  to_club: string
  created_at: string
}

export interface TransfersScheduleRound {
  date: string
  fromClub: string
  fromClubWikiUrl: string | null
  toClub: string
  toClubWikiUrl: string | null
  playerCount: number
}

export async function getTransfersSchedule(): Promise<TransfersScheduleAdminEntry[]> {
  const res = await fetch('/api/transfers/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getTransfersScheduleRounds(): Promise<TransfersScheduleRound[]> {
  const res = await fetch('/api/transfers/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignTransfersDay(date: string, fromClub: string, toClub: string): Promise<void> {
  const res = await fetch(`/api/transfers/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromClub, toClub }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteTransfersDay(date: string): Promise<void> {
  const res = await fetch(`/api/transfers/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearTransfersSchedule(): Promise<void> {
  const res = await fetch('/api/transfers/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
