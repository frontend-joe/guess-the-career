import { getExcludeParam, recordPlayed } from '@/lib/recentPlayers'

export interface GhcFootballer {
  id: number
  name: string
  wikipedia_url: string
  photo_url: string | null
  clubs: string[]
  clubWikiUrls: Record<string, string>
  required: number
}

export interface ClubSuggestion {
  id: number
  name: string
}

export async function getGhcSession(): Promise<GhcFootballer[]> {
  const exclude = getExcludeParam('ghc')
  const res = await fetch(`/api/guess-his-clubs/session${exclude ? `?exclude=${exclude}` : ''}`)
  if (!res.ok) throw new Error('Failed to load session')
  const data: GhcFootballer[] = await res.json()
  recordPlayed('ghc', data.map(p => p.id))
  return data
}

export async function searchClubs(q: string): Promise<ClubSuggestion[]> {
  if (q.length < 1) return []
  const res = await fetch(`/api/clubs?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('Failed to search clubs')
  return res.json()
}
