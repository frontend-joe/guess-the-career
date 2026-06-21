export interface SerieACountry {
  nationality: string
  playerCount: number
  enabled: boolean
  roundSize: number
}

export interface SerieAPlayer {
  id: number
  name: string
  photo_url: string | null
  apps: number
  hintClub: string | null
  clubWikiUrl: string | null
}

export async function getCountries(): Promise<{ data: SerieACountry[]; total: number; enabledCount: number }> {
  const res = await fetch('/api/serie-a/admin/countries')
  if (!res.ok) throw new Error('Failed to fetch countries')
  return res.json()
}

export async function getCountryPlayers(nationality: string): Promise<SerieAPlayer[]> {
  const res = await fetch(`/api/serie-a/admin/countries/${encodeURIComponent(nationality)}/players`)
  if (!res.ok) throw new Error('Failed to fetch players')
  return res.json()
}

// Enable (and set round size) or disable a country.
export async function setCountryEnabled(nationality: string, enabled: boolean, roundSize = 5): Promise<void> {
  const res = await fetch('/api/serie-a/admin/countries/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enabled ? { nationality, roundSize } : { nationality }),
  })
  if (!res.ok) throw new Error('Failed to update country')
}
