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
  first_name: string | null
  surname: string | null
  full_name: string | null
  name_confirmed?: number
  name_ambiguous?: number
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

export interface CardStint {
  years: string
  club: string
  club_wikipedia_url: string | null
  apps: number | null
  goals: number | null
  stint_type: 'senior' | 'international'
}

export interface FootballerCard {
  id: number
  name: string
  full_name: string | null
  born: string | null
  birthplace: string | null
  height_cm: number | null
  position: string | null
  all_positions: string | null
  photo_url: string | null
  nationality: string | null
  wikipedia_url: string
  stints: CardStint[]
  relations?: { footballerId: number; name: string; relationship: string | null }[]
}

export async function getFootballerCard(id: number): Promise<FootballerCard> {
  // Bypass the browser HTTP cache so club badge / stint fixes show immediately.
  const res = await fetch(`/api/footballers/${id}/card`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load player')
  return res.json()
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
  missingCareerStats?: boolean
  nonRetired?: boolean
  missingCaps?: boolean
}): Promise<{ data: Footballer[]; total: number }> {
  const params = new URLSearchParams()
  params.set('page', String(opts.page))
  params.set('pageSize', String(opts.pageSize))
  if (opts.search) params.set('search', opts.search)
  if (opts.missingNationality) params.set('missingNationality', 'true')
  if (opts.missingPhoto) params.set('missingPhoto', 'true')
  if (opts.missingCareerStats) params.set('missingCareerStats', 'true')
  if (opts.nonRetired) params.set('nonRetired', 'true')
  if (opts.missingCaps) params.set('missingCaps', 'true')
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
  data: Partial<Pick<Footballer, 'name' | 'wikipedia_url' | 'nationality' | 'position' | 'all_positions' | 'custom_position' | 'born' | 'height_cm' | 'photo_url' | 'first_name' | 'surname' | 'full_name'>>
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

// Per-club-season league breakdown from the Wikipedia "Career statistics" table.
export interface CareerStatRow {
  club: string
  club_wikipedia_url: string | null
  season: string
  division: string | null
  league: string | null
  league_apps: number | null
  league_goals: number | null
  total_apps: number | null
  total_goals: number | null
}

export async function getCareerStats(id: number): Promise<CareerStatRow[]> {
  const res = await fetch(`/api/footballers/${id}/career-stats`)
  if (!res.ok) throw new Error('Failed to load career statistics')
  return res.json()
}

// ── Name splitting (first name / surname) ───────────────────────────────────
export interface NameReviewRow {
  id: number
  name: string
  nationality: string | null
  first_name: string | null
  surname: string | null
  name_confirmed: number
  name_ambiguous: number
  name_split_reason: string | null
}

export interface NameReviewResult {
  data: NameReviewRow[]
  total: number
  page: number
  pageSize: number
  counts: { ambiguous: number; confirmed: number; total: number }
}

export async function getNameReview(opts: {
  filter?: string
  q?: string
  page?: number
  pageSize?: number
} = {}): Promise<NameReviewResult> {
  const params = new URLSearchParams()
  if (opts.filter) params.set('filter', opts.filter)
  if (opts.q) params.set('q', opts.q)
  if (opts.page) params.set('page', String(opts.page))
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize))
  const res = await fetch(`/api/footballers/names/review?${params}`)
  if (!res.ok) throw new Error('Failed to load name review')
  return res.json()
}

export async function saveNameSplit(
  id: number,
  body: { first_name: string | null; surname: string; confirmed?: boolean },
): Promise<void> {
  const res = await fetch(`/api/footballers/${id}/name-split`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to save name split')
}

export async function recomputeNameSplits(): Promise<{ updated: number; ambiguous: number }> {
  const res = await fetch('/api/footballers/names/recompute', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to recompute name splits')
  return res.json()
}

export type DerivedSpellStatus = 'resolved' | 'straddled' | 'other_league' | 'no_club_data'

export interface DerivedSpell {
  years: string
  club: string
  apps: number
  goals: number
  is_loan: boolean
  club_wikipedia_url: string | null
  leagues: string[]
  league: string | null
  status: DerivedSpellStatus
  source_url: string | null
}

export interface DerivedSpells {
  /** True when this player has no scraped stats, so these spells are what the games actually use. */
  usesStintFallback: boolean
  spells: DerivedSpell[]
}

export async function getDerivedSpells(id: number): Promise<DerivedSpells> {
  const res = await fetch(`/api/footballers/${id}/derived-spells`)
  if (!res.ok) throw new Error('Failed to load derived spells')
  return res.json()
}
