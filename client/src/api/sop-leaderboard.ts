export interface SopLeaderboardEntry {
  id: number
  player_name: string
  score: number
  total: number
  created_at: string
}

export async function getSopLeaderboard(): Promise<SopLeaderboardEntry[]> {
  const res = await fetch('/api/sop-leaderboard')
  if (!res.ok) throw new Error('Failed to load leaderboard')
  return res.json()
}

export async function submitSopScore(
  player_name: string,
  score: number,
  total: number,
): Promise<SopLeaderboardEntry> {
  const res = await fetch('/api/sop-leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_name, score, total }),
  })
  if (!res.ok) throw new Error('Failed to save score')
  return res.json()
}
