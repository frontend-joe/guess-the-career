export interface ScrapedSigning {
  player_name: string
  nationality: string | null
  position: string | null
  from_club: string
  fee_text: string
  fee_value: number | null
  season_label: string
  /** When set, link the signing to this existing footballer instead of resolving by name. */
  footballer_id?: number | null
}

export interface CheckedSigning extends ScrapedSigning {
  in_db: boolean
  footballer_id: number | null
  from_club_matched: boolean
}

export interface RecordSigningsScrapeResult {
  club: string
  transfermarkt_id: string | null
  source_url: string
  signings: CheckedSigning[]
}

export interface RecordSigningsClubListItem {
  id: number
  club: string
  club_wikipedia_url: string | null
  source_url: string
  active: boolean
  created_at: string
  player_count: number
  unlinked_count: number
}

export interface ImportSummary {
  // Players already in the DB, linked immediately.
  linked: number
  // New players queued for background Wikipedia scraping + linking.
  queued: number
}

export interface ImportResult {
  club: Omit<RecordSigningsClubListItem, 'player_count'>
  importSummary: ImportSummary
}

export interface ImportBody {
  club: string
  club_wikipedia_url?: string | null
  transfermarkt_id?: string | null
  source_url: string
  signings: ScrapedSigning[]
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function scrapeRecordSignings(url: string): Promise<RecordSigningsScrapeResult> {
  return apiFetch('/api/record-signings/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

export function importRecordSignings(body: ImportBody): Promise<ImportResult> {
  return apiFetch('/api/record-signings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getRecordSigningsClubs(): Promise<RecordSigningsClubListItem[]> {
  return apiFetch('/api/record-signings/clubs')
}

export function updateRecordSigningsClub(
  id: number,
  data: Partial<Pick<RecordSigningsClubListItem, 'active' | 'club'>>,
): Promise<RecordSigningsClubListItem> {
  return apiFetch(`/api/record-signings/clubs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteRecordSigningsClub(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/record-signings/clubs/${id}`, { method: 'DELETE' })
}

export function resolvePlayer(name: string, club?: string): Promise<{ id: number; name: string }> {
  return apiFetch('/api/record-signings/resolve-player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, club }),
  })
}

// Scrape + create a footballer from an exact Wikipedia article URL.
export function resolvePlayerByUrl(url: string): Promise<{ id: number; name: string }> {
  return apiFetch('/api/record-signings/resolve-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

export interface DetailSigning {
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
  linked: boolean
}

export interface RecordSigningsClubDetail {
  club: Omit<RecordSigningsClubListItem, 'player_count'>
  signings: DetailSigning[]
}

export function getRecordSigningsClubDetail(id: number): Promise<RecordSigningsClubDetail> {
  return apiFetch(`/api/record-signings/clubs/${id}`)
}

export function updateSigning(
  id: number,
  data: { from_club?: string; footballer_id?: number | null },
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/record-signings/signings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export interface RelinkResult {
  ok: boolean
  queued: number
}

export function relinkRecordSigningsClub(id: number): Promise<RelinkResult> {
  return apiFetch(`/api/record-signings/clubs/${id}/relink`, { method: 'POST' })
}
