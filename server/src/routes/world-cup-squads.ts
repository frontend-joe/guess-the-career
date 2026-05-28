import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, asc, sql, and } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { world_cup_squads, world_cup_squad_players, footballers } from '../db/schema.ts'
import { scrapeWorldCupSquadsPage, scrapeWikipedia } from '../services/scraper.ts'

function normalizeWikiTitle(url: string): string {
  const afterWiki = url.split('/wiki/').pop() ?? ''
  return decodeURIComponent(afterWiki)
    .replace(/_/g, ' ')
    .replace(/\s*\(.*?\)\s*$/, '')
    .normalize('NFD').replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
}

const playerSchema = z.object({
  shirt_number: z.number().int().nullable(),
  position: z.string().nullable(),
  name: z.string(),
  club: z.string(),
  wikipedia_url: z.string().nullable().optional(),
})

const squadSchema = z.object({
  team: z.string(),
  players: z.array(playerSchema),
})

export const worldCupSquadsRouter = new Hono()

// POST /api/world-cup-squads/scrape — preview without writing to DB
worldCupSquadsRouter.post(
  '/scrape',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    try {
      const result = await scrapeWorldCupSquadsPage(url)
      return c.json(result)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Scrape failed'
      return c.json({ error: message }, 400)
    }
  }
)

// POST /api/world-cup-squads/check-players — batch check against DB
worldCupSquadsRouter.post(
  '/check-players',
  zValidator('json', z.object({ players: z.array(z.object({ name: z.string(), wikipedia_url: z.string().nullable().optional() })) })),
  async (c) => {
    const { players } = c.req.valid('json')

    const allFootballers = await db.select({ id: footballers.id, wikipedia_url: footballers.wikipedia_url }).from(footballers)
    const normalizedUrlMap = new Map<string, number>()
    for (const f of allFootballers) {
      const norm = normalizeWikiTitle(f.wikipedia_url)
      if (norm && !normalizedUrlMap.has(norm)) normalizedUrlMap.set(norm, f.id)
    }

    const results = await Promise.all(
      players.map(async (p) => {
        const [byName] = await db.select({ id: footballers.id }).from(footballers)
          .where(sql`LOWER(${footballers.name}) = LOWER(${p.name})`).limit(1)
        if (byName) return { name: p.name, in_db: true, footballer_id: byName.id }

        if (p.wikipedia_url) {
          const [byUrl] = await db.select({ id: footballers.id }).from(footballers)
            .where(eq(footballers.wikipedia_url, p.wikipedia_url)).limit(1)
          if (byUrl) return { name: p.name, in_db: true, footballer_id: byUrl.id }

          const norm = normalizeWikiTitle(p.wikipedia_url)
          const id = normalizedUrlMap.get(norm)
          if (id) return { name: p.name, in_db: true, footballer_id: id }
        }

        return { name: p.name, in_db: false, footballer_id: null }
      })
    )
    return c.json(results)
  }
)

// GET /api/world-cup-squads — list all imported squads ordered by year ASC, team ASC
worldCupSquadsRouter.get('/', async (c) => {
  const rows = await db.select().from(world_cup_squads)
    .orderBy(asc(world_cup_squads.year), asc(world_cup_squads.team))
  return c.json(rows)
})

// POST /api/world-cup-squads — import selected squads
worldCupSquadsRouter.post(
  '/',
  zValidator('json', z.object({
    year: z.number().int(),
    wikipedia_url: z.string().url(),
    squads: z.array(squadSchema),
  })),
  async (c) => {
    const body = c.req.valid('json')

    const allFootballers = await db.select({ id: footballers.id, wikipedia_url: footballers.wikipedia_url }).from(footballers)
    const normalizedUrlMap = new Map<string, number>()
    for (const f of allFootballers) {
      const norm = normalizeWikiTitle(f.wikipedia_url)
      if (norm && !normalizedUrlMap.has(norm)) normalizedUrlMap.set(norm, f.id)
    }

    let imported = 0
    for (const squad of body.squads) {
      // Skip already-imported year+team combos
      const [existing] = await db.select({ id: world_cup_squads.id })
        .from(world_cup_squads)
        .where(and(eq(world_cup_squads.year, body.year), eq(world_cup_squads.team, squad.team)))
        .limit(1)
      if (existing) continue

      const [entry] = await db.insert(world_cup_squads)
        .values({ year: body.year, team: squad.team, wikipedia_url: body.wikipedia_url })
        .returning()

      if (squad.players.length > 0) {
        const playerValues = await Promise.all(
          squad.players.map(async (p) => {
            let footballerId: number | null = null
            const [byName] = await db.select({ id: footballers.id }).from(footballers)
              .where(sql`LOWER(${footballers.name}) = LOWER(${p.name})`).limit(1)
            footballerId = byName?.id ?? null

            if (!footballerId && p.wikipedia_url) {
              const [byUrl] = await db.select({ id: footballers.id }).from(footballers)
                .where(eq(footballers.wikipedia_url, p.wikipedia_url)).limit(1)
              footballerId = byUrl?.id ?? null
              if (!footballerId) {
                const norm = normalizeWikiTitle(p.wikipedia_url)
                footballerId = normalizedUrlMap.get(norm) ?? null
              }
            }

            return {
              squad_id: entry.id,
              footballer_id: footballerId,
              shirt_number: p.shirt_number,
              position: p.position,
              name: p.name,
              club: p.club,
              nationality: squad.team,
              wikipedia_url: p.wikipedia_url ?? null,
            }
          })
        )
        await db.insert(world_cup_squad_players).values(playerValues)
      }
      imported++
    }

    return c.json({ ok: true, imported })
  }
)

// POST /api/world-cup-squads/:id/refresh — re-scrape Wikipedia and relink footballer_ids in place
worldCupSquadsRouter.post('/:id/refresh', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const [entry] = await db.select().from(world_cup_squads).where(eq(world_cup_squads.id, id)).limit(1)
  if (!entry) return c.json({ error: 'Not found' }, 404)

  const scraped = await scrapeWorldCupSquadsPage(entry.wikipedia_url)
  const scrapedSquad = scraped.squads.find(s => s.team === entry.team)
  if (!scrapedSquad) return c.json({ error: `Squad "${entry.team}" not found in scraped page` }, 404)

  const allFootballers = await db.select({ id: footballers.id, wikipedia_url: footballers.wikipedia_url }).from(footballers)
  const normalizedUrlMap = new Map<string, number>()
  for (const f of allFootballers) {
    const norm = normalizeWikiTitle(f.wikipedia_url)
    if (norm && !normalizedUrlMap.has(norm)) normalizedUrlMap.set(norm, f.id)
  }

  let updated = 0
  for (const sp of scrapedSquad.players) {
    const [existing] = await db
      .select({ id: world_cup_squad_players.id })
      .from(world_cup_squad_players)
      .where(and(
        eq(world_cup_squad_players.squad_id, id),
        sql`LOWER(${world_cup_squad_players.name}) = LOWER(${sp.name})`,
      ))
      .limit(1)
    if (!existing) continue

    let footballerId: number | null = null
    const [byName] = await db.select({ id: footballers.id }).from(footballers)
      .where(sql`LOWER(${footballers.name}) = LOWER(${sp.name})`).limit(1)
    footballerId = byName?.id ?? null

    if (!footballerId && sp.wikipedia_url) {
      const [byUrl] = await db.select({ id: footballers.id }).from(footballers)
        .where(eq(footballers.wikipedia_url, sp.wikipedia_url)).limit(1)
      footballerId = byUrl?.id ?? null
      if (!footballerId) {
        const norm = normalizeWikiTitle(sp.wikipedia_url)
        footballerId = normalizedUrlMap.get(norm) ?? null
      }
    }

    // If footballer has no position, try to fill it via scrape
    if (footballerId) {
      const [linked] = await db.select({ position: footballers.position, wikipedia_url: footballers.wikipedia_url })
        .from(footballers).where(eq(footballers.id, footballerId)).limit(1)
      if (linked && !linked.position && linked.wikipedia_url) {
        try {
          const wikiData = await scrapeWikipedia(linked.wikipedia_url)
          if (wikiData.position) {
            await db.update(footballers).set({ position: wikiData.position }).where(eq(footballers.id, footballerId))
          }
        } catch { /* skip */ }
      }
    }

    await db.update(world_cup_squad_players)
      .set({ footballer_id: footballerId, wikipedia_url: sp.wikipedia_url ?? null })
      .where(eq(world_cup_squad_players.id, existing.id))
    updated++
  }

  return c.json({ ok: true, updated })
})

// DELETE /api/world-cup-squads/:id
worldCupSquadsRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const [deleted] = await db.delete(world_cup_squads).where(eq(world_cup_squads.id, id)).returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
