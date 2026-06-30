import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, sqlite } from '../db/client.ts'
import { xi_schedule, xi_matches } from '../db/schema.ts'

export const xiScheduleRouter = new Hono()

interface PlayerRow {
  id: number
  name: string
  position: string
  footballer_position: string | null
  squad_number: number | null
  nationality: string | null
  footballer_id: number | null
  club_at_time: string | null
}

interface StintRow {
  footballer_id: number
  years: string
  club: string
  wikipedia_url: string | null
  sort_order: number
}

function parseYearsRange(years: string): { start: number; end: number | null } {
  const nums = (years.match(/\d{4}/g) ?? []).map(Number)
  if (nums.length === 0) return { start: 9999, end: 9999 }
  const start = nums[0]
  if (nums.length === 1) {
    // "2018" = single season, "2018–" = ongoing
    const hasTrailingDash = /[–\-—]/.test(years.slice(4))
    return { start, end: hasTrailingDash ? null : start }
  }
  return { start, end: nums[1] }
}

function findClubAtYear(stints: StintRow[], year: number): { club: string; wikipedia_url: string | null } | null {
  if (stints.length === 0) return null
  const currentYear = new Date().getFullYear()
  for (const s of stints) {
    const { start, end } = parseYearsRange(s.years)
    if (start <= year && year <= (end ?? currentYear)) {
      return { club: s.club, wikipedia_url: s.wikipedia_url }
    }
  }
  // Fallback: most recent stint before the year
  const before = stints.filter(s => parseYearsRange(s.years).start <= year)
  if (before.length > 0) return { club: before[before.length - 1].club, wikipedia_url: before[before.length - 1].wikipedia_url }
  return { club: stints[0].club, wikipedia_url: stints[0].wikipedia_url }
}

// GET /api/xi-schedule — admin list with match metadata
xiScheduleRouter.get('/', async (c) => {
  const rows = await db
    .select({
      id: xi_schedule.id,
      date: xi_schedule.date,
      match_id: xi_schedule.match_id,
      team: xi_schedule.team,
      match_name: xi_matches.name,
      year: xi_matches.year,
      competition: xi_matches.competition,
      home_team: xi_matches.home_team,
      away_team: xi_matches.away_team,
    })
    .from(xi_schedule)
    .leftJoin(xi_matches, eq(xi_schedule.match_id, xi_matches.id))
    .orderBy(xi_schedule.date)

  return c.json(rows)
})

// GET /api/xi-schedule/rounds — all fully-assigned rounds as XiRound[] for the game
xiScheduleRouter.get('/rounds', (c) => {
  const rows = sqlite.prepare(`
    SELECT xs.date, xs.match_id, xs.team,
           m.name AS match_name, m.year, m.competition, m.home_team, m.away_team,
           comp.image_url AS competition_image_url,
           comp.wikipedia_url AS competition_wikipedia_url
    FROM xi_schedule xs
    JOIN xi_matches m ON xs.match_id = m.id
    LEFT JOIN competitions comp ON comp.pfa_toty_match_id = m.id
    WHERE xs.match_id IS NOT NULL AND xs.team IS NOT NULL
    ORDER BY xs.date ASC
  `).all() as {
    date: string
    match_id: number
    team: string
    match_name: string
    year: number
    competition: string
    home_team: string
    away_team: string
    competition_image_url: string | null
    competition_wikipedia_url: string | null
  }[]

  const rounds = rows.map(row => {
    const players = sqlite.prepare(`
      SELECT xp.id, xp.name, xp.position, f.position AS footballer_position,
             xp.squad_number, xp.footballer_id, xp.club_at_time, f.nationality
      FROM xi_players xp
      LEFT JOIN footballers f ON xp.footballer_id = f.id
      WHERE xp.match_id = ? AND xp.team = ?
      ORDER BY
        CASE xp.position WHEN 'GK' THEN 1 WHEN 'DF' THEN 2 WHEN 'MF' THEN 3 WHEN 'FW' THEN 4 ELSE 5 END,
        CASE WHEN xp.squad_number IS NULL THEN 1 ELSE 0 END,
        xp.squad_number ASC
      LIMIT 11
    `).all(row.match_id, row.team) as PlayerRow[]

    const clubRow = sqlite.prepare(
      `SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`
    ).get(row.team) as { wikipedia_url: string | null } | undefined

    // Batch-fetch senior career stints for all linked players to find club at competition time
    const footballerIds = players.map(p => p.footballer_id).filter((id): id is number => id !== null)
    const stintsByPlayer = new Map<number, StintRow[]>()
    if (footballerIds.length > 0) {
      const stints = sqlite.prepare(`
        SELECT cs.footballer_id, cs.years, cs.club, cs.sort_order, c.wikipedia_url
        FROM career_stints cs
        LEFT JOIN clubs c ON LOWER(c.name) = LOWER(cs.club)
        WHERE cs.footballer_id IN (${footballerIds.map(() => '?').join(', ')})
          AND cs.stint_type = 'senior'
        ORDER BY cs.footballer_id, cs.sort_order ASC
      `).all(...footballerIds) as StintRow[]
      for (const s of stints) {
        if (!stintsByPlayer.has(s.footballer_id)) stintsByPlayer.set(s.footballer_id, [])
        stintsByPlayer.get(s.footballer_id)!.push(s)
      }
    }

    return {
      date: row.date,
      matchId: row.match_id,
      matchName: row.match_name,
      year: row.year,
      competition: row.competition,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      team: row.team,
      teamWikipediaUrl: clubRow?.wikipedia_url ?? row.competition_wikipedia_url ?? null,
      teamImageUrl: row.competition_image_url ?? null,
      isToty: row.competition_wikipedia_url !== null,
      players: players.map(p => {
        // For TOTY rounds: prefer the stored club_at_time (scraped directly from
        // Wikipedia). When it's missing (surname-only/pitch-diagram formats),
        // fall back to the player's club at the season year from career stints.
        // For regular rounds: always use the career-stints lookup.
        const isToty = row.competition_wikipedia_url !== null
        if (isToty && p.club_at_time) {
          const clubWikiUrl = (sqlite.prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`).get(p.club_at_time) as { wikipedia_url: string | null } | undefined)?.wikipedia_url ?? null
          return {
            id: p.id,
            footballerId: p.footballer_id,
            position: p.footballer_position ?? p.position,
            squadNumber: p.squad_number,
            nationality: p.nationality ?? null,
            clubAtTime: p.club_at_time,
            clubAtTimeWikipediaUrl: clubWikiUrl,
          }
        }
        const clubAtTime = p.footballer_id !== null
          ? findClubAtYear(stintsByPlayer.get(p.footballer_id) ?? [], row.year)
          : null
        return {
          id: p.id,
          footballerId: p.footballer_id,
          position: p.footballer_position ?? p.position,
          squadNumber: p.squad_number,
          nationality: p.nationality ?? null,
          clubAtTime: clubAtTime?.club ?? null,
          clubAtTimeWikipediaUrl: clubAtTime?.wikipedia_url ?? null,
        }
      }),
      playerNames: players.map(p => p.name),
    }
  })

  return c.json(rounds)
})

// PUT /api/xi-schedule/:date — upsert assignment
xiScheduleRouter.put(
  '/:date',
  zValidator('json', z.object({
    match_id: z.number().int(),
    team: z.string().min(1),
  })),
  async (c) => {
    const date = c.req.param('date')
    const { match_id, team } = c.req.valid('json')

    const existing = await db
      .select()
      .from(xi_schedule)
      .where(eq(xi_schedule.date, date))

    if (existing.length > 0) {
      const [updated] = await db
        .update(xi_schedule)
        .set({ match_id, team })
        .where(eq(xi_schedule.date, date))
        .returning()
      return c.json(updated)
    } else {
      const [created] = await db
        .insert(xi_schedule)
        .values({ date, match_id, team })
        .returning()
      return c.json(created, 201)
    }
  }
)

// DELETE /api/xi-schedule — clear all
xiScheduleRouter.delete('/', async (c) => {
  await db.delete(xi_schedule)
  return c.json({ ok: true })
})

// DELETE /api/xi-schedule/:date
xiScheduleRouter.delete('/:date', async (c) => {
  const date = c.req.param('date')
  const [deleted] = await db
    .delete(xi_schedule)
    .where(eq(xi_schedule.date, date))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
