export interface Club {
  id: number
  name: string
  wikipedia_url: string | null
  home_body: string | null
  home_leftarm: string | null
  home_rightarm: string | null
  home_shorts: string | null
  home_socks: string | null
  home_pattern: string | null  // 'stripes' | 'hoops' | 'halves' | 'sash' | 'sleeves' | null
}

export interface ClubOption {
  id: number
  name: string
}

// Autocomplete search (max 10) for pickers.
export async function searchClubs(q: string): Promise<ClubOption[]> {
  if (!q.trim()) return []
  const res = await fetch(`/api/clubs?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('Failed to search clubs')
  return res.json()
}

export async function getAllClubs(opts?: { search?: string }): Promise<Club[]> {
  const params = new URLSearchParams()
  if (opts?.search) params.set('q', opts.search)
  const res = await fetch(`/api/clubs/all?${params}`)
  if (!res.ok) throw new Error('Failed to fetch clubs')
  return res.json()
}

export async function deleteAllClubs(): Promise<void> {
  const res = await fetch('/api/clubs', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete clubs')
}

export async function rebuildClubs(): Promise<{ count: number }> {
  const res = await fetch('/api/clubs/rebuild', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to rebuild clubs')
  return res.json()
}

export async function scrapeKits(ids?: number[]): Promise<{ updated: number; skipped: number }> {
  const res = await fetch('/api/clubs/scrape-kits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
  })
  if (!res.ok) throw new Error('Failed to scrape kits')
  return res.json()
}

export async function updateClubKit(
  id: number,
  data: Partial<Pick<Club, 'home_body' | 'home_leftarm' | 'home_rightarm' | 'home_shorts' | 'home_socks' | 'home_pattern'>>
): Promise<Club> {
  const res = await fetch(`/api/clubs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update club kit')
  return res.json()
}

export interface ClubSeason {
  season: string
  season_year: number
  division_raw: string
  league: string
}

export async function getClubSeasons(id: number): Promise<ClubSeason[]> {
  const res = await fetch(`/api/clubs/${id}/seasons`)
  if (!res.ok) throw new Error('Failed to load club seasons')
  return res.json()
}

export interface BackfillStatus {
  type: string | null
  running: boolean
  total: number
  done: number
  updated: number
  failed: number
  currentName: string | null
  error: string | null
  failures: { name: string; message: string }[]
}

export async function startClubSeasonsBackfill(all = false): Promise<void> {
  const res = await fetch(`/api/footballers/backfill/club-seasons/start${all ? '?all=true' : ''}`, { method: 'POST' })
  if (!res.ok && res.status !== 409) throw new Error('Failed to start backfill')
}

export async function getBackfillStatus(): Promise<BackfillStatus> {
  const res = await fetch('/api/footballers/backfill/status')
  if (!res.ok) throw new Error('Failed to load backfill status')
  return res.json()
}
