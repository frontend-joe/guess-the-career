import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, sql, notInArray, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { managers, manager_career_stints, manager_days } from '../db/schema.ts'
import { scrapeManagerWikipedia } from '../services/scraper.ts'

export const managersRouter = new Hono()

const stintSchema = z.object({
  sort_order: z.number().int(),
  years: z.string(),
  club: z.string(),
  apps: z.number().int().nullable(),
  goals: z.number().int().nullable(),
  stint_type: z.enum(['managerial']).default('managerial'),
})

// GET /api/managers
managersRouter.get('/', async (c) => {
  const search = c.req.query('search')
  const unassigned = c.req.query('unassigned') === 'true'
  const excludeDate = c.req.query('excludeDate')

  const conditions = []

  if (search) {
    const normalized = search.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    conditions.push(sql`normalize(${managers.name}) LIKE ${`%${normalized}%`}`)
  }

  if (unassigned) {
    const assignedRows = await db
      .selectDistinct({ manager_id: manager_days.manager_id })
      .from(manager_days)
      .where(isNotNull(manager_days.manager_id))

    let excludeId: number | null = null
    if (excludeDate) {
      const [currentDay] = await db
        .select({ manager_id: manager_days.manager_id })
        .from(manager_days)
        .where(eq(manager_days.date, excludeDate))
      excludeId = currentDay?.manager_id ?? null
    }

    const assignedIds = assignedRows
      .map((r) => r.manager_id as number)
      .filter((id) => id !== excludeId)

    if (assignedIds.length > 0) {
      conditions.push(notInArray(managers.id, assignedIds))
    }
  }

  const rows = await db
    .select()
    .from(managers)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return c.json(rows)
})

// POST /api/managers/scrape
managersRouter.post(
  '/scrape',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    try {
      const result = await scrapeManagerWikipedia(url)
      return c.json(result)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Scrape failed'
      return c.json({ error: message }, 400)
    }
  }
)

// POST /api/managers/from-scrape
managersRouter.post(
  '/from-scrape',
  zValidator(
    'json',
    z.object({
      name: z.string(),
      wikipedia_url: z.string().url(),
      place_of_birth: z.string().nullable(),
      born: z.string().nullable(),
      stints: z.array(stintSchema),
    })
  ),
  async (c) => {
    const body = c.req.valid('json')

    const [existing] = await db
      .select({ id: managers.id })
      .from(managers)
      .where(sql`LOWER(${managers.name}) = LOWER(${body.name})`)
      .limit(1)
    if (existing) {
      return c.json({ error: 'already_exists', message: `${body.name} is already in the database` }, 409)
    }

    let manager
    try {
      ;[manager] = await db
        .insert(managers)
        .values({
          name: body.name,
          wikipedia_url: body.wikipedia_url,
          place_of_birth: body.place_of_birth,
          born: body.born,
        })
        .returning()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('UNIQUE constraint failed')) {
        return c.json({ error: 'already_exists', message: `${body.name} is already in the database` }, 409)
      }
      throw e
    }
    if (body.stints.length > 0) {
      await db.insert(manager_career_stints).values(
        body.stints.map((s) => ({ ...s, manager_id: manager.id }))
      )
    }
    return c.json(manager, 201)
  }
)

// GET /api/managers/duplicates
managersRouter.get('/duplicates', async (c) => {
  const all = await db.select().from(managers).orderBy(managers.name)
  const groups = new Map<string, typeof all>()
  for (const m of all) {
    const key = m.name.toLowerCase().trim()
    const group = groups.get(key) ?? []
    group.push(m)
    groups.set(key, group)
  }
  const dupes = [...groups.values()].filter(g => g.length > 1)
  return c.json(dupes)
})

// GET /api/managers/rescrape-all
managersRouter.get('/rescrape-all', async (c) => {
  const abortSignal = c.req.raw.signal
  return streamSSE(c, async (stream) => {
    const all = await db
      .select({ id: managers.id, name: managers.name, url: managers.wikipedia_url })
      .from(managers)
      .orderBy(managers.name)

    await stream.writeSSE({
      data: JSON.stringify({ type: 'init', total: all.length, players: all.map(p => ({ id: p.id, name: p.name })) }),
    })

    for (const manager of all) {
      if (abortSignal.aborted) break

      await stream.writeSSE({ data: JSON.stringify({ type: 'start', id: manager.id }) })

      try {
        const result = await scrapeManagerWikipedia(manager.url)

        await db.update(managers)
          .set({ name: result.name, place_of_birth: result.place_of_birth, born: result.born, updated_at: sql`(datetime('now'))` })
          .where(eq(managers.id, manager.id))

        await db.delete(manager_career_stints).where(eq(manager_career_stints.manager_id, manager.id))
        if (result.stints.length > 0) {
          await db.insert(manager_career_stints).values(
            result.stints.map((s, i) => ({ ...s, sort_order: i, manager_id: manager.id }))
          )
        }

        await stream.writeSSE({
          data: JSON.stringify({
            type: 'done',
            id: manager.id,
            stints: result.stints.length,
            intl: 0,
            place_of_birth: result.place_of_birth,
          }),
        })
      } catch (e) {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'failed', id: manager.id, error: e instanceof Error ? e.message : 'Unknown error' }),
        })
      }

      await new Promise<void>(r => setTimeout(r, 500))
    }

    await stream.writeSSE({ data: JSON.stringify({ type: 'complete' }) })
  })
})

// DELETE /api/managers
managersRouter.delete('/', async (c) => {
  await db.delete(managers)
  return c.json({ ok: true })
})

// GET /api/managers/:id
managersRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const [manager] = await db
    .select()
    .from(managers)
    .where(eq(managers.id, id))
  if (!manager) return c.json({ error: 'Not found' }, 404)

  const stints = await db
    .select()
    .from(manager_career_stints)
    .where(eq(manager_career_stints.manager_id, id))
    .orderBy(manager_career_stints.sort_order)

  return c.json({ ...manager, stints })
})

// PATCH /api/managers/:id
managersRouter.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().optional(),
      place_of_birth: z.string().nullable().optional(),
      born: z.string().nullable().optional(),
      photo_url: z.string().nullable().optional(),
    })
  ),
  async (c) => {
    const id = parseInt(c.req.param('id'))
    const body = c.req.valid('json')
    const [updated] = await db
      .update(managers)
      .set({ ...body, updated_at: sql`(datetime('now'))` })
      .where(eq(managers.id, id))
      .returning()
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  }
)

// DELETE /api/managers/:id
managersRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const [deleted] = await db
    .delete(managers)
    .where(eq(managers.id, id))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

// PUT /api/managers/:id/stints
managersRouter.put(
  '/:id/stints',
  zValidator('json', z.array(stintSchema)),
  async (c) => {
    const id = parseInt(c.req.param('id'))
    const body = c.req.valid('json')
    await db.delete(manager_career_stints).where(eq(manager_career_stints.manager_id, id))
    if (body.length > 0) {
      await db.insert(manager_career_stints).values(
        body.map((s) => ({ ...s, manager_id: id }))
      )
    }
    const stints = await db
      .select()
      .from(manager_career_stints)
      .where(eq(manager_career_stints.manager_id, id))
      .orderBy(manager_career_stints.sort_order)
    return c.json(stints)
  }
)
