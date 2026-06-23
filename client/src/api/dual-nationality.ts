export interface DualNation {
  name: string
  years: string | null
}

export interface DualNationalityPlayer {
  footballerId: number
  name: string
  photo_url: string | null
  position: string | null
  years: string | null
  clubName: string | null
  clubWikiUrl: string | null
  clubYears: string | null
  nations: DualNation[]
}

export interface DualNationalityCandidate extends DualNationalityPlayer {
  included: boolean
}

export async function getCandidates(): Promise<{ data: DualNationalityCandidate[]; total: number; includedCount: number }> {
  const res = await fetch('/api/dual-nationality/admin/players')
  if (!res.ok) throw new Error('Failed to fetch candidates')
  return res.json()
}

export async function setIncluded(footballerId: number, included: boolean): Promise<void> {
  const res = await fetch('/api/dual-nationality/admin/players/include', {
    method: included ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ footballerId }),
  })
  if (!res.ok) throw new Error('Failed to update player')
}

export async function getAnswers(): Promise<DualNationalityPlayer[]> {
  const res = await fetch('/api/dual-nationality/answers')
  if (!res.ok) throw new Error('Failed to load players')
  return res.json()
}
