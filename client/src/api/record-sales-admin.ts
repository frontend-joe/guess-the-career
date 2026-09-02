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

export interface RecordSalesScrapeResult {
  club: string
  transfermarkt_id: string | null
  source_url: string
  signings: CheckedSigning[]
}

export interface RecordSalesClubListItem {
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
  club: Omit<RecordSalesClubListItem, 'player_count'>
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

export function scrapeRecordSales(url: string): Promise<RecordSalesScrapeResult> {
  return apiFetch('/api/record-sales/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

export function importRecordSales(body: ImportBody): Promise<ImportResult> {
  return apiFetch('/api/record-sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getRecordSalesClubs(): Promise<RecordSalesClubListItem[]> {
  return apiFetch('/api/record-sales/clubs')
}

export function updateRecordSalesClub(
  id: number,
  data: Partial<Pick<RecordSalesClubListItem, 'active' | 'club'>>,
): Promise<RecordSalesClubListItem> {
  return apiFetch(`/api/record-sales/clubs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteRecordSalesClub(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/record-sales/clubs/${id}`, { method: 'DELETE' })
}

export function resolvePlayer(name: string, club?: string): Promise<{ id: number; name: string }> {
  return apiFetch('/api/record-sales/resolve-player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, club }),
  })
}

// Scrape + create a footballer from an exact Wikipedia article URL.
export function resolvePlayerByUrl(url: string): Promise<{ id: number; name: string }> {
  return apiFetch('/api/record-sales/resolve-url', {
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

export interface RecordSalesClubDetail {
  club: Omit<RecordSalesClubListItem, 'player_count'>
  signings: DetailSigning[]
}

export function getRecordSalesClubDetail(id: number): Promise<RecordSalesClubDetail> {
  return apiFetch(`/api/record-sales/clubs/${id}`)
}

export function updateSigning(
  id: number,
  data: { from_club?: string; footballer_id?: number | null },
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/record-sales/signings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export interface RelinkResult {
  ok: boolean
  queued: number
}

export function relinkRecordSalesClub(id: number): Promise<RelinkResult> {
  return apiFetch(`/api/record-sales/clubs/${id}/relink`, { method: 'POST' })
}
