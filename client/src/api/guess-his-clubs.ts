export interface GhcFootballer {
  id: number
  name: string
  wikipedia_url: string
  clubs: string[]
  clubWikiUrls: Record<string, string>
  required: number
}

export interface ClubSuggestion {
  id: number
  name: string
}

export async function getGhcSession(): Promise<GhcFootballer[]> {
  const res = await fetch('/api/guess-his-clubs/session')
  if (!res.ok) throw new Error('Failed to load session')
  return res.json()
}

export async function searchClubs(q: string): Promise<ClubSuggestion[]> {
  if (q.length < 1) return []
  const res = await fetch(`/api/clubs?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('Failed to search clubs')
  return res.json()
}
