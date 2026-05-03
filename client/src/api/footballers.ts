export interface Footballer {
  id: number
  name: string
  wikipedia_url: string
  nationality: string | null
  position: string | null
  born: string | null
  created_at: string
  updated_at: string
}

export interface CareerStint {
  id: number
  footballer_id: number
  sort_order: number
  years: string
  club: string
  apps: number | null
  goals: number | null
}

export interface FootballerWithStints extends Footballer {
  stints: CareerStint[]
}

export interface ScrapeResult {
  name: string
  wikipedia_url: string
  nationality: string | null
  position: string | null
  born: string | null
  stints: Omit<CareerStint, 'id' | 'footballer_id'>[]
}

export async function getFootballers(opts?: {
  search?: string
  unassigned?: boolean
  excludeDate?: string
}): Promise<Footballer[]> {
  const params = new URLSearchParams()
  if (opts?.search) params.set('search', opts.search)
  if (opts?.unassigned) params.set('unassigned', 'true')
  if (opts?.excludeDate) params.set('excludeDate', opts.excludeDate)
  const qs = params.toString()
  const res = await fetch(`/api/footballers${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to fetch footballers')
  return res.json()
}

export async function getFootballer(id: number): Promise<FootballerWithStints> {
  const res = await fetch(`/api/footballers/${id}`)
  if (!res.ok) throw new Error('Failed to fetch footballer')
  return res.json()
}

export async function scrapeWikipedia(url: string): Promise<ScrapeResult> {
  const res = await fetch('/api/footballers/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Scrape failed')
  return data
}

export async function createFromScrape(data: ScrapeResult): Promise<Footballer> {
  const res = await fetch('/api/footballers/from-scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to save footballer')
  return json
}

export async function updateFootballer(
  id: number,
  data: Partial<Pick<Footballer, 'name' | 'nationality' | 'position' | 'born'>>
): Promise<Footballer> {
  const res = await fetch(`/api/footballers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to update footballer')
  return json
}

export async function updateStints(
  id: number,
  stints: Omit<CareerStint, 'id' | 'footballer_id'>[]
): Promise<CareerStint[]> {
  const res = await fetch(`/api/footballers/${id}/stints`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stints),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to update stints')
  return json
}

export async function deleteFootballer(id: number): Promise<void> {
  const res = await fetch(`/api/footballers/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete footballer')
}
