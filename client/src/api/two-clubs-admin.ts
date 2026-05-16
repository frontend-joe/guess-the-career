export interface AdminPair {
  clubA: string
  clubAWikiUrl: string | null
  clubB: string
  clubBWikiUrl: string | null
  playerCount: number
  enabled: boolean
}

export async function getAdminPairs(): Promise<AdminPair[]> {
  const res = await fetch('/api/two-clubs/admin/pairs')
  if (!res.ok) throw new Error('Failed to fetch admin pairs')
  return res.json()
}

export async function setPairEnabled(clubA: string, clubB: string, enabled: boolean): Promise<void> {
  const res = await fetch('/api/two-clubs/admin/pairs/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clubA, clubB }),
  })
  if (!res.ok) throw new Error('Failed to update pair')
}
