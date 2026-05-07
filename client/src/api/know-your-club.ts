export interface KycClub {
  id: number
  name: string
  playerCount: number
  wikipediaUrl: string | null
}

export interface KycPlayer {
  id: number
  name: string
  photoUrl: string
  nationality: string | null
}

export interface KycSession {
  club: KycClub
  players: KycPlayer[]
}

export async function getKycClubs(): Promise<KycClub[]> {
  const res = await fetch('/api/know-your-club/clubs')
  const data = await res.json()
  return data.clubs
}

export async function getKycSession(clubId: number): Promise<KycSession> {
  const res = await fetch(`/api/know-your-club/session?clubId=${clubId}`)
  if (!res.ok) throw new Error('Failed to load session')
  return res.json()
}
