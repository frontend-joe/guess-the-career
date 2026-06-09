export interface Footballer {
  id: number
  name: string
  wikipedia_url: string
  nationality: string | null
  position: string | null
  all_positions: string | null
  custom_position: string | null
  style_of_play: string | null
  born: string | null
  height_cm: number | null
  photo_url: string | null
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
  stint_type: 'senior' | 'international'
}

export interface FootballerWithStints extends Footballer {
  stints: CareerStint[]
}

export interface ScrapeResult {
  name: string
  wikipedia_url: string
  nationality: string | null
  position: string | null
  all_positions: string | null
  born: string | null
  height_cm: number | null
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

export async function getFootballersPaginated(opts: {
  search?: string
  page: number
  pageSize: number
  missingNationality?: boolean
  missingPhoto?: boolean
  nonRetired?: boolean
}): Promise<{ data: Footballer[]; total: number }> {
  const params = new URLSearchParams()
  params.set('page', String(opts.page))
  params.set('pageSize', String(opts.pageSize))
  if (opts.search) params.set('search', opts.search)
  if (opts.missingNationality) params.set('missingNationality', 'true')
  if (opts.missingPhoto) params.set('missingPhoto', 'true')
  if (opts.nonRetired) params.set('nonRetired', 'true')
  const res = await fetch(`/api/footballers?${params.toString()}`)
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

export async function rescrapeFootballer(id: number): Promise<{ footballer: Footballer; stints: CareerStint[] }> {
  const res = await fetch(`/api/footballers/${id}/rescrape`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Rescrape failed')
  return data
}

export class ApiError extends Error {
  readonly code: string | undefined
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

export async function createFromScrape(data: ScrapeResult): Promise<Footballer> {
  const res = await fetch('/api/footballers/from-scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new ApiError(json.message ?? json.error ?? 'Failed to save footballer', json.error)
  return json
}

export async function updateFootballer(
  id: number,
  data: Partial<Pick<Footballer, 'name' | 'wikipedia_url' | 'nationality' | 'position' | 'all_positions' | 'custom_position' | 'born' | 'height_cm' | 'photo_url'>>
): Promise<Footballer> {
  const res = await fetch(`/api/footballers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message ?? json.error ?? 'Failed to update footballer')
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

export async function deleteAllFootballers(): Promise<void> {
  const res = await fetch('/api/footballers', { method: 'DELETE' })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? json.message ?? 'Failed to delete all footballers')
  }
}

export async function getDuplicates(): Promise<Footballer[][]> {
  const res = await fetch('/api/footballers/duplicates')
  if (!res.ok) throw new Error('Failed to fetch duplicates')
  return res.json()
}
