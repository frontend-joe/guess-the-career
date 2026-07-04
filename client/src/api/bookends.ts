export interface BookendCandidate {
  footballerId: number
  name: string
  club: string
  clubWikipediaUrl: string | null
  clubCount: number
  included: boolean
}

export async function getCandidates(): Promise<{ data: BookendCandidate[]; total: number; includedCount: number }> {
  const res = await fetch('/api/bookends/admin/players')
  if (!res.ok) throw new Error('Failed to fetch bookends')
  return res.json()
}

export async function setIncluded(footballerId: number, included: boolean): Promise<void> {
  const res = await fetch('/api/bookends/admin/players/include', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ footballerId, included }),
  })
  if (!res.ok) throw new Error('Failed to update')
}
