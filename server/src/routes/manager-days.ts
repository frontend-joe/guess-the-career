import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, gte, lte, and } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { manager_days, managers } from '../db/schema.ts'

export const managerDaysRouter = new Hono()

// GET /api/manager-days
managerDaysRouter.get('/', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')

  const conditions = []
  if (from) conditions.push(gte(manager_days.date, from))
  if (to) conditions.push(lte(manager_days.date, to))

  const rows = await db
    .select({
      id: manager_days.id,
      date: manager_days.date,
      manager_id: manager_days.manager_id,
      manager_name: managers.name,
      created_at: manager_days.created_at,
    })
    .from(manager_days)
    .leftJoin(managers, eq(manager_days.manager_id, managers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(manager_days.date)

  return c.json(rows)
})

// GET /api/manager-days/today
managerDaysRouter.get('/today', async (c) => {
  const today = new Date().toISOString().split('T')[0]
  const [row] = await db
    .select({
      id: manager_days.id,
      date: manager_days.date,
      manager_id: manager_days.manager_id,
      manager_name: managers.name,
      created_at: manager_days.created_at,
    })
    .from(manager_days)
    .leftJoin(managers, eq(manager_days.manager_id, managers.id))
    .where(eq(manager_days.date, today))
  if (!row) return c.json({ error: 'No entry for today' }, 404)
  return c.json(row)
})

// GET /api/manager-days/:date
managerDaysRouter.get('/:date', async (c) => {
  const date = c.req.param('date')
  const [row] = await db
    .select({
      id: manager_days.id,
      date: manager_days.date,
      manager_id: manager_days.manager_id,
      manager_name: managers.name,
      created_at: manager_days.created_at,
    })
    .from(manager_days)
    .leftJoin(managers, eq(manager_days.manager_id, managers.id))
    .where(eq(manager_days.date, date))
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

// PUT /api/manager-days/:date
managerDaysRouter.put(
  '/:date',
  zValidator('json', z.object({ manager_id: z.number().int().nullable() })),
  async (c) => {
    const date = c.req.param('date')
    const { manager_id } = c.req.valid('json')

    const existing = await db.select().from(manager_days).where(eq(manager_days.date, date))

    if (existing.length > 0) {
      const [updated] = await db
        .update(manager_days)
        .set({ manager_id })
        .where(eq(manager_days.date, date))
        .returning()
      return c.json(updated)
    } else {
      const [created] = await db
        .insert(manager_days)
        .values({ date, manager_id })
        .returning()
      return c.json(created, 201)
    }
  }
)

// DELETE /api/manager-days
managerDaysRouter.delete('/', async (c) => {
  await db.delete(manager_days)
  return c.json({ ok: true })
})

// DELETE /api/manager-days/:date
managerDaysRouter.delete('/:date', async (c) => {
  const date = c.req.param('date')
  const [deleted] = await db
    .delete(manager_days)
    .where(eq(manager_days.date, date))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
