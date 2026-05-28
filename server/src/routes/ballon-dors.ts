import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, asc, sql } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { ballon_dors, ballon_dor_players, footballers } from '../db/schema.ts'
import { scrapeBallonDorPage } from '../services/scraper.ts'

const playerSchema = z.object({
  rank: z.number().int(),
  name: z.string(),
  nationality: z.string().nullable(),
  club: z.string(),
  points: z.number().nullable(),
  wikipedia_url: z.string().nullable().optional(),
})

export const ballonDorsRouter = new Hono()

// POST /api/ballon-dors/scrape — preview without writing to DB
ballonDorsRouter.post(
  '/scrape',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    try {
      const result = await scrapeBallonDorPage(url)
      return c.json(result)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Scrape failed'
      return c.json({ error: message }, 400)
    }
  }
)

// POST /api/ballon-dors/check-players — check which players are already in the DB
// Returns each player with in_db: true/false and footballer_id if found
ballonDorsRouter.post(
  '/check-players',
  zValidator('json', z.object({ players: z.array(z.object({ name: z.string(), wikipedia_url: z.string().nullable().optional() })) })),
  async (c) => {
    const { players } = c.req.valid('json')
    const results = await Promise.all(
      players.map(async (p) => {
        // Try name match first
        const [byName] = await db
          .select({ id: footballers.id })
          .from(footballers)
          .where(sql`LOWER(${footballers.name}) = LOWER(${p.name})`)
          .limit(1)
        if (byName) return { name: p.name, in_db: true, footballer_id: byName.id }

        // Fall back to Wikipedia URL match
        if (p.wikipedia_url) {
          const [byUrl] = await db
            .select({ id: footballers.id })
            .from(footballers)
            .where(eq(footballers.wikipedia_url, p.wikipedia_url))
            .limit(1)
          if (byUrl) return { name: p.name, in_db: true, footballer_id: byUrl.id }
        }

        return { name: p.name, in_db: false, footballer_id: null }
      })
    )
    return c.json(results)
  }
)

// GET /api/ballon-dors — list all, ordered by year ASC
ballonDorsRouter.get('/', async (c) => {
  const rows = await db.select().from(ballon_dors).orderBy(asc(ballon_dors.year))
  return c.json(rows)
})

// POST /api/ballon-dors — import scraped result into DB
ballonDorsRouter.post(
  '/',
  zValidator(
    'json',
    z.object({
      year: z.number().int(),
      wikipedia_url: z.string().url(),
      players: z.array(playerSchema),
    })
  ),
  async (c) => {
    const body = c.req.valid('json')

    // Check for duplicate year
    const [existing] = await db
      .select({ id: ballon_dors.id })
      .from(ballon_dors)
      .where(eq(ballon_dors.year, body.year))
      .limit(1)
    if (existing) {
      return c.json({ error: 'already_exists', message: `Ballon d'Or ${body.year} is already in the database` }, 409)
    }

    const [entry] = await db
      .insert(ballon_dors)
      .values({ year: body.year, wikipedia_url: body.wikipedia_url })
      .returning()

    if (body.players.length > 0) {
      // Resolve footballer_id for each player via name match
      const playerValues = await Promise.all(
        body.players.map(async (p) => {
          // Try name match first
          const [byName] = await db
            .select({ id: footballers.id })
            .from(footballers)
            .where(sql`LOWER(${footballers.name}) = LOWER(${p.name})`)
            .limit(1)
          let footballerId = byName?.id ?? null

          // Fall back to Wikipedia URL match
          if (!footballerId && p.wikipedia_url) {
            const [byUrl] = await db
              .select({ id: footballers.id })
              .from(footballers)
              .where(eq(footballers.wikipedia_url, p.wikipedia_url))
              .limit(1)
            footballerId = byUrl?.id ?? null
          }

          return {
            ballon_dor_id: entry.id,
            footballer_id: footballerId,
            name: p.name,
            nationality: p.nationality,
            club: p.club,
            points: p.points,
            rank: p.rank,
          }
        })
      )
      await db.insert(ballon_dor_players).values(playerValues)
    }

    return c.json(entry, 201)
  }
)

// DELETE /api/ballon-dors/:id — delete (cascades to players)
ballonDorsRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const [deleted] = await db
    .delete(ballon_dors)
    .where(eq(ballon_dors.id, id))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
