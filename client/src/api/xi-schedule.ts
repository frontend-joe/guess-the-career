import type { XiRound } from './guess-the-xi'

export interface XiScheduleAdminEntry {
  id: number
  date: string
  match_id: number | null
  team: string | null
  match_name: string | null
  year: number | null
  competition: string | null
  home_team: string | null
  away_team: string | null
}

export type XiScheduleRound = XiRound & { date: string }

export async function getXiSchedule(): Promise<XiScheduleAdminEntry[]> {
  const res = await fetch('/api/xi-schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getXiScheduleRounds(): Promise<XiScheduleRound[]> {
  const res = await fetch('/api/xi-schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignXiDay(date: string, matchId: number, team: string): Promise<void> {
  const res = await fetch(`/api/xi-schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ match_id: matchId, team }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteXiDay(date: string): Promise<void> {
  const res = await fetch(`/api/xi-schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearXiSchedule(): Promise<void> {
  const res = await fetch('/api/xi-schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
