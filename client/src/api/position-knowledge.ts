export interface PositionPlayer {
  id: number
  name: string
  photo_url: string | null
}

export interface PKVerifyResult {
  valid: boolean
  footballer: { id: number; name: string; photo_url: string | null } | null
  imported: boolean
}

export async function getPositionPlayers(nation: string, position: string): Promise<PositionPlayer[]> {
  const params = new URLSearchParams({ nation, position })
  const res = await fetch(`/api/position-knowledge/players?${params}`)
  if (!res.ok) throw new Error('Failed to load players')
  return res.json()
}

export async function verifyPositionGuess(
  playerName: string,
  playerId: number | null,
  nation: string,
  position: string
): Promise<PKVerifyResult> {
  const res = await fetch('/api/position-knowledge/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName, ...(playerId != null && { playerId }), nation, position }),
  })
  if (!res.ok) return { valid: false, footballer: null, imported: false }
  return res.json()
}

export function getProgressKey(nation: string, position: string) {
  return `pk_progress_${nation}_${position}`
}

export function loadProgress(nation: string, position: string): number[] {
  try {
    const raw = localStorage.getItem(getProgressKey(nation, position))
    if (!raw) return []
    return (JSON.parse(raw) as { foundIds?: number[] }).foundIds ?? []
  } catch {
    return []
  }
}

export function saveProgress(nation: string, position: string, foundIds: number[]) {
  localStorage.setItem(getProgressKey(nation, position), JSON.stringify({ foundIds }))
}
