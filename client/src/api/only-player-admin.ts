export interface AdminCombo {
  nationality: string
  club: string
  clubWikiUrl: string | null
  playerName: string
  enabled: boolean
}

export interface AdminCombosResult {
  data: AdminCombo[]
  total: number
  enabledCount: number
  page: number
  pageSize: number
}

export async function getAdminCombos(page = 1, pageSize = 25, q = ''): Promise<AdminCombosResult> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (q) params.set('q', q)
  const res = await fetch(`/api/only-player/admin/combos?${params}`)
  if (!res.ok) throw new Error('Failed to fetch admin combos')
  return res.json()
}

export async function setComboEnabled(nationality: string, club: string, enabled: boolean): Promise<void> {
  const res = await fetch('/api/only-player/admin/combos/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationality, club }),
  })
  if (!res.ok) throw new Error('Failed to update combo')
}
