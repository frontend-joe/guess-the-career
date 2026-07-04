export interface BookendsScheduleAdminEntry {
  id: number
  date: string
  footballerId: number
  footballerName: string
  created_at: string
}

export interface BookendsScheduleRound {
  date: string
  footballerId: number
}

export async function getBookendsSchedule(): Promise<BookendsScheduleAdminEntry[]> {
  const res = await fetch('/api/bookends/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getBookendsScheduleRounds(): Promise<BookendsScheduleRound[]> {
  const res = await fetch('/api/bookends/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignBookendDay(date: string, footballerId: number): Promise<void> {
  const res = await fetch(`/api/bookends/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ footballerId }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteBookendDay(date: string): Promise<void> {
  const res = await fetch(`/api/bookends/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearBookendsSchedule(): Promise<void> {
  const res = await fetch('/api/bookends/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
