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
        .select({ id: clubs.id, name: clubs.name, wikipedia_url: clubs.wikipedia_url })
        .from(clubs)
        .where(sql`normalize(${clubs.name}) LIKE ${'%' + q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() + '%'}`)
        .orderBy(asc(clubs.name))
    : await db
        .select({ id: clubs.id, name: clubs.name, wikipedia_url: clubs.wikipedia_url })
        .from(clubs)
        .orderBy(asc(clubs.name))

  return c.json(rows)
})

// DELETE /api/clubs — clear all clubs
clubsRouter.delete('/', async (c) => {
  await db.delete(clubs)
  return c.json({ ok: true })
})

// POST /api/clubs/rebuild — re-seed clubs from footballer senior career stints (reserve teams excluded)
clubsRouter.post('/rebuild', async (c) => {
  await db.run(sql`
    INSERT INTO clubs (name, wikipedia_url)
    SELECT
      TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')) AS norm_name,
      MIN(club_wikipedia_url) AS wiki_url
    FROM career_stints
    WHERE stint_type = 'senior'
      AND TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')) NOT LIKE '% B'
      AND TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')) NOT LIKE '% C'
      AND TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')) NOT LIKE '% II'
      AND TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')) != 'Bilbao Athletic'
    GROUP BY LOWER(TRIM(REPLACE(REPLACE(REPLACE(club, '→ ', ''), ' (loan)', ''), '(loan)', '')))
    ON CONFLICT(name) DO UPDATE SET wikipedia_url = COALESCE(excluded.wikipedia_url, clubs.wikipedia_url)
  `)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(clubs)
  return c.json({ count })
})
