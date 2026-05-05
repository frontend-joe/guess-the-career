export interface WsmPlayer {
  id: number
  name: string
  wikipedia_url: string
  total_goals: number
}

export async function getWsmSession(): Promise<WsmPlayer[]> {
  const res = await fetch('/api/who-scored-more/session')
  if (!res.ok) throw new Error('Failed to load session')
  return res.json()
}
