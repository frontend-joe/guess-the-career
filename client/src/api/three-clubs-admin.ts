export interface AdminTrio {
  clubA: string
  clubAWikiUrl: string | null
  clubB: string
  clubBWikiUrl: string | null
  clubC: string
  clubCWikiUrl: string | null
  playerCount: number
  enabled: boolean
}

export async function getAdminTrios(): Promise<AdminTrio[]> {
  const res = await fetch('/api/three-clubs/admin/trios')
  if (!res.ok) throw new Error('Failed to fetch admin trios')
  return res.json()
}

export async function setTrioEnabled(clubA: string, clubB: string, clubC: string, enabled: boolean): Promise<void> {
  const res = await fetch('/api/three-clubs/admin/trios/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clubA, clubB, clubC }),
  })
  if (!res.ok) throw new Error('Failed to update trio')
}
