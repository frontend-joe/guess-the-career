import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'
import { normalizeClubAlias } from '../services/scraper.ts'

export const guessHisClubsRouter = new Hono()

// Strip loan/→ markers AND collapse alias variants (e.g. "Borussia Dortmund" →
// "Dortmund") so the same club isn't counted twice.
function normalizeClubName(club: string): string {
  return normalizeClubAlias(club)
}

function isReserveTeam(club: string): boolean {
  return / [BC]$/.test(club) || / II$/.test(club) || club === 'Bilbao Athletic'
}

function requiredGuesses(clubCount: number): number {
  let min: number
  let max: number
  if (clubCount <= 4) { min = 2; max = 2 }
  else if (clubCount <= 7) { min = 2; max = 3 }
  else if (clubCount === 8) { min = 3; max = 4 }
  else if (clubCount <= 10) { min = 3; max = 5 }
  else { min = 3; max = 5 }
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// GET /api/guess-his-clubs/session
// Returns 10 random footballers with 4+ distinct senior clubs (loans included, normalised).
// Accepts ?exclude=1,2,3 to avoid recently-seen player IDs; falls back to full pool if needed.
guessHisClubsRouter.get('/session', (c) => {
  const excludeIds = (c.req.query('exclude') ?? '')
    .split(',').map(Number).filter(n => n > 0)

  function fetchSelected(withExclusion: boolean) {
    const clause = withExclusion && excludeIds.length > 0
      ? `AND f.id NOT IN (${excludeIds.map(() => '?').join(', ')})`
      : ''
    const params = withExclusion && excludeIds.length > 0 ? excludeIds : []
    return sqlite.prepare(`
      SELECT f.id, f.name, f.wikipedia_url, f.photo_url
      FROM footballers f
      WHERE f.id IN (
        SELECT footballer_id
        FROM career_stints
        WHERE stint_type = 'senior'
          AND TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')) NOT LIKE '% B'
          AND TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')) NOT LIKE '% C'
          AND TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')) NOT LIKE '% II'
          AND TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')) != 'Bilbao Athletic'
        GROUP BY footballer_id
        HAVING COUNT(DISTINCT LOWER(TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')))) >= 4
      )
      ${clause}
      ORDER BY RANDOM()
      LIMIT 10
    `).all(...params) as { id: number; name: string; wikipedia_url: string; photo_url: string | null }[]
  }

  let selected = fetchSelected(true)
  if (selected.length < 10) selected = fetchSelected(false)

  if (selected.length < 10) {
    return c.json({ error: 'Not enough eligible footballers' }, 422)
  }

  const placeholders = selected.map(() => '?').join(', ')
  const selectedIds = selected.map(f => f.id)

  const stints = sqlite.prepare(`
    SELECT footballer_id, sort_order, club, club_wikipedia_url
    FROM career_stints
    WHERE footballer_id IN (${placeholders})
      AND stint_type = 'senior'
    ORDER BY footballer_id, sort_order
  `).all(...selectedIds) as { footballer_id: number; sort_order: number; club: string; club_wikipedia_url: string | null }[]

  const stintMap = new Map<number, typeof stints>()
  for (const stint of stints) {
    const arr = stintMap.get(stint.footballer_id) ?? []
    arr.push(stint)
    stintMap.set(stint.footballer_id, arr)
  }

  const result = selected.map(f => {
    const seen = new Set<string>()
    const wikiUrls: Record<string, string> = {}
    const clubs = (stintMap.get(f.id) ?? [])
      .map(s => ({ name: normalizeClubName(s.club), url: s.club_wikipedia_url }))
      .filter(({ name }) => !isReserveTeam(name))
      .filter(({ name }) => {
        const key = name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map(({ name, url }) => {
        if (url) wikiUrls[name.toLowerCase()] = url
        return name
      })
    return {
      id: f.id,
      name: f.name,
      wikipedia_url: f.wikipedia_url,
      photo_url: f.photo_url,
      clubs,
      clubWikiUrls: wikiUrls,
      required: requiredGuesses(clubs.length),
    }
  })

  return c.json(result)
})
