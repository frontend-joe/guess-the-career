// Account-synced game settings. All calls send the session cookie.
// Guess percentage is stored PER GAME under `guessPercentages[gameKey]`.

export interface GameSettings {
  guessPercentages?: Record<string, number>
}

export async function getSettings(): Promise<GameSettings> {
  const res = await fetch('/api/settings', { credentials: 'include' })
  if (!res.ok) throw new Error(`settings fetch failed: ${res.status}`)
  return res.json()
}

export async function putGuessPercentage(gameKey: string, guessPercentage: number): Promise<GameSettings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameKey, guessPercentage }),
  })
  if (!res.ok) throw new Error(`settings put failed: ${res.status}`)
  return res.json()
}
