export interface TopScorersLeaderboardEntry {
  id: number
  player_name: string
  score: number
  total: number
  created_at: string
}

export async function getTopScorersLeaderboard(): Promise<TopScorersLeaderboardEntry[]> {
  const res = await fetch('/api/top-scorers-leaderboard')
  if (!res.ok) throw new Error('Failed to load leaderboard')
  return res.json()
}

export async function submitTopScorersScore(
  player_name: string,
  score: number,
  total: number,
): Promise<TopScorersLeaderboardEntry> {
  const res = await fetch('/api/top-scorers-leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_name, score, total }),
  })
  if (!res.ok) throw new Error('Failed to save score')
  return res.json()
}
