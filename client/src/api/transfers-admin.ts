export interface AdminPair {
  fromClub: string
  fromClubWikiUrl: string | null
  toClub: string
  toClubWikiUrl: string | null
  playerCount: number
  enabled: boolean
}

export interface AdminPairsResult {
  data: AdminPair[]
  total: number
  enabledCount: number
  page: number
  pageSize: number
}

export interface TransferPlayer {
  id: number
  name: string
  photo_url: string | null
  nationality: string | null
  year: string | null
}

export async function getAdminPairs(page = 1, pageSize = 25): Promise<AdminPairsResult> {
  const res = await fetch(`/api/transfers/admin/pairs?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw new Error('Failed to fetch admin pairs')
  return res.json()
}

export async function getPairPlayers(fromClub: string, toClub: string): Promise<TransferPlayer[]> {
  const res = await fetch(
    `/api/transfers/admin/pairs/players?from=${encodeURIComponent(fromClub)}&to=${encodeURIComponent(toClub)}`,
  )
  if (!res.ok) throw new Error('Failed to fetch pair players')
  return res.json()
}

export async function setPairEnabled(fromClub: string, toClub: string, enabled: boolean): Promise<void> {
  const res = await fetch('/api/transfers/admin/pairs/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromClub, toClub }),
  })
  if (!res.ok) throw new Error('Failed to update pair')
}
