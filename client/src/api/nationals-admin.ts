export interface AdminCombo {
  nationality: string
  club: string
  clubWikiUrl: string | null
  playerCount: number
  enabled: boolean
}

export async function getAdminCombos(): Promise<AdminCombo[]> {
  const res = await fetch('/api/nationals/admin/combos')
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
