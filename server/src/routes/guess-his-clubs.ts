import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'

export const guessHisClubsRouter = new Hono()

function normalizeClubName(club: string): string {
  return club.replace(/^→\s*/, '').replace(/\s*\(loan\)\s*$/i, '').trim()
}

function requiredGuesses(clubCount: number): number {
  let min: number
  let max: number
  if (clubCount <= 4) { min = 2; max = 3 }
  else if (clubCount <= 7) { min = 2; max = 4 }
  else if (clubCount === 8) { min = 3; max = 5 }
  else if (clubCount <= 10) { min = 4; max = 6 }
  else { min = 4; max = 6 }
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// GET /api/guess-his-clubs/session
// Returns 10 random footballers with 4+ distinct senior clubs (loans included, normalised)
guessHisClubsRouter.get('/session', (c) => {
  // Subquery avoids passing hundreds of IDs as SQL parameters (SQLite limit: 999 variables).
  // HAVING uses the same normalisation as the app so multi-spell duplicates don't inflate the count.
  const selected = sqlite.prepare(`
    SELECT f.id, f.name, f.wikipedia_url
    FROM footballers f
    WHERE f.id IN (
      SELECT footballer_id
      FROM career_stints
      WHERE stint_type = 'senior'
      GROUP BY footballer_id
      HAVING COUNT(DISTINCT LOWER(TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')))) >= 4
    )
    ORDER BY RANDOM()
    LIMIT 10
  `).all() as { id: number; name: string; wikipedia_url: string }[]

  if (selected.length < 10) {
    return c.json({ error: 'Not enough eligible footballers' }, 422)
  }

  const placeholders = selected.map(() => '?').join(', ')
  const selectedIds = selected.map(f => f.id)

  const stints = sqlite.prepare(`
    SELECT footballer_id, sort_order, club
    FROM career_stints
    WHERE footballer_id IN (${placeholders})
      AND stint_type = 'senior'
    ORDER BY footballer_id, sort_order
  `).all(...selectedIds) as { footballer_id: number; sort_order: number; club: string }[]

  const stintMap = new Map<number, typeof stints>()
  for (const stint of stints) {
    const arr = stintMap.get(stint.footballer_id) ?? []
    arr.push(stint)
    stintMap.set(stint.footballer_id, arr)
  }

  const result = selected.map(f => {
    const seen = new Set<string>()
    const clubs = (stintMap.get(f.id) ?? [])
      .map(s => normalizeClubName(s.club))
      .filter(c => {
        const key = c.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    return {
      id: f.id,
      name: f.name,
      wikipedia_url: f.wikipedia_url,
      clubs,
      required: requiredGuesses(clubs.length),
    }
  })

  return c.json(result)
})
