import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, gte, lte, and } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { days, footballers } from '../db/schema.ts'

export const daysRouter = new Hono()

// GET /api/days — list with optional ?from=&to= range
daysRouter.get('/', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')

  const conditions = []
  if (from) conditions.push(gte(days.date, from))
  if (to) conditions.push(lte(days.date, to))

  const rows = await db
    .select({
      id: days.id,
      date: days.date,
      footballer_id: days.footballer_id,
      footballer_name: footballers.name,
      created_at: days.created_at,
    })
    .from(days)
    .leftJoin(footballers, eq(days.footballer_id, footballers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(days.date)

  return c.json(rows)
})

// GET /api/days/today
daysRouter.get('/today', async (c) => {
  const today = new Date().toISOString().split('T')[0]
  const [row] = await db
    .select({
      id: days.id,
      date: days.date,
      footballer_id: days.footballer_id,
      footballer_name: footballers.name,
      created_at: days.created_at,
    })
    .from(days)
    .leftJoin(footballers, eq(days.footballer_id, footballers.id))
    .where(eq(days.date, today))
  if (!row) return c.json({ error: 'No entry for today' }, 404)
  return c.json(row)
})

// GET /api/days/:date
daysRouter.get('/:date', async (c) => {
  const date = c.req.param('date')
  const [row] = await db
    .select({
      id: days.id,
      date: days.date,
      footballer_id: days.footballer_id,
      footballer_name: footballers.name,
      created_at: days.created_at,
    })
    .from(days)
    .leftJoin(footballers, eq(days.footballer_id, footballers.id))
    .where(eq(days.date, date))
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

// PUT /api/days/:date — upsert (assign or unassign footballer)
daysRouter.put(
  '/:date',
  zValidator(
    'json',
    z.object({ footballer_id: z.number().int().nullable() })
  ),
  async (c) => {
    const date = c.req.param('date')
    const { footballer_id } = c.req.valid('json')

    const existing = await db
      .select()
      .from(days)
      .where(eq(days.date, date))

    if (existing.length > 0) {
      const [updated] = await db
        .update(days)
        .set({ footballer_id })
        .where(eq(days.date, date))
        .returning()
      return c.json(updated)
    } else {
      const [created] = await db
        .insert(days)
        .values({ date, footballer_id })
        .returning()
      return c.json(created, 201)
    }
  }
)

// DELETE /api/days — clear all footballer assignments
daysRouter.delete('/', async (c) => {
  await db.delete(days)
  return c.json({ ok: true })
})

// DELETE /api/days/:date
daysRouter.delete('/:date', async (c) => {
  const date = c.req.param('date')
  const [deleted] = await db
    .delete(days)
    .where(eq(days.date, date))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
