export interface Club {
  id: number
  name: string
  wikipedia_url: string | null
  home_body: string | null
  home_leftarm: string | null
  home_rightarm: string | null
  home_shorts: string | null
  home_socks: string | null
  home_pattern: string | null  // 'stripes' | 'hoops' | 'halves' | 'sash' | 'sleeves' | null
}

export async function getAllClubs(opts?: { search?: string }): Promise<Club[]> {
  const params = new URLSearchParams()
  if (opts?.search) params.set('q', opts.search)
  const res = await fetch(`/api/clubs/all?${params}`)
  if (!res.ok) throw new Error('Failed to fetch clubs')
  return res.json()
}

export async function deleteAllClubs(): Promise<void> {
  const res = await fetch('/api/clubs', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete clubs')
}

export async function rebuildClubs(): Promise<{ count: number }> {
  const res = await fetch('/api/clubs/rebuild', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to rebuild clubs')
  return res.json()
}

export async function scrapeKits(ids?: number[]): Promise<{ updated: number; skipped: number }> {
  const res = await fetch('/api/clubs/scrape-kits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
  })
  if (!res.ok) throw new Error('Failed to scrape kits')
  return res.json()
}

export async function updateClubKit(
  id: number,
  data: Partial<Pick<Club, 'home_body' | 'home_leftarm' | 'home_rightarm' | 'home_shorts' | 'home_socks' | 'home_pattern'>>
): Promise<Club> {
  const res = await fetch(`/api/clubs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update club kit')
  return res.json()
}
