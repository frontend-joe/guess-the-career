export interface AdminClub {
  club: string
  clubWikiUrl: string | null
  homeCountry: string | null
  nationalityCount: number
  foreignerCount: number
  enabled: boolean
  roundSize: number
}

export interface AdminClubsResult {
  data: AdminClub[]
  total: number
  enabledCount: number
  page: number
  pageSize: number
}

export interface ClubForeignerPlayer {
  id: number
  name: string
  photo_url: string | null
  nationality: string | null
  position: string | null
  apps: number
  years: string | null
}

export interface ClubForeignerGroup {
  country: string
  players: ClubForeignerPlayer[]
}

export interface ClubPlayersResult {
  homeCountry: string | null
  groups: ClubForeignerGroup[]
}

export async function getAdminClubs(page = 1, pageSize = 25): Promise<AdminClubsResult> {
  const res = await fetch(`/api/club-foreigners/admin/clubs?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw new Error('Failed to fetch admin clubs')
  return res.json()
}

export async function getClubPlayers(club: string): Promise<ClubPlayersResult> {
  const res = await fetch(`/api/club-foreigners/admin/clubs/${encodeURIComponent(club)}/players`)
  if (!res.ok) throw new Error('Failed to fetch club players')
  return res.json()
}

export async function setClubEnabled(club: string, enabled: boolean, roundSize = 5): Promise<void> {
  const res = await fetch('/api/club-foreigners/admin/clubs/enable', {
    method: enabled ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enabled ? { club, roundSize } : { club }),
  })
  if (!res.ok) throw new Error('Failed to update club')
}

// Override (or clear, when homeCountry is null) the club's excluded home country.
export async function setClubHome(club: string, homeCountry: string | null): Promise<void> {
  const res = await fetch('/api/club-foreigners/admin/clubs/home', {
    method: homeCountry ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(homeCountry ? { club, homeCountry } : { club }),
  })
  if (!res.ok) throw new Error('Failed to update home country')
}
