export interface RandomListsScheduleAdminEntry {
  id: number
  date: string
  list_id: string
  created_at: string
}

export interface RandomListsScheduleRound {
  date: string
  listId: string
  title: string
  subtitle: string
  poolCount: number
  target: number
  difficulty: { label: string; color: 'red' | 'amber' | 'green' }
}

export async function getRandomListsSchedule(): Promise<RandomListsScheduleAdminEntry[]> {
  const res = await fetch('/api/random-lists/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function getRandomListsScheduleRounds(): Promise<RandomListsScheduleRound[]> {
  const res = await fetch('/api/random-lists/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load schedule rounds')
  return res.json()
}

export async function assignRandomListsDay(date: string, listId: string): Promise<void> {
  const res = await fetch(`/api/random-lists/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listId }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteRandomListsDay(date: string): Promise<void> {
  const res = await fetch(`/api/random-lists/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete day')
}

export async function clearRandomListsSchedule(): Promise<void> {
  const res = await fetch('/api/random-lists/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}
