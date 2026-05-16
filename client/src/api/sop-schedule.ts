export interface SopRound {
  date: string
  footballerId: number
  footballerName: string
  nationality: string | null
  activeYears: string | null
  styleOfPlay: string
  historyText: string
}

export interface SopScheduleAdminEntry {
  id: number
  date: string
  footballer_id: number | null
  created_at: string
  footballer_name: string | null
  style_of_play_snippet: string | null
}

export interface SopAvailableFootballer {
  id: number
  name: string
  style_of_play: string
}

export async function getSopSchedule(): Promise<SopScheduleAdminEntry[]> {
  const res = await fetch('/api/sop-schedule')
  if (!res.ok) throw new Error('Failed to load SOP schedule')
  return res.json()
}

export async function getSopRounds(): Promise<SopRound[]> {
  const res = await fetch('/api/sop-schedule/rounds')
  if (!res.ok) throw new Error('Failed to load SOP rounds')
  return res.json()
}

export async function getSopAvailableFootballers(): Promise<SopAvailableFootballer[]> {
  const res = await fetch('/api/sop-schedule/available')
  if (!res.ok) throw new Error('Failed to load available footballers')
  return res.json()
}

export async function assignSopDay(date: string, footballer_id: number): Promise<void> {
  const res = await fetch(`/api/sop-schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ footballer_id }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteSopDay(date: string): Promise<void> {
  const res = await fetch(`/api/sop-schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearSopSchedule(): Promise<void> {
  const res = await fetch('/api/sop-schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
