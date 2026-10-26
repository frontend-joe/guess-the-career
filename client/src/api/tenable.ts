export type Metric = 'goals' | 'apps'

export interface TenableTypeCard {
  slug: string
  label: string
  description: string
  example: string
  available: number
  selected: number
}

export interface TenableCandidate {
  type: string
  params: Record<string, string>
  metric: Metric
  title: string
  answer_count: number
  roundId: number | null
}

export interface TenableClue {
  nationality: string | null
  position: string | null
  years: string | null
  club: string | null
  clubWikiUrl: string | null
  squadNumber: number | null
  born: string | null
}

export interface TenableAnswer {
  footballer_id: number | null
  name: string
  nationality: string | null
  photo_url: string | null
  value: number
  unit?: string
  rank?: number | null
  clue?: TenableClue | null
}

export interface TenableRound {
  id: number
  type: string
  params: Record<string, string>
  metric: Metric
  title: string
  answer_count: number
  enabled: number
}

export interface TenableScheduleEntry {
  id: number
  date: string
  round_id: number | null
  title: string | null
  type: string | null
  metric: string | null
}

// Metadata only — answers are fetched per round (see getTenableRoundAnswers).
export interface TenablePlayRound {
  date: string
  roundId: number
  type: string
  title: string
  metric: Metric
  ordered: boolean
  target: number
  answerCount: number
}

export interface TenableRoundAnswers {
  roundId: number
  ordered: boolean
  target: number
  /** Clue fields the question already gives away, so they aren't shown. */
  impliedClues: string[]
  answers: TenableAnswer[]
}

export async function getTenableRoundAnswers(roundId: number): Promise<TenableRoundAnswers> {
  const res = await fetch(`/api/tenable/schedule/rounds/${roundId}/answers`)
  if (!res.ok) throw new Error('Failed to load round')
  return res.json()
}

export async function getTenableTypes(): Promise<{ data: TenableTypeCard[]; minAnswers: number }> {
  const res = await fetch('/api/tenable/admin/types')
  if (!res.ok) throw new Error('Failed to load Tenable types')
  return res.json()
}

export async function getTenableCandidates(slug: string, q = ''): Promise<{ data: TenableCandidate[]; total: number }> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  const res = await fetch(`/api/tenable/admin/types/${slug}/candidates?${params}`)
  if (!res.ok) throw new Error('Failed to load candidates')
  return res.json()
}

export async function previewTenableRound(
  type: string,
  params: Record<string, string>,
  metric: Metric,
): Promise<TenableAnswer[]> {
  const qs = new URLSearchParams({ type, metric, params: JSON.stringify(params) })
  const res = await fetch(`/api/tenable/admin/preview?${qs}`)
  if (!res.ok) throw new Error('Failed to preview round')
  return res.json()
}

export async function selectTenableRound(c: TenableCandidate): Promise<{ id: number }> {
  const res = await fetch('/api/tenable/admin/rounds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: c.type, params: c.params, metric: c.metric,
      title: c.title, answer_count: c.answer_count,
    }),
  })
  if (!res.ok) throw new Error('Failed to select round')
  return res.json()
}

export async function deselectTenableRound(id: number): Promise<void> {
  const res = await fetch(`/api/tenable/admin/rounds/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to remove round')
}

export async function getTenableRounds(): Promise<TenableRound[]> {
  const res = await fetch('/api/tenable/admin/rounds')
  if (!res.ok) throw new Error('Failed to load rounds')
  return res.json()
}

export async function getTenableSchedule(): Promise<TenableScheduleEntry[]> {
  const res = await fetch('/api/tenable/schedule')
  if (!res.ok) throw new Error('Failed to load schedule')
  return res.json()
}

export async function assignTenableDay(date: string, roundId: number): Promise<void> {
  const res = await fetch(`/api/tenable/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId }),
  })
  if (!res.ok) throw new Error('Failed to assign day')
}

export async function deleteTenableDay(date: string): Promise<void> {
  const res = await fetch(`/api/tenable/schedule/${date}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear day')
}

export async function clearTenableSchedule(): Promise<void> {
  const res = await fetch('/api/tenable/schedule', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear schedule')
}

export async function getTenablePlayRounds(): Promise<TenablePlayRound[]> {
  const res = await fetch('/api/tenable/schedule/rounds')
  if (!res.ok) throw new Error('Failed to load rounds')
  return res.json()
}

export interface TenableVerifyResult {
  valid: boolean
  rank?: number | null
  value?: number | null
  unit?: string | null
  metric?: Metric
  nearMiss?: boolean
  footballerId?: number
  footballer?: { id: number; name: string; photo_url: string | null }
  answers?: TenableAnswer[]
  reason?: string
}

// A guess that isn't on the board: the server resolves/scrapes the player and
// recomputes the round, so a qualifying newcomer displaces the weakest answer.
export async function verifyTenableGuess(roundId: number, name: string): Promise<TenableVerifyResult> {
  const res = await fetch('/api/tenable/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId, name }),
  })
  if (!res.ok) return { valid: false, reason: 'request_failed' }
  return res.json()
}

// Select (or clear) every available round — one type, or all of them.
export async function bulkSelectTenable(opts: { type?: string; deselect?: boolean } = {}): Promise<{ added?: number; total?: number; removed?: number }> {
  const res = await fetch('/api/tenable/admin/rounds/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
  if (!res.ok) throw new Error('Failed to bulk select rounds')
  return res.json()
}

// Drop selected rounds that no longer have 10+ answers (e.g. after the league
// allow-list changed), unscheduling them too.
export async function pruneTenableRounds(): Promise<{ checked: number; pruned: number; unscheduled: number }> {
  const res = await fetch('/api/tenable/admin/rounds/prune', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to prune rounds')
  return res.json()
}

// Schedule every unscheduled round server-side, in one transaction.
export async function autoAssignTenable(): Promise<{ assigned: number; from: string | null; to: string | null }> {
  const res = await fetch('/api/tenable/schedule/auto-assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error('Failed to auto-assign')
  return res.json()
}
