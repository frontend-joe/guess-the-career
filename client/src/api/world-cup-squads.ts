export interface WorldCupPlayer {
  id: number
  name: string
  shirt_number: number | null
  position: 'GK' | 'DF' | 'MF' | 'FW' | null
  club: string
  clubs: { name: string; wikipedia_url: string | null }[]
  nationality: string | null
}

export interface WorldCupRound {
  date: string
  squadId: number
  year: number
  team: string
  players: WorldCupPlayer[]
  playerNames: string[]
}

export interface WorldCupScheduleAdminEntry {
  id: number
  date: string
  squad_id: number | null
  created_at: string
  squad_year: number | null
  squad_team: string | null
}

export interface WorldCupSquadListItem {
  id: number
  year: number
  team: string
  wikipedia_url: string
  created_at: string
}

export interface WorldCupScrapedPlayer {
  shirt_number: number | null
  position: string | null
  name: string
  club: string
  wikipedia_url: string | null
}

export interface WorldCupScrapedSquad {
  team: string
  players: WorldCupScrapedPlayer[]
}

export async function getWorldCupSchedule(): Promise<WorldCupScheduleAdminEntry[]> {
  const res = await fetch('/api/world-cup-schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getWorldCupRounds(): Promise<WorldCupRound[]> {
  const res = await fetch('/api/world-cup-schedule/rounds')
  if (!res.ok) throw new Error('Failed to load rounds')
  return res.json()
}

export async function assignWorldCupDay(date: string, squad_id: number): Promise<void> {
  const res = await fetch(`/api/world-cup-schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ squad_id }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteWorldCupDay(date: string): Promise<void> {
  const res = await fetch(`/api/world-cup-schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearWorldCupSchedule(): Promise<void> {
  const res = await fetch('/api/world-cup-schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}

export async function getWorldCupSquads(): Promise<WorldCupSquadListItem[]> {
  const res = await fetch('/api/world-cup-squads')
  if (!res.ok) throw new Error('Failed to load squads')
  return res.json()
}

export async function scrapeWorldCupSquads(url: string): Promise<{ year: number; squads: WorldCupScrapedSquad[] }> {
  const res = await fetch('/api/world-cup-squads/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Scrape failed')
  return data
}

export async function checkWorldCupPlayers(
  players: { name: string; wikipedia_url?: string | null }[]
): Promise<{ name: string; in_db: boolean; footballer_id: number | null }[]> {
  const res = await fetch('/api/world-cup-squads/check-players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ players }),
  })
  if (!res.ok) throw new Error('Failed to check players')
  return res.json()
}

export async function importWorldCupSquads(payload: {
  year: number
  wikipedia_url: string
  squads: WorldCupScrapedSquad[]
}): Promise<{ ok: boolean; imported: number }> {
  const res = await fetch('/api/world-cup-squads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Import failed')
  return data
}

export async function refreshWorldCupSquad(id: number): Promise<{ updated: number }> {
  const res = await fetch(`/api/world-cup-squads/${id}/refresh`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Refresh failed')
  return data
}

export async function deleteWorldCupSquad(id: number): Promise<void> {
  const res = await fetch(`/api/world-cup-squads/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete')
}
