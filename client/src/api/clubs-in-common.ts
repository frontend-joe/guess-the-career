export { searchClubs, type ClubSuggestion } from './guess-his-clubs'

import { getExcludeParam, recordPlayed } from '@/lib/recentPlayers'

export interface CicFootballer {
  id: number
  name: string
  wikipedia_url: string
}

export interface CicPair {
  footballer1: CicFootballer
  footballer2: CicFootballer
  commonClubs: string[]
  clubWikiUrls: Record<string, string>
  required: number
}

export async function getCicSession(): Promise<CicPair[]> {
  const exclude = getExcludeParam('cic')
  const res = await fetch(`/api/clubs-in-common/session${exclude ? `?exclude=${exclude}` : ''}`)
  if (!res.ok) throw new Error('Failed to load session')
  const data: CicPair[] = await res.json()
  recordPlayed('cic', data.flatMap(p => [p.footballer1.id, p.footballer2.id]))
  return data
}
