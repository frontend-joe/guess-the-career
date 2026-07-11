export interface Ligue1Country {
  nationality: string
  playerCount: number
  enabled: boolean
  roundSize: number
}

export interface Ligue1Player {
  id: number
  name: string
  photo_url: string | null
  apps: number
  hintClub: string | null
  clubWikiUrl: string | null
}

export async function getCountries(): Promise<{ data: Ligue1Country[]; total: number; enabledCount: number }> {
  const res = await fetch('/api/ligue-1/admin/countries')
  if (!res.ok) throw new Error('Failed to fetch countries')
  return res.json()
}

export async function getCountryPlayers(nationality: string): Promise<Ligue1Player[]> {
  const res = await fetch(`/api/ligue-1/admin/countries/${encodeURIComponent(nationality)}/players`)
  if (!res.ok) throw new Error('Failed to fetch players')
  return res.json()
}

// Enable (and set round size) or disable a country.
export async function setCountryEnabled(nationality: string, enabled: boolean, roundSize = 5): Promise<void> {
  const res = await fetch('/api/ligue-1/admin/countries/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enabled ? { nationality, roundSize } : { nationality }),
  })
  if (!res.ok) throw new Error('Failed to update country')
}
