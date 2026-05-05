export { searchClubs, type ClubSuggestion } from './guess-his-clubs'

export interface CicFootballer {
  id: number
  name: string
  wikipedia_url: string
}

export interface CicPair {
  footballer1: CicFootballer
  footballer2: CicFootballer
  commonClubs: string[]
  required: number
}

export async function getCicSession(): Promise<CicPair[]> {
  const res = await fetch('/api/clubs-in-common/session')
  if (!res.ok) throw new Error('Failed to load session')
  return res.json()
}
