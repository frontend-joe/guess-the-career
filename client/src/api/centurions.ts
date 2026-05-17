export interface CenturionPlayer {
  id: number
  name: string
  photo_url: string | null
  nationality: string | null
  hint_club: string | null
  hint_club_wiki_url: string | null
  hint_years: string | null
  stat: number
  slot_key: string
}

export const CENTURION_MODES = [
  {
    id: 'one-club',
    title: 'One-Club Century',
    subtitle: '100+ goals at a single club',
    description: 'Name every player who scored 100 or more goals for a single club.',
  },
  {
    id: 'goals-200',
    title: 'Double Century',
    subtitle: '200–299 career goals',
    description: 'Name every player who scored between 200 and 299 senior career goals.',
  },
  {
    id: 'goals-500',
    title: 'The Legends',
    subtitle: '300+ career goals',
    description: 'Name every player who scored 300 or more senior career goals.',
  },
  {
    id: 'international',
    title: 'International Centurions',
    subtitle: '100+ international caps',
    description: 'Name every player who earned 100 or more caps (appearances) for their national team.',
  },
  {
    id: 'international-goals',
    title: 'International Marksmen',
    subtitle: '50+ international goals',
    description: 'Name every player who scored 50 or more goals for their national team.',
  },
  {
    id: 'appearances',
    title: '500 Club',
    subtitle: '500+ senior appearances',
    description: 'Name every player who made 500 or more senior career appearances.',
  },
  {
    id: 'one-club-300',
    title: 'Loyal 300',
    subtitle: '300+ apps at one club',
    description: 'Name every player who made 300 or more appearances for a single club.',
  },
  {
    id: 'one-club-apps',
    title: 'One-Club Servant',
    subtitle: '400+ apps at one club',
    description: 'Name every player who made 400 or more appearances for a single club.',
  },
  {
    id: 'dual-centurion',
    title: 'Dual Centurion',
    subtitle: '100+ goals & 50+ caps',
    description: 'Name every player who scored 100 or more senior career goals AND earned 50 or more international caps.',
  },
] as const

export type CenturionModeId = typeof CENTURION_MODES[number]['id']

export async function getCenturionPlayers(mode: string): Promise<CenturionPlayer[]> {
  const res = await fetch(`/api/centurions/players?mode=${encodeURIComponent(mode)}`)
  if (!res.ok) throw new Error(`Failed to load centurions players: ${res.status}`)
  return res.json()
}

export interface VerifyResult {
  qualified: boolean
  player: CenturionPlayer | null
  scraped: boolean
}

export async function verifyCenturionPlayer(name: string, mode: string, footballerId?: number): Promise<VerifyResult> {
  const res = await fetch('/api/centurions/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mode, footballerId }),
  })
  if (!res.ok) throw new Error(`Verify failed: ${res.status}`)
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
