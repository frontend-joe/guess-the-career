export interface BallonDorPlayer {
  id: number
  name: string
  club: string
  clubs: { name: string; wikipedia_url: string | null }[]
  points: number | null
  rank: number
  nationality: string | null
  position: 'GK' | 'DF' | 'MF' | 'FW' | null
}

export interface BallonDorRound {
  date: string
  ballonDorId: number
  year: number
  players: BallonDorPlayer[]
  playerNames: string[]
}

export interface BallonDorScheduleAdminEntry {
  id: number
  date: string
  ballon_dor_id: number | null
  created_at: string
  ballon_dor_year: number | null
}

export interface BallonDorListItem {
  id: number
  year: number
  wikipedia_url: string
  created_at: string
}

export async function getBallonDorSchedule(): Promise<BallonDorScheduleAdminEntry[]> {
  const res = await fetch('/api/ballon-dor-schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getBallonDorRounds(): Promise<BallonDorRound[]> {
  const res = await fetch('/api/ballon-dor-schedule/rounds')
  if (!res.ok) throw new Error('Failed to load rounds')
  return res.json()
}

export async function assignBallonDorDay(date: string, ballon_dor_id: number): Promise<void> {
  const res = await fetch(`/api/ballon-dor-schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ballon_dor_id }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteBallonDorDay(date: string): Promise<void> {
  const res = await fetch(`/api/ballon-dor-schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearBallonDorSchedule(): Promise<void> {
  const res = await fetch('/api/ballon-dor-schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}

export async function getBallonDors(): Promise<BallonDorListItem[]> {
  const res = await fetch('/api/ballon-dors')
  if (!res.ok) throw new Error('Failed to load Ballon d\'Or list')
  return res.json()
}

export interface BallonDorScrapedPlayer {
  rank: number
  name: string
  nationality: string | null
  club: string
  points: number | null
  wikipedia_url: string | null
}

export async function scrapeBallonDor(url: string): Promise<{ year: number; players: BallonDorScrapedPlayer[] }> {
  const res = await fetch('/api/ballon-dors/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Scrape failed')
  return data
}

export async function checkBallonDorPlayers(
  players: { name: string; wikipedia_url?: string | null }[]
): Promise<{ name: string; in_db: boolean; footballer_id: number | null }[]> {
  const res = await fetch('/api/ballon-dors/check-players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ players }),
  })
  if (!res.ok) throw new Error('Failed to check players')
  return res.json()
}

export async function importBallonDor(payload: {
  year: number
  wikipedia_url: string
  players: BallonDorScrapedPlayer[]
}): Promise<BallonDorListItem> {
  const res = await fetch('/api/ballon-dors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { message?: string }).message ?? 'Import failed')
  return data
}

export async function deleteBallonDor(id: number): Promise<void> {
  const res = await fetch(`/api/ballon-dors/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete')
}
