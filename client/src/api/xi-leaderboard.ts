export interface XiLeaderboardEntry {
  id: number
  player_name: string
  score: number
  total: number
  created_at: string
}

export async function getXiLeaderboard(): Promise<XiLeaderboardEntry[]> {
  const res = await fetch('/api/xi-leaderboard')
  if (!res.ok) throw new Error('Failed to load leaderboard')
  return res.json()
}

export async function submitXiScore(
  player_name: string,
  score: number,
  total: number
): Promise<XiLeaderboardEntry> {
  const res = await fetch('/api/xi-leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_name, score, total }),
  })
  if (!res.ok) throw new Error('Failed to save score')
  return res.json()
}
