export interface BundesligaScheduleAdminEntry {
  id: number
  date: string
  nationality: string
  created_at: string
}

export interface BundesligaScheduleRound {
  date: string
  nationality: string
  roundSize: number
  playerCount: number
}

export async function getBundesligaSchedule(): Promise<BundesligaScheduleAdminEntry[]> {
  const res = await fetch('/api/bundesliga/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getBundesligaScheduleRounds(): Promise<BundesligaScheduleRound[]> {
  const res = await fetch('/api/bundesliga/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignBundesligaDay(date: string, nationality: string): Promise<void> {
  const res = await fetch(`/api/bundesliga/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationality }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteBundesligaDay(date: string): Promise<void> {
  const res = await fetch(`/api/bundesliga/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearBundesligaSchedule(): Promise<void> {
  const res = await fetch('/api/bundesliga/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
