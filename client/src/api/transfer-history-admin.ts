export interface ScrapedTransfer {
  player_name: string
  nationality: string | null
  position: 'GK' | 'DF' | 'MF' | 'FW' | null
  from_club: string
  to_club: string
  fee_text: string
  fee_value: number | null
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

export interface RelinkResult {
  ok: boolean
  summary: { relinked: string[]; failed: string[] }
}

export function relinkTransferWindow(id: number): Promise<RelinkResult> {
  return apiFetch(`/api/transfer-history/windows/${id}/relink`, { method: 'POST' })
}
