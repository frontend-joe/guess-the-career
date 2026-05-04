import { Hono } from 'hono'
import { sql, inArray } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { footballers, career_stints } from '../db/schema.ts'

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
guessHisClubsRouter.get('/session', async (c) => {
  // Find footballer IDs with 4+ senior stints (counting loans)
  const eligible = await db
    .select({ footballer_id: career_stints.footballer_id })
    .from(career_stints)
    .where(sql`${career_stints.stint_type} = 'senior'`)
    .groupBy(career_stints.footballer_id)
    .having(sql`COUNT(*) >= 4`)

  const eligibleIds = eligible.map(r => r.footballer_id)

  if (eligibleIds.length < 10) {
    return c.json({ error: 'Not enough eligible footballers' }, 422)
  }

  // Pick 10 at random
  const selected = await db
    .select({ id: footballers.id, name: footballers.name })
    .from(footballers)
    .where(inArray(footballers.id, eligibleIds))
    .orderBy(sql`RANDOM()`)
    .limit(10)

  const selectedIds = selected.map(f => f.id)

  // Fetch all senior stints for the selected footballers
  const stints = await db
    .select({
      footballer_id: career_stints.footballer_id,
      sort_order: career_stints.sort_order,
      years: career_stints.years,
      club: career_stints.club,
    })
    .from(career_stints)
    .where(
      sql`${career_stints.footballer_id} IN (${sql.join(selectedIds.map(id => sql`${id}`), sql`, `)})
          AND ${career_stints.stint_type} = 'senior'`
    )
    .orderBy(career_stints.footballer_id, career_stints.sort_order)

  // Group stints by footballer
  const stintMap = new Map<number, typeof stints>()
  for (const stint of stints) {
    const arr = stintMap.get(stint.footballer_id) ?? []
    arr.push(stint)
    stintMap.set(stint.footballer_id, arr)
  }

  const result = selected.map(f => {
    const rawStints = stintMap.get(f.id) ?? []
    const clubs = rawStints.map(s => normalizeClubName(s.club))
    return {
      id: f.id,
      name: f.name,
      clubs,
      required: requiredGuesses(clubs.length),
    }
  })

  return c.json(result)
})
