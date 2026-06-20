import type { Footballer } from './footballers'

export interface TwoClubsSession {
  clubA: string
  clubAWikiUrl: string | null
  clubB: string
  clubBWikiUrl: string | null
}

export interface VerifyResult {
  valid: boolean
  footballer: { id: number; name: string; photo_url: string | null } | null
  imported: boolean
  reason?: string
  foundName?: string
  missingClubs?: string[]
}

const STORAGE_KEY = 'tcl_played'
const WINDOW = 30

export function recordPlayedPair(clubA: string, clubB: string): void {
  const key = `${clubA}|||${clubB}`
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    const next = [key, ...prev.filter(k => k !== key)].slice(0, WINDOW)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function getExcludePairsParam(): string {
  try {
    const pairs: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return pairs.join(',')
  } catch {
    return ''
  }
}

export async function getTwoClubsSession(): Promise<TwoClubsSession> {
  const exclude = getExcludePairsParam()
  const url = exclude ? `/api/two-clubs/session?exclude=${encodeURIComponent(exclude)}` : '/api/two-clubs/session'
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Failed to load session: ${res.status}`)
  }
  return res.json()
}

export async function verifyGuess(
  footballerName: string,
  footballerId: number | null,
  clubA: string,
  clubB: string,
): Promise<VerifyResult> {
  const body: Record<string, unknown> = { footballerName, clubA, clubB }
  if (footballerId != null) body.footballerId = footballerId
  const res = await fetch('/api/two-clubs/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { valid: false, footballer: null, imported: false }
  return res.json()
}

export async function getTwoClubsAnswers(clubA: string, clubB: string): Promise<Footballer[]> {
  const res = await fetch(`/api/two-clubs/answers?clubA=${encodeURIComponent(clubA)}&clubB=${encodeURIComponent(clubB)}`)
  if (!res.ok) throw new Error('Failed to fetch answers')
  return res.json()
}
