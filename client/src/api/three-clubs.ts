import type { Footballer } from './footballers'

export interface ThreeClubsSession {
  clubA: string
  clubAWikiUrl: string | null
  clubB: string
  clubBWikiUrl: string | null
  clubC: string
  clubCWikiUrl: string | null
}

export interface VerifyResult {
  valid: boolean
  footballer: { id: number; name: string; photo_url: string | null } | null
  imported: boolean
  reason?: string
}

const STORAGE_KEY = 'thr_played'
const WINDOW = 30

function trioKey(clubA: string, clubB: string, clubC: string): string {
  return [clubA, clubB, clubC].sort((a, b) => a.localeCompare(b)).join('|||')
}

export function recordPlayedTrio(clubA: string, clubB: string, clubC: string): void {
  const key = trioKey(clubA, clubB, clubC)
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    const next = [key, ...prev.filter(k => k !== key)].slice(0, WINDOW)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function getExcludeTriosParam(): string {
  try {
    const trios: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return trios.join(',')
  } catch {
    return ''
  }
}

export async function getThreeClubsSession(): Promise<ThreeClubsSession> {
  const exclude = getExcludeTriosParam()
  const url = exclude ? `/api/three-clubs/session?exclude=${encodeURIComponent(exclude)}` : '/api/three-clubs/session'
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
  clubC: string,
): Promise<VerifyResult> {
  const body: Record<string, unknown> = { footballerName, clubA, clubB, clubC }
  if (footballerId != null) body.footballerId = footballerId
  const res = await fetch('/api/three-clubs/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { valid: false, footballer: null, imported: false }
  return res.json()
}

export async function getThreeClubsAnswers(clubA: string, clubB: string, clubC: string): Promise<Footballer[]> {
  const res = await fetch(`/api/three-clubs/answers?clubA=${encodeURIComponent(clubA)}&clubB=${encodeURIComponent(clubB)}&clubC=${encodeURIComponent(clubC)}`)
  if (!res.ok) throw new Error('Failed to fetch answers')
  return res.json()
}
