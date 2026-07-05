export interface InternationalMarksmanScheduleAdminEntry {
  id: number
  date: string
  country: string
  created_at: string
}

export interface InternationalMarksmanScheduleRound {
  date: string
  country: string
  marksmanCount: number
}

export async function getInternationalMarksmanSchedule(): Promise<InternationalMarksmanScheduleAdminEntry[]> {
  const res = await fetch('/api/international-marksman/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getInternationalMarksmanScheduleRounds(): Promise<InternationalMarksmanScheduleRound[]> {
  const res = await fetch('/api/international-marksman/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignInternationalMarksmanDay(date: string, country: string): Promise<void> {
  const res = await fetch(`/api/international-marksman/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteInternationalMarksmanDay(date: string): Promise<void> {
  const res = await fetch(`/api/international-marksman/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearInternationalMarksmanSchedule(): Promise<void> {
  const res = await fetch('/api/international-marksman/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
