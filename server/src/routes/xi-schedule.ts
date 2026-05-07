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
  squad_number: number | null
  nationality: string | null
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
           m.name AS match_name, m.year, m.competition, m.home_team, m.away_team
    FROM xi_schedule xs
    JOIN xi_matches m ON xs.match_id = m.id
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
  }[]

  const rounds = rows.map(row => {
    const players = sqlite.prepare(`
      SELECT xp.id, xp.name, xp.position, xp.squad_number, f.nationality
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

    return {
      date: row.date,
      matchId: row.match_id,
      matchName: row.match_name,
      year: row.year,
      competition: row.competition,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      team: row.team,
      teamWikipediaUrl: clubRow?.wikipedia_url ?? null,
      players: players.map(p => ({
        id: p.id,
        position: p.position,
        squadNumber: p.squad_number,
        nationality: p.nationality ?? null,
      })),
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
