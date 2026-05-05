import { Hono } from 'hono'
import { asc, sql } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { clubs } from '../db/schema.ts'

export const clubsRouter = new Hono()

// GET /api/clubs?q=search — autocomplete, max 10 results
clubsRouter.get('/', async (c) => {
  const q = c.req.query('q') ?? ''
  if (q.length < 1) return c.json([])

  const rows = await db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubs)
    .where(sql`normalize(${clubs.name}) LIKE ${'%' + q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() + '%'}`)
    .limit(10)

  return c.json(rows)
})

// GET /api/clubs/all?q=search — list all clubs (admin)
clubsRouter.get('/all', async (c) => {
  const q = c.req.query('q') ?? ''

  const rows = q.length > 0
    ? await db
        .select({ id: clubs.id, name: clubs.name })
        .from(clubs)
        .where(sql`normalize(${clubs.name}) LIKE ${'%' + q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() + '%'}`)
        .orderBy(asc(clubs.name))
    : await db
        .select({ id: clubs.id, name: clubs.name })
        .from(clubs)
        .orderBy(asc(clubs.name))

  return c.json(rows)
})

// DELETE /api/clubs — clear all clubs
clubsRouter.delete('/', async (c) => {
  await db.delete(clubs)
  return c.json({ ok: true })
})

// POST /api/clubs/rebuild — re-seed clubs from footballer senior career stints
clubsRouter.post('/rebuild', async (c) => {
  await db.run(sql`
    INSERT OR IGNORE INTO clubs (name)
    SELECT DISTINCT TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', ''))
    FROM career_stints
    WHERE stint_type = 'senior'
  `)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(clubs)
  return c.json({ count })
})
