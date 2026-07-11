export interface BundesligaCountry {
  nationality: string
  playerCount: number
  enabled: boolean
  roundSize: number
}

export interface BundesligaPlayer {
  id: number
  name: string
  photo_url: string | null
  apps: number
  hintClub: string | null
  clubWikiUrl: string | null
}

export async function getCountries(): Promise<{ data: BundesligaCountry[]; total: number; enabledCount: number }> {
  const res = await fetch('/api/bundesliga/admin/countries')
  if (!res.ok) throw new Error('Failed to fetch countries')
  return res.json()
}

export async function getCountryPlayers(nationality: string): Promise<BundesligaPlayer[]> {
  const res = await fetch(`/api/bundesliga/admin/countries/${encodeURIComponent(nationality)}/players`)
  if (!res.ok) throw new Error('Failed to fetch players')
  return res.json()
}

// Enable (and set round size) or disable a country.
export async function setCountryEnabled(nationality: string, enabled: boolean, roundSize = 5): Promise<void> {
  const res = await fetch('/api/bundesliga/admin/countries/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enabled ? { nationality, roundSize } : { nationality }),
  })
  if (!res.ok) throw new Error('Failed to update country')
}
