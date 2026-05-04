import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, sql, notInArray, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { footballers, career_stints, days } from '../db/schema.ts'
import { scrapeWikipedia } from '../services/scraper.ts'

export const footballersRouter = new Hono()

const stintSchema = z.object({
  sort_order: z.number().int(),
  years: z.string(),
  club: z.string(),
  apps: z.number().int().nullable(),
  goals: z.number().int().nullable(),
  stint_type: z.enum(['senior', 'international']).default('senior'),
})

// GET /api/footballers
// ?search=  filter by name
// ?unassigned=true  only return footballers not assigned to any day
// ?excludeDate=YYYY-MM-DD  when combined with unassigned, also include the footballer on that date
footballersRouter.get('/', async (c) => {
  const search = c.req.query('search')
  const unassigned = c.req.query('unassigned') === 'true'
  const excludeDate = c.req.query('excludeDate')

  const conditions = []

  if (search) {
    const normalized = search.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    conditions.push(sql`normalize(${footballers.name}) LIKE ${`%${normalized}%`}`)
  }

  if (unassigned) {
    // Build the set of assigned footballer IDs to exclude
    const assignedRows = await db
      .selectDistinct({ footballer_id: days.footballer_id })
      .from(days)
      .where(isNotNull(days.footballer_id))

    // If excludeDate is provided, keep that date's current footballer visible
    let excludeId: number | null = null
    if (excludeDate) {
      const [currentDay] = await db
        .select({ footballer_id: days.footballer_id })
        .from(days)
        .where(eq(days.date, excludeDate))
      excludeId = currentDay?.footballer_id ?? null
    }

    const assignedIds = assignedRows
      .map((r) => r.footballer_id as number)
      .filter((id) => id !== excludeId)

    if (assignedIds.length > 0) {
      conditions.push(notInArray(footballers.id, assignedIds))
    }
  }

  const rows = await db
    .select()
    .from(footballers)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return c.json(rows)
})

// POST /api/scrape — preview Wikipedia URL without writing to DB
footballersRouter.post(
  '/scrape',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    try {
      const result = await scrapeWikipedia(url)
      return c.json(result)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Scrape failed'
      return c.json({ error: message }, 400)
    }
  }
)

// POST /api/footballers/from-scrape — commit scrape result to DB
footballersRouter.post(
  '/from-scrape',
  zValidator(
    'json',
    z.object({
      name: z.string(),
      wikipedia_url: z.string().url(),
      nationality: z.string().nullable(),
      position: z.string().nullable(),
      born: z.string().nullable(),
      stints: z.array(stintSchema),
    })
  ),
  async (c) => {
    const body = c.req.valid('json')

    // Reject if a player with the same name already exists (case-insensitive)
    const [existing] = await db
      .select({ id: footballers.id })
      .from(footballers)
      .where(sql`LOWER(${footballers.name}) = LOWER(${body.name})`)
      .limit(1)
    if (existing) {
      return c.json({ error: 'already_exists', message: `${body.name} is already in the database` }, 409)
    }

    let footballer
    try {
      ;[footballer] = await db
        .insert(footballers)
        .values({
          name: body.name,
          wikipedia_url: body.wikipedia_url,
          nationality: body.nationality,
          position: body.position,
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
      await db.insert(career_stints).values(
        body.stints.map((s) => ({ ...s, footballer_id: footballer.id }))
      )
    }
    return c.json(footballer, 201)
  }
)

// GET /api/footballers/duplicates — returns groups of players sharing the same name (case-insensitive)
footballersRouter.get('/duplicates', async (c) => {
  const all = await db.select().from(footballers).orderBy(footballers.name)
  const groups = new Map<string, typeof all>()
  for (const f of all) {
    const key = f.name.toLowerCase().trim()
    const group = groups.get(key) ?? []
    group.push(f)
    groups.set(key, group)
  }
  const dupes = [...groups.values()].filter(g => g.length > 1)
  return c.json(dupes)
})

// GET /api/footballers/rescrape-all — SSE stream, rescapes every footballer in DB order
footballersRouter.get('/rescrape-all', async (c) => {
  const abortSignal = c.req.raw.signal
  return streamSSE(c, async (stream) => {
    const all = await db
      .select({ id: footballers.id, name: footballers.name, url: footballers.wikipedia_url })
      .from(footballers)
      .orderBy(footballers.name)

    await stream.writeSSE({
      data: JSON.stringify({ type: 'init', total: all.length, players: all.map(p => ({ id: p.id, name: p.name })) }),
    })

    for (const player of all) {
      if (abortSignal.aborted) break

      await stream.writeSSE({ data: JSON.stringify({ type: 'start', id: player.id }) })

      try {
        const result = await scrapeWikipedia(player.url)

        await db.update(footballers)
          .set({ name: result.name, nationality: result.nationality, position: result.position, born: result.born, updated_at: sql`(datetime('now'))` })
          .where(eq(footballers.id, player.id))

        await db.delete(career_stints).where(eq(career_stints.footballer_id, player.id))
        if (result.stints.length > 0) {
          await db.insert(career_stints).values(
            result.stints.map((s, i) => ({ ...s, sort_order: i, footballer_id: player.id }))
          )
        }

        await stream.writeSSE({
          data: JSON.stringify({
            type: 'done',
            id: player.id,
            stints: result.stints.length,
            intl: result.stints.filter(s => s.stint_type === 'international').length,
            nationality: result.nationality,
          }),
        })
      } catch (e) {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'failed', id: player.id, error: e instanceof Error ? e.message : 'Unknown error' }),
        })
      }

      await new Promise<void>(r => setTimeout(r, 500))
    }

    await stream.writeSSE({ data: JSON.stringify({ type: 'complete' }) })
  })
})

// GET /api/footballers/:id
footballersRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const [footballer] = await db
    .select()
    .from(footballers)
    .where(eq(footballers.id, id))
  if (!footballer) return c.json({ error: 'Not found' }, 404)

  const stints = await db
    .select()
    .from(career_stints)
    .where(eq(career_stints.footballer_id, id))
    .orderBy(sql`CASE WHEN ${career_stints.stint_type} = 'senior' THEN 0 ELSE 1 END`, career_stints.sort_order)

  return c.json({ ...footballer, stints })
})

// PATCH /api/footballers/:id
footballersRouter.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().optional(),
      nationality: z.string().nullable().optional(),
      position: z.string().nullable().optional(),
      born: z.string().nullable().optional(),
    })
  ),
  async (c) => {
    const id = parseInt(c.req.param('id'))
    const body = c.req.valid('json')
    const [updated] = await db
      .update(footballers)
      .set({ ...body, updated_at: sql`(datetime('now'))` })
      .where(eq(footballers.id, id))
      .returning()
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  }
)

// DELETE /api/footballers/:id
footballersRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const [deleted] = await db
    .delete(footballers)
    .where(eq(footballers.id, id))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

// PUT /api/footballers/:id/stints — replace all stints
footballersRouter.put(
  '/:id/stints',
  zValidator('json', z.array(stintSchema)),
  async (c) => {
    const id = parseInt(c.req.param('id'))
    const body = c.req.valid('json')
    await db.delete(career_stints).where(eq(career_stints.footballer_id, id))
    if (body.length > 0) {
      await db.insert(career_stints).values(
        body.map((s) => ({ ...s, footballer_id: id }))
      )
    }
    const stints = await db
      .select()
      .from(career_stints)
      .where(eq(career_stints.footballer_id, id))
      .orderBy(sql`CASE WHEN ${career_stints.stint_type} = 'senior' THEN 0 ELSE 1 END`, career_stints.sort_order)
    return c.json(stints)
  }
)
