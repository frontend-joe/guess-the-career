export interface OnlyPlayerEntry {
  id: number
  nationality: string
  club: string
  clubWikiUrl: string | null
  playerName: string
  footballerId: number | null
  footballerPhoto: string | null
  period: string | null
  status: string | null
  enabled: boolean
}

export interface OnlyPlayerEntriesResult {
  data: OnlyPlayerEntry[]
  total: number
  enabledCount: number
  page: number
  pageSize: number
}

export async function getEntries(page = 1, pageSize = 25, q = ''): Promise<OnlyPlayerEntriesResult> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (q) params.set('q', q)
  const res = await fetch(`/api/only-player/admin/entries?${params}`)
  if (!res.ok) throw new Error('Failed to fetch entries')
  return res.json()
}

export async function createEntry(input: {
  nationality: string
  club: string
  player_name: string
  period?: string | null
  status?: string | null
}): Promise<{ id: number }> {
  const res = await fetch('/api/only-player/admin/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create entry')
  return res.json()
}

export async function updateEntry(
  id: number,
  patch: Partial<{
    nationality: string
    club: string
    player_name: string
    period: string | null
    status: string | null
    enabled: boolean
  }>,
): Promise<void> {
  const res = await fetch(`/api/only-player/admin/entries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update entry')
}

export async function deleteEntry(id: number): Promise<void> {
  const res = await fetch(`/api/only-player/admin/entries/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete entry')
}

export async function linkEntryPlayer(
  id: number,
  body: { footballerId?: number; name?: string; wikipediaUrl?: string },
): Promise<{ footballer: { id: number; name: string; photo_url: string | null } }> {
  const res = await fetch(`/api/only-player/admin/entries/${id}/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to link player')
  }
  return res.json()
}

export async function seedEntries(): Promise<{ added: number }> {
  const res = await fetch('/api/only-player/admin/seed', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to seed entries')
  return res.json()
}
