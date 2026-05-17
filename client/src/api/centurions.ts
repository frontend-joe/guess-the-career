export interface CenturionPlayer {
  id: number
  name: string
  photo_url: string | null
  nationality: string | null
  hint_club: string | null
  stat: number
  slot_key: string
}

export const CENTURION_MODES = [
  { id: 'midfielders',   title: 'Midfield Centurions',      subtitle: '100+ career goals · Midfielders' },
  { id: 'defenders',     title: 'Defensive Centurions',     subtitle: '100+ career goals · Defenders' },
  { id: 'wingers',       title: 'Winger Centurions',        subtitle: '100+ career goals · Wingers' },
  { id: 'one-club',      title: 'One-Club Century',         subtitle: '100+ goals at a single club' },
  { id: 'goals-200',     title: 'Double Century',           subtitle: '200–299 career goals' },
  { id: 'goals-300',     title: 'Triple Century',           subtitle: '300+ career goals' },
  { id: 'international', title: 'International Centurions', subtitle: '100+ international goals' },
  { id: 'appearances',   title: '500 Club',                 subtitle: '500+ senior appearances' },
] as const

export type CenturionModeId = typeof CENTURION_MODES[number]['id']

export async function getCenturionPlayers(mode: string): Promise<CenturionPlayer[]> {
  const res = await fetch(`/api/centurions/players?mode=${encodeURIComponent(mode)}`)
  if (!res.ok) throw new Error(`Failed to load centurions players: ${res.status}`)
  return res.json()
}

const STORAGE_PREFIX = 'centurions_'

interface SavedProgress {
  guessedKeys: string[]
  total: number
}

export function loadCenturionProgress(mode: string): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + mode)
    return raw ? JSON.parse(raw) : { guessedKeys: [], total: 0 }
  } catch {
    return { guessedKeys: [], total: 0 }
  }
}

export function saveCenturionProgress(mode: string, guessedKeys: string[], total: number): void {
  localStorage.setItem(STORAGE_PREFIX + mode, JSON.stringify({ guessedKeys, total }))
}
