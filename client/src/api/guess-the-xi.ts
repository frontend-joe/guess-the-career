import { getExcludeParam, recordPlayed } from '@/lib/recentPlayers'

export interface XiRoundPlayer {
  id: number
  footballerId?: number | null
  position: string
  squadNumber: number | null
  nationality: string | null
  clubAtTime?: string | null
  clubAtTimeWikipediaUrl?: string | null
}

export interface XiRound {
  matchId: number
  matchName: string
  year: number
  competition: string
  homeTeam: string
  awayTeam: string
  team: string
  teamWikipediaUrl: string | null
  teamImageUrl: string | null
  isToty: boolean
  players: XiRoundPlayer[]
  playerNames: string[]
}

// Explain why a wrong guess is wrong (never played for the club / wrong years).
export async function explainXiGuess(name: string, team: string): Promise<string> {
  try {
    const res = await fetch(`/api/guess-the-xi/explain?name=${encodeURIComponent(name)}&team=${encodeURIComponent(team)}`)
    if (!res.ok) return ''
    const body = (await res.json()) as { text?: string }
    return body.text ?? ''
  } catch {
    return ''
  }
}

export async function getXiSessionBySpec(spec: string): Promise<XiRound[]> {
  const res = await fetch(`/api/guess-the-xi/load?s=${encodeURIComponent(spec)}`)
  if (!res.ok) throw new Error('Failed to restore session')
  return res.json()
}

export async function getXiSession(): Promise<XiRound[]> {
  const exclude = getExcludeParam('gxi')
  const url = exclude ? `/api/guess-the-xi/session?exclude=${exclude}` : '/api/guess-the-xi/session'
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Failed to load session: ${res.status}`)
  }
  const data: XiRound[] = await res.json()
  recordPlayed('gxi', data.map(r => r.matchId))
  return data
}
