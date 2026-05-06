export interface XiMatch {
  id: number
  name: string
  wikipedia_url: string
  year: number
  competition: string
  home_team: string
  away_team: string
  home_team_active: boolean
  away_team_active: boolean
  created_at: string
}

export interface XiMatchListItem extends XiMatch {
  player_count: number
}

export interface XiPlayer {
  id: number
  match_id: number
  team: string
  name: string
  position: 'GK' | 'DF' | 'MF' | 'FW'
  squad_number: number | null
  footballer_id: number | null
  created_at: string
}

export interface XiMatchDetail {
  match: XiMatch
  homePlayers: XiPlayer[]
  awayPlayers: XiPlayer[]
}

export interface ScrapedXiPlayer {
  name: string
  position: 'GK' | 'DF' | 'MF' | 'FW'
  squadNumber: number | null
  wikipediaUrl: string | null
  footballer_id?: number | null
}

export interface MatchScrapeResult {
  matchName: string
  year: number
  competition: string
  homeTeam: string
  awayTeam: string
  homePlayers: ScrapedXiPlayer[]
  awayPlayers: ScrapedXiPlayer[]
}

export interface ImportSummary {
  added: string[]
  alreadyExisted: string[]
  failed: string[]
}

export interface CreateMatchResult {
  match: XiMatch
  importSummary: ImportSummary
}

export interface CreateMatchBody extends MatchScrapeResult {
  wikipediaUrl: string
  homeTeamActive?: boolean
  awayTeamActive?: boolean
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function getXiMatches(): Promise<XiMatchListItem[]> {
  return apiFetch('/api/xi-matches')
}

export function getXiMatch(id: number): Promise<XiMatchDetail> {
  return apiFetch(`/api/xi-matches/${id}`)
}

export function scrapeXiMatch(url: string): Promise<MatchScrapeResult> {
  return apiFetch('/api/xi-matches/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

export function createXiMatch(body: CreateMatchBody): Promise<CreateMatchResult> {
  return apiFetch('/api/xi-matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteXiMatch(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/xi-matches/${id}`, { method: 'DELETE' })
}

export function updateXiMatch(
  id: number,
  data: Partial<Pick<XiMatch, 'name' | 'year' | 'competition' | 'home_team' | 'away_team' | 'home_team_active' | 'away_team_active'>>
): Promise<XiMatch> {
  return apiFetch(`/api/xi-matches/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function replaceMatchPlayers(
  matchId: number,
  homePlayers: ScrapedXiPlayer[],
  awayPlayers: ScrapedXiPlayer[]
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/xi-matches/${matchId}/players`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ homePlayers, awayPlayers }),
  })
}

export function updateXiPlayer(
  playerId: number,
  data: Partial<Pick<XiPlayer, 'name' | 'position' | 'squad_number' | 'footballer_id'>>
): Promise<XiPlayer> {
  return apiFetch(`/api/xi-matches/players/${playerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}
