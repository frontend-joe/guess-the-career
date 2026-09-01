export interface RecordSigningsScheduleAdminEntry {
  id: number
  date: string
  club_id: number | null
  club: string | null
}

export interface RoundSigning {
  id: number
  fromClub: string
  fromClubWikipediaUrl: string | null
  feeText: string
  feeValue: number | null
  seasonLabel: string | null
  playerName: string
  nationality: string | null
  position: string | null
  footballerId: number | null
  wikipediaUrl: string | null
  photoUrl: string | null
}

export interface RecordSigningsRound {
  date: string
  clubId: number
  club: string
  clubWikipediaUrl: string | null
  signings: RoundSigning[]
  playerNames: string[]
}

export async function getRecordSigningsSchedule(): Promise<RecordSigningsScheduleAdminEntry[]> {
  const res = await fetch('/api/record-signings/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getRecordSigningsRounds(): Promise<RecordSigningsRound[]> {
  const res = await fetch('/api/record-signings/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignRecordSigningsDay(date: string, clubId: number): Promise<void> {
  const res = await fetch(`/api/record-signings/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ club_id: clubId }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteRecordSigningsDay(date: string): Promise<void> {
  const res = await fetch(`/api/record-signings/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearRecordSigningsSchedule(): Promise<void> {
  const res = await fetch('/api/record-signings/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
