export interface AdminClub {
  club: string
  clubWikiUrl: string | null
  legendCount: number
  enabled: boolean
}

export interface AdminClubsResult {
  data: AdminClub[]
  total: number
  enabledCount: number
  page: number
  pageSize: number
}

export interface ClubLegendPlayer {
  id: number
  name: string
  photo_url: string | null
  apps: number
  nationality: string | null
  position: string | null
}

export async function getAdminClubs(page = 1, pageSize = 25): Promise<AdminClubsResult> {
  const res = await fetch(`/api/club-legends/admin/clubs?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw new Error('Failed to fetch admin clubs')
  return res.json()
}

export async function getClubPlayers(club: string): Promise<ClubLegendPlayer[]> {
  const res = await fetch(`/api/club-legends/admin/clubs/${encodeURIComponent(club)}/players`)
  if (!res.ok) throw new Error('Failed to fetch club players')
  return res.json()
}

export async function setClubEnabled(club: string, enabled: boolean): Promise<void> {
  const res = await fetch('/api/club-legends/admin/clubs/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ club }),
  })
  if (!res.ok) throw new Error('Failed to update club')
}
