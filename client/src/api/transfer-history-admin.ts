export interface ScrapedTransfer {
  player_name: string
  nationality: string | null
  position: string | null
  from_club: string
  to_club: string
  fee_text: string
  fee_value: number | null
  /** When set, link the transfer to this existing footballer instead of resolving by name. */
  footballer_id?: number | null
}

export interface CheckedTransfer extends ScrapedTransfer {
  in_db: boolean
  footballer_id: number | null
  from_club_matched: boolean
  to_club_matched: boolean
}

export interface TransferScrapeResult {
  league: string
  league_code: string
  season_id: number
  season_label: string
  source_url: string
  transfers: CheckedTransfer[]
}

export interface TransferWindowListItem {
  id: number
  league: string
  league_code: string
  season_id: number
  season_label: string
  source_url: string
  active: boolean
  created_at: string
  player_count: number
}

export interface ImportSummary {
  added: string[]
  alreadyExisted: string[]
  failed: string[]
}

export interface ImportResult {
  window: TransferWindowListItem
  importSummary: ImportSummary
}

export interface ImportBody {
  league: string
  league_code: string
  season_id: number
  season_label: string
  source_url: string
  transfers: ScrapedTransfer[]
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function scrapeTransferWindow(url: string): Promise<TransferScrapeResult> {
  return apiFetch('/api/transfer-history/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

export function importTransferWindow(body: ImportBody): Promise<ImportResult> {
  return apiFetch('/api/transfer-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getTransferWindows(): Promise<TransferWindowListItem[]> {
  return apiFetch('/api/transfer-history/windows')
}

export function updateTransferWindow(
  id: number,
  data: Partial<Pick<TransferWindowListItem, 'active' | 'league' | 'season_label'>>,
): Promise<TransferWindowListItem> {
  return apiFetch(`/api/transfer-history/windows/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteTransferWindow(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/transfer-history/windows/${id}`, { method: 'DELETE' })
}

// Find an existing footballer by name, or scrape + create from Wikipedia.
export function resolvePlayer(name: string, club?: string): Promise<{ id: number; name: string }> {
  return apiFetch('/api/transfer-history/resolve-player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, club }),
  })
}

export interface DetailTransfer {
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
  linked: boolean
}

export interface TransferWindowDetail {
  window: Omit<TransferWindowListItem, 'player_count'>
  transfers: DetailTransfer[]
}

export function getTransferWindowDetail(id: number): Promise<TransferWindowDetail> {
  return apiFetch(`/api/transfer-history/windows/${id}`)
}

// Update a single transfer row: change clubs and/or link an existing footballer
// (footballer_id null unlinks). Caller should refetch the window afterwards.
export function updateTransfer(
  id: number,
  data: { from_club?: string; to_club?: string; footballer_id?: number | null },
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/transfer-history/transfers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export interface RelinkResult {
  ok: boolean
  summary: { relinked: string[]; failed: string[] }
}

export function relinkTransferWindow(id: number): Promise<RelinkResult> {
  return apiFetch(`/api/transfer-history/windows/${id}/relink`, { method: 'POST' })
}
