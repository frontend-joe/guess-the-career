export interface Manager {
  id: number
  name: string
  wikipedia_url: string
  place_of_birth: string | null
  born: string | null
  photo_url: string | null
  created_at: string
  updated_at: string
}

export interface ManagerCareerStint {
  id: number
  manager_id: number
  sort_order: number
  years: string
  club: string
  apps: number | null
  goals: number | null
  stint_type: 'managerial'
}

export interface ManagerWithStints extends Manager {
  stints: ManagerCareerStint[]
}

export interface ScrapeManagerResult {
  name: string
  wikipedia_url: string
  place_of_birth: string | null
  born: string | null
  stints: Omit<ManagerCareerStint, 'id' | 'manager_id'>[]
}

export async function getManagers(opts?: {
  search?: string
  unassigned?: boolean
  excludeDate?: string
}): Promise<Manager[]> {
  const params = new URLSearchParams()
  if (opts?.search) params.set('search', opts.search)
  if (opts?.unassigned) params.set('unassigned', 'true')
  if (opts?.excludeDate) params.set('excludeDate', opts.excludeDate)
  const qs = params.toString()
  const res = await fetch(`/api/managers${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to fetch managers')
  return res.json()
}

export async function getManager(id: number): Promise<ManagerWithStints> {
  const res = await fetch(`/api/managers/${id}`)
  if (!res.ok) throw new Error('Failed to fetch manager')
  return res.json()
}

export async function scrapeManagerWikipedia(url: string): Promise<ScrapeManagerResult> {
  const res = await fetch('/api/managers/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Scrape failed')
  return data
}

export class ApiError extends Error {
  readonly code: string | undefined
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

export async function createManagerFromScrape(data: ScrapeManagerResult): Promise<Manager> {
  const res = await fetch('/api/managers/from-scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new ApiError(json.message ?? json.error ?? 'Failed to save manager', json.error)
  return json
}

export async function updateManager(
  id: number,
  data: Partial<Pick<Manager, 'name' | 'place_of_birth' | 'born' | 'photo_url'>>
): Promise<Manager> {
  const res = await fetch(`/api/managers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to update manager')
  return json
}

export async function updateManagerStints(
  id: number,
  stints: Omit<ManagerCareerStint, 'id' | 'manager_id'>[]
): Promise<ManagerCareerStint[]> {
  const res = await fetch(`/api/managers/${id}/stints`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stints),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to update stints')
  return json
}

export async function deleteManager(id: number): Promise<void> {
  const res = await fetch(`/api/managers/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete manager')
}

export async function deleteAllManagers(): Promise<void> {
  const res = await fetch('/api/managers', { method: 'DELETE' })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? json.message ?? 'Failed to delete all managers')
  }
}

export async function getManagerDuplicates(): Promise<Manager[][]> {
  const res = await fetch('/api/managers/duplicates')
  if (!res.ok) throw new Error('Failed to fetch duplicates')
  return res.json()
}
