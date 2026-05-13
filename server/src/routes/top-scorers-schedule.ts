import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, sqlite } from '../db/client.ts'
import { top_scorers_schedule } from '../db/schema.ts'

export const topScorersScheduleRouter = new Hono()

// GET /api/top-scorers-schedule — admin list
topScorersScheduleRouter.get('/', async (c) => {
  const rows = sqlite.prepare(`
    SELECT tss.id, tss.date, tss.competition_id, tss.created_at,
           comp.name AS competition_name, comp.image_url AS competition_image_url
    FROM top_scorers_schedule tss
    LEFT JOIN competitions comp ON comp.id = tss.competition_id
    ORDER BY tss.date ASC
  `).all() as {
    id: number
    date: string
    competition_id: number | null
    created_at: string
    competition_name: string | null
    competition_image_url: string | null
  }[]
  return c.json(rows)
})

// GET /api/top-scorers-schedule/rounds — game rounds
topScorersScheduleRouter.get('/rounds', (c) => {
  const scheduleRows = sqlite.prepare(`
    SELECT tss.date, tss.competition_id,
           comp.name AS competition_name, comp.image_url AS competition_image_url
    FROM top_scorers_schedule tss
    JOIN competitions comp ON comp.id = tss.competition_id
    WHERE tss.competition_id IS NOT NULL
    ORDER BY tss.date ASC
  `).all() as {
    date: string
    competition_id: number
    competition_name: string
    competition_image_url: string | null
  }[]

  const rounds = scheduleRows.map(row => {
    const players = sqlite.prepare(`
      SELECT cts.id, cts.name, cts.club, cts.goals, cts.rank,
             f.name AS footballer_name, f.nationality,
             c.wikipedia_url AS club_wikipedia_url
      FROM competition_top_scorers cts
      LEFT JOIN footballers f ON f.id = cts.footballer_id
      LEFT JOIN clubs c ON LOWER(c.name) = LOWER(cts.club)
      WHERE cts.competition_id = ?
      ORDER BY cts.rank ASC
    `).all(row.competition_id) as {
      id: number
      name: string
      footballer_name: string | null
      club: string
      goals: number
      rank: number
      nationality: string | null
      club_wikipedia_url: string | null
    }[]

    const resolveClubs = (clubStr: string) =>
      clubStr.split(/\s*\/\s*/).filter(Boolean).map(name => {
        const row = sqlite.prepare('SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1').get(name) as { wikipedia_url: string | null } | undefined
        return { name, wikipedia_url: row?.wikipedia_url ?? null }
      })

    return {
      date: row.date,
      competitionId: row.competition_id,
      competitionName: row.competition_name,
      competitionImageUrl: row.competition_image_url,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        club: p.club,
        clubs: resolveClubs(p.club),
        goals: p.goals,
        rank: p.rank,
        nationality: p.nationality ?? null,
        clubWikipediaUrl: p.club_wikipedia_url ?? null,
      })),
      playerNames: players.map(p => p.footballer_name ?? p.name),
    }
  })

  return c.json(rounds)
})

// PUT /api/top-scorers-schedule/:date — upsert
topScorersScheduleRouter.put(
  '/:date',
  zValidator('json', z.object({ competition_id: z.number().int() })),
  async (c) => {
    const date = c.req.param('date')
    const { competition_id } = c.req.valid('json')

    const existing = await db.select().from(top_scorers_schedule).where(eq(top_scorers_schedule.date, date))

    if (existing.length > 0) {
      const [updated] = await db
        .update(top_scorers_schedule)
        .set({ competition_id })
        .where(eq(top_scorers_schedule.date, date))
        .returning()
      return c.json(updated)
    } else {
      const [created] = await db
        .insert(top_scorers_schedule)
        .values({ date, competition_id })
        .returning()
      return c.json(created, 201)
    }
  }
)

// DELETE /api/top-scorers-schedule — clear all
topScorersScheduleRouter.delete('/', async (c) => {
  await db.delete(top_scorers_schedule)
  return c.json({ ok: true })
})

// DELETE /api/top-scorers-schedule/:date
topScorersScheduleRouter.delete('/:date', async (c) => {
  const date = c.req.param('date')
  const [deleted] = await db
    .delete(top_scorers_schedule)
    .where(eq(top_scorers_schedule.date, date))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
