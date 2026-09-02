// Account-synced global game settings. All calls send the session cookie.

export interface GameSettings {
  guessPercentage?: number
}

export async function getSettings(): Promise<GameSettings> {
  const res = await fetch('/api/settings', { credentials: 'include' })
  if (!res.ok) throw new Error(`settings fetch failed: ${res.status}`)
  return res.json()
}

export async function putSettings(patch: GameSettings): Promise<GameSettings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`settings put failed: ${res.status}`)
  return res.json()
}
