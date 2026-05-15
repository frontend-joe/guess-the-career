export interface GoalRatiosStint {
  years: string
  club: string
  apps: number
  goals: number
}

export interface GoalRatiosPlayer {
  id: number
  name: string
  nationality: string | null
  position: string | null
  mainClub: string | null
  mainClubWikipediaUrl: string | null
  stints: GoalRatiosStint[]
}

export async function getGoalRatiosPlayers(): Promise<GoalRatiosPlayer[]> {
  const res = await fetch('/api/goal-ratios/players')
  if (!res.ok) throw new Error('Failed to load goal ratios players')
  return res.json()
}

const PROGRESS_KEY = 'gr_progress'

export function loadProgress(): number[] {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as number[]
  } catch {
    return []
  }
}

export function saveProgress(foundIds: number[]): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(foundIds))
}

export function clearProgress(): void {
  localStorage.removeItem(PROGRESS_KEY)
}
