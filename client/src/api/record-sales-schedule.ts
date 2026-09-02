export interface RecordSalesScheduleAdminEntry {
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

export interface RecordSalesRound {
  date: string
  clubId: number
  club: string
  clubWikipediaUrl: string | null
  signings: RoundSigning[]
  playerNames: string[]
}

export async function getRecordSalesSchedule(): Promise<RecordSalesScheduleAdminEntry[]> {
  const res = await fetch('/api/record-sales/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getRecordSalesRounds(): Promise<RecordSalesRound[]> {
  const res = await fetch('/api/record-sales/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignRecordSalesDay(date: string, clubId: number): Promise<void> {
  const res = await fetch(`/api/record-sales/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ club_id: clubId }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteRecordSalesDay(date: string): Promise<void> {
  const res = await fetch(`/api/record-sales/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearRecordSalesSchedule(): Promise<void> {
  const res = await fetch('/api/record-sales/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
