export interface AdminCountry {
  country: string
  legendCount: number
  enabled: boolean
}

export interface AdminCountriesResult {
  data: AdminCountry[]
  total: number
  enabledCount: number
  page: number
  pageSize: number
}

export interface InternationalLegendPlayer {
  id: number
  name: string
  photo_url: string | null
  apps: number
  position: string | null
  years: string | null
}

export async function getAdminCountries(page = 1, pageSize = 25): Promise<AdminCountriesResult> {
  const res = await fetch(`/api/international-legends/admin/countries?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw new Error('Failed to fetch admin countries')
  return res.json()
}

export async function getCountryPlayers(country: string): Promise<InternationalLegendPlayer[]> {
  const res = await fetch(`/api/international-legends/admin/countries/${encodeURIComponent(country)}/players`)
  if (!res.ok) throw new Error('Failed to fetch country players')
  return res.json()
}

export async function setCountryEnabled(country: string, enabled: boolean): Promise<void> {
  const res = await fetch('/api/international-legends/admin/countries/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  })
  if (!res.ok) throw new Error('Failed to update country')
}
