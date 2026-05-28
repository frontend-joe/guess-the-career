import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, sqlite } from '../db/client.ts'
import { ballon_dor_schedule } from '../db/schema.ts'

/** Map a full position string (from the footballers table) to GK | DF | MF | FW */
function abbrevPosition(pos: string | null): 'GK' | 'DF' | 'MF' | 'FW' | null {
  if (!pos) return null
  const s = pos.toLowerCase()
  if (s.includes('goalkeeper') || s.includes('goal keeper')) return 'GK'
  if (s.includes('back') || s.includes('defender') || s.includes('sweeper') || s.includes('libero')) return 'DF'
  if (s.includes('striker') || s.includes('forward') || s.includes('winger') || s.includes('attacker') || s.includes('centre forward')) return 'FW'
  if (s.includes('midfielder') || s.includes('midfield')) return 'MF'
  return null
}

export const ballonDorScheduleRouter = new Hono()

// GET /api/ballon-dor-schedule — admin list
ballonDorScheduleRouter.get('/', async (c) => {
  const rows = sqlite.prepare(`
    SELECT bds.id, bds.date, bds.ballon_dor_id, bds.created_at,
           bd.year AS ballon_dor_year
    FROM ballon_dor_schedule bds
    LEFT JOIN ballon_dors bd ON bd.id = bds.ballon_dor_id
    ORDER BY bds.date ASC
  `).all() as {
    id: number
    date: string
    ballon_dor_id: number | null
    created_at: string
    ballon_dor_year: number | null
  }[]
  return c.json(rows)
})

// GET /api/ballon-dor-schedule/rounds — game rounds
ballonDorScheduleRouter.get('/rounds', (c) => {
  const scheduleRows = sqlite.prepare(`
    SELECT bds.date, bds.ballon_dor_id,
           bd.year AS ballon_dor_year
    FROM ballon_dor_schedule bds
    JOIN ballon_dors bd ON bd.id = bds.ballon_dor_id
    WHERE bds.ballon_dor_id IS NOT NULL
    ORDER BY bds.date ASC
  `).all() as {
    date: string
    ballon_dor_id: number
    ballon_dor_year: number
  }[]

  const resolveClubs = (clubStr: string) =>
    clubStr.split(/\s*\/\s*/).filter(Boolean).map(name => {
      const row = sqlite.prepare('SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1').get(name) as { wikipedia_url: string | null } | undefined
      return { name, wikipedia_url: row?.wikipedia_url ?? null }
    })

  const rounds = scheduleRows.map(row => {
    const players = sqlite.prepare(`
      SELECT bdp.id, bdp.name, bdp.club, bdp.points, bdp.rank,
             f.name AS footballer_name, bdp.nationality,
             f.position AS footballer_position
      FROM ballon_dor_players bdp
      LEFT JOIN footballers f ON f.id = bdp.footballer_id
      WHERE bdp.ballon_dor_id = ?
      ORDER BY bdp.rank ASC
    `).all(row.ballon_dor_id) as {
      id: number
      name: string
      footballer_name: string | null
      club: string
      points: number | null
      rank: number
      nationality: string | null
      footballer_position: string | null
    }[]

    return {
      date: row.date,
      ballonDorId: row.ballon_dor_id,
      year: row.ballon_dor_year,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        club: p.club,
        clubs: resolveClubs(p.club),
        points: p.points,
        rank: p.rank,
        nationality: p.nationality ?? null,
        position: abbrevPosition(p.footballer_position),
      })),
      playerNames: players.map(p => p.footballer_name ?? p.name),
    }
  })

  return c.json(rounds)
})

// PUT /api/ballon-dor-schedule/:date — upsert
ballonDorScheduleRouter.put(
  '/:date',
  zValidator('json', z.object({ ballon_dor_id: z.number().int() })),
  async (c) => {
    const date = c.req.param('date')
    const { ballon_dor_id } = c.req.valid('json')

    const existing = await db.select().from(ballon_dor_schedule).where(eq(ballon_dor_schedule.date, date))

    if (existing.length > 0) {
      const [updated] = await db
        .update(ballon_dor_schedule)
        .set({ ballon_dor_id })
        .where(eq(ballon_dor_schedule.date, date))
        .returning()
      return c.json(updated)
    } else {
      const [created] = await db
        .insert(ballon_dor_schedule)
        .values({ date, ballon_dor_id })
        .returning()
      return c.json(created, 201)
    }
  }
)

// DELETE /api/ballon-dor-schedule — clear all
ballonDorScheduleRouter.delete('/', async (c) => {
  await db.delete(ballon_dor_schedule)
  return c.json({ ok: true })
})

// DELETE /api/ballon-dor-schedule/:date
ballonDorScheduleRouter.delete('/:date', async (c) => {
  const date = c.req.param('date')
  const [deleted] = await db
    .delete(ballon_dor_schedule)
    .where(eq(ballon_dor_schedule.date, date))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
