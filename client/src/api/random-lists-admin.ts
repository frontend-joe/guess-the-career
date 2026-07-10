export interface AdminList {
  id: string
  title: string
  subtitle: string
  poolCount: number
  target: number
  enabled: boolean
}

export interface RandomListPlayer {
  id: number
  name: string
  photo_url: string | null
  nationality: string | null
  position: string | null
  stat: string
}

export async function getAdminLists(): Promise<{ data: AdminList[] }> {
  const res = await fetch('/api/random-lists/admin/lists')
  if (!res.ok) throw new Error('Failed to fetch lists')
  return res.json()
}

export async function getListPlayers(listId: string): Promise<RandomListPlayer[]> {
  const res = await fetch(`/api/random-lists/admin/lists/${encodeURIComponent(listId)}/players`)
  if (!res.ok) throw new Error('Failed to fetch list players')
  return res.json()
}

export async function setListConfig(
  listId: string,
  patch: { target?: number; enabled?: boolean },
): Promise<void> {
  const res = await fetch('/api/random-lists/admin/lists/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listId, ...patch }),
  })
  if (!res.ok) throw new Error('Failed to update list config')
}
