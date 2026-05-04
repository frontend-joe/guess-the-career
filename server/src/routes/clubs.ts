import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
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
