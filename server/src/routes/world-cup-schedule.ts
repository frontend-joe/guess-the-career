import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, sqlite } from '../db/client.ts'
import { world_cup_schedule } from '../db/schema.ts'

export const worldCupScheduleRouter = new Hono()

// GET /api/world-cup-schedule — admin list
worldCupScheduleRouter.get('/', async (c) => {
  const rows = sqlite.prepare(`
    SELECT wcs.id, wcs.date, wcs.squad_id, wcs.created_at,
           sq.year AS squad_year, sq.team AS squad_team
    FROM world_cup_schedule wcs
    LEFT JOIN world_cup_squads sq ON sq.id = wcs.squad_id
    ORDER BY wcs.date ASC
  `).all() as {
    id: number
    date: string
    squad_id: number | null
    created_at: string
    squad_year: number | null
    squad_team: string | null
  }[]
  return c.json(rows)
})

// GET /api/world-cup-schedule/rounds — game rounds
worldCupScheduleRouter.get('/rounds', (c) => {
  const scheduleRows = sqlite.prepare(`
    SELECT wcs.date, wcs.squad_id,
           sq.year AS squad_year, sq.team AS squad_team
    FROM world_cup_schedule wcs
    JOIN world_cup_squads sq ON sq.id = wcs.squad_id
    WHERE wcs.squad_id IS NOT NULL
    ORDER BY wcs.date ASC
  `).all() as {
    date: string
    squad_id: number
    squad_year: number
    squad_team: string
  }[]

  const resolveClubs = (clubStr: string) =>
    clubStr.split(/\s*\/\s*/).filter(Boolean).map(name => {
      const row = sqlite.prepare('SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1').get(name) as { wikipedia_url: string | null } | undefined
      return { name, wikipedia_url: row?.wikipedia_url ?? null }
    })

  const rounds = scheduleRows.map(row => {
    const players = sqlite.prepare(`
      SELECT p.id, p.name, p.shirt_number, p.position, p.club,
             COALESCE(f.nationality, f2.nationality, p.nationality) AS nationality,
             COALESCE(f.name, f2.name) AS footballer_name
      FROM world_cup_squad_players p
      LEFT JOIN footballers f ON f.id = p.footballer_id
      LEFT JOIN footballers f2 ON p.footballer_id IS NULL AND LOWER(f2.name) = LOWER(p.name)
      WHERE p.squad_id = ?
      ORDER BY p.shirt_number ASC, p.id ASC
    `).all(row.squad_id) as {
      id: number
      name: string
      shirt_number: number | null
      position: string | null
      club: string
      nationality: string | null
      footballer_name: string | null
    }[]

    return {
      date: row.date,
      squadId: row.squad_id,
      year: row.squad_year,
      team: row.squad_team,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        shirt_number: p.shirt_number,
        position: p.position as 'GK' | 'DF' | 'MF' | 'FW' | null,
        club: p.club,
        clubs: resolveClubs(p.club),
        nationality: p.nationality ?? null,
      })),
      playerNames: players.map(p => p.footballer_name ?? p.name),
    }
  })

  return c.json(rounds)
})

// PUT /api/world-cup-schedule/:date — upsert
worldCupScheduleRouter.put(
  '/:date',
  zValidator('json', z.object({ squad_id: z.number().int() })),
  async (c) => {
    const date = c.req.param('date')
    const { squad_id } = c.req.valid('json')

    const existing = await db.select().from(world_cup_schedule).where(eq(world_cup_schedule.date, date))

    if (existing.length > 0) {
      const [updated] = await db
        .update(world_cup_schedule)
        .set({ squad_id })
        .where(eq(world_cup_schedule.date, date))
        .returning()
      return c.json(updated)
    } else {
      const [created] = await db
        .insert(world_cup_schedule)
        .values({ date, squad_id })
        .returning()
      return c.json(created, 201)
    }
  }
)

// DELETE /api/world-cup-schedule — clear all
worldCupScheduleRouter.delete('/', async (c) => {
  await db.delete(world_cup_schedule)
  return c.json({ ok: true })
})

// DELETE /api/world-cup-schedule/:date
worldCupScheduleRouter.delete('/:date', async (c) => {
  const date = c.req.param('date')
  const [deleted] = await db
    .delete(world_cup_schedule)
    .where(eq(world_cup_schedule.date, date))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
