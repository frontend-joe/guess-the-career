export interface Club {
  id: number
  name: string
}

export async function getAllClubs(opts?: { search?: string }): Promise<Club[]> {
  const params = new URLSearchParams()
  if (opts?.search) params.set('q', opts.search)
  const res = await fetch(`/api/clubs/all?${params}`)
  if (!res.ok) throw new Error('Failed to fetch clubs')
  return res.json()
}

export async function deleteAllClubs(): Promise<void> {
  const res = await fetch('/api/clubs', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete clubs')
}

export async function rebuildClubs(): Promise<{ count: number }> {
  const res = await fetch('/api/clubs/rebuild', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to rebuild clubs')
  return res.json()
}
