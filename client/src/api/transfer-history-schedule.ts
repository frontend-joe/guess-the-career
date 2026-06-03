export interface TransferScheduleAdminEntry {
  id: number
  date: string
  window_id: number | null
  league: string | null
  season_label: string | null
}

export interface TransferRoundPlayer {
  id: number
  fromClub: string
  fromClubWikipediaUrl: string | null
  toClub: string
  toClubWikipediaUrl: string | null
  feeText: string
  feeValue: number | null
  playerName: string
  nationality: string | null
  position: string | null
  footballerId: number | null
  wikipediaUrl: string | null
  photoUrl: string | null
}

export interface TransferScheduleRound {
  date: string
  windowId: number
  league: string
  seasonLabel: string
  transfers: TransferRoundPlayer[]
  playerNames: string[]
}

export async function getTransferHistorySchedule(): Promise<TransferScheduleAdminEntry[]> {
  const res = await fetch('/api/transfer-history/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getTransferHistoryRounds(): Promise<TransferScheduleRound[]> {
  const res = await fetch('/api/transfer-history/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignTransferDay(date: string, windowId: number): Promise<void> {
  const res = await fetch(`/api/transfer-history/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ window_id: windowId }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteTransferDay(date: string): Promise<void> {
  const res = await fetch(`/api/transfer-history/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearTransferSchedule(): Promise<void> {
  const res = await fetch('/api/transfer-history/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
