import { getExcludeParam, recordPlayed } from '@/lib/recentPlayers'

export interface WsmPlayer {
  id: number
  name: string
  wikipedia_url: string
  total_goals: number
}

export async function getWsmSession(): Promise<WsmPlayer[]> {
  const exclude = getExcludeParam('wsm')
  const res = await fetch(`/api/who-scored-more/session${exclude ? `?exclude=${exclude}` : ''}`)
  if (!res.ok) throw new Error('Failed to load session')
  const data: WsmPlayer[] = await res.json()
  recordPlayed('wsm', data.map(p => p.id))
  return data
}
