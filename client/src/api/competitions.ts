export interface CompetitionListItem {
  id: number
  name: string
  wikipedia_url: string
  image_url: string | null
  created_at: string
}

export interface CompetitionScrapeResult {
  name: string
  topScorers: { name: string; wikipediaUrl: string; club: string; goals: number; rank: number }[]
  hatTricks: { name: string; wikipediaUrl: string; forClub: string; againstClub: string }[]
  topAssists: { name: string; wikipediaUrl: string; club: string; assists: number; rank: number }[]
  playerOfSeason: { name: string; wikipediaUrl: string } | null
  managerOfSeason: { name: string; wikipediaUrl: string } | null
  pfaTeamOfYear: {
    name: string
    wikipediaUrl: string | null
    position: 'GK' | 'DF' | 'MF' | 'FW'
    squadNumber: number
  }[]
}

export interface ImportSummary {
  footballers: { added: string[]; alreadyExisted: string[]; failed: string[] }
  manager: 'added' | 'existed' | 'none' | 'failed'
}

export interface ImportResult {
  competition: CompetitionListItem
  importSummary: ImportSummary
}

export async function getCompetitions(): Promise<CompetitionListItem[]> {
  const res = await fetch('/api/competitions')
  if (!res.ok) throw new Error('Failed to fetch competitions')
  return res.json()
}

export interface CheckResult {
  footballers: { name: string; url: string; exists: boolean }[]
  managerExists: boolean | null
}

export async function checkCompetition(
  footballerEntries: { name: string; url: string }[],
  managerUrl?: string,
  managerName?: string,
): Promise<CheckResult> {
  const res = await fetch('/api/competitions/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ footballers: footballerEntries, managerUrl, managerName }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Check failed')
  return data
}

export async function scrapeCompetition(url: string): Promise<CompetitionScrapeResult> {
  const res = await fetch('/api/competitions/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Scrape failed')
  return data
}

export async function importCompetition(
  wikipediaUrl: string,
  data: CompetitionScrapeResult
): Promise<ImportResult> {
  const res = await fetch('/api/competitions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wikipediaUrl, ...data }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Import failed')
  return json
}

export interface CompetitionDetail {
  competition: CompetitionListItem & {
    player_of_season_id: number | null
    manager_of_season_id: number | null
    pfa_toty_match_id: number | null
    image_url: string | null
  }
  topScorers: { id: number; name: string; club: string; goals: number; rank: number; footballer_name: string | null; photo_url: string | null }[]
  hatTricks: { id: number; name: string; for_club: string; against_club: string; footballer_name: string | null; photo_url: string | null }[]
  topAssists: { id: number; name: string; club: string; assists: number; rank: number; footballer_name: string | null; photo_url: string | null }[]
  playerOfSeason: { id: number; name: string; photo_url: string | null } | null
  managerOfSeason: { id: number; name: string; photo_url: string | null } | null
}

export async function getCompetition(id: number): Promise<CompetitionDetail> {
  const res = await fetch(`/api/competitions/${id}`)
  if (!res.ok) throw new Error('Failed to fetch competition')
  return res.json()
}

export async function patchCompetition(id: number, data: { image_url?: string | null }): Promise<void> {
  const res = await fetch(`/api/competitions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update competition')
}

export async function rescrapeCompetition(id: number): Promise<void> {
  const res = await fetch(`/api/competitions/${id}/rescrape`, { method: 'POST' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Rescrape failed')
}

export async function deleteCompetition(id: number): Promise<void> {
  const res = await fetch(`/api/competitions/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete competition')
}
