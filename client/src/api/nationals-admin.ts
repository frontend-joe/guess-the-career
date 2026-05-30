export interface AdminCombo {
  nationality: string
  club: string
  clubWikiUrl: string | null
  playerCount: number
  enabled: boolean
}

export interface AdminCombosResult {
  data: AdminCombo[]
  total: number
  enabledCount: number
  page: number
  pageSize: number
}

export async function getAdminCombos(page = 1, pageSize = 25): Promise<AdminCombosResult> {
  const res = await fetch(`/api/nationals/admin/combos?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw new Error('Failed to fetch admin combos')
  return res.json()
}

export async function setComboEnabled(nationality: string, club: string, enabled: boolean): Promise<void> {
  const res = await fetch('/api/nationals/admin/combos/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationality, club }),
  })
  if (!res.ok) throw new Error('Failed to update combo')
}
