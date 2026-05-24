import { Hono } from 'hono'
import { asc, eq, sql, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { clubs } from '../db/schema.ts'
import { scrapeClubKitColours } from '../services/scraper.ts'

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

  const cols = {
    id: clubs.id,
    name: clubs.name,
    wikipedia_url: clubs.wikipedia_url,
    home_body: clubs.home_body,
    home_leftarm: clubs.home_leftarm,
    home_rightarm: clubs.home_rightarm,
    home_shorts: clubs.home_shorts,
    home_socks: clubs.home_socks,
    home_pattern: clubs.home_pattern,
  }

  const rows = q.length > 0
    ? await db
        .select(cols)
        .from(clubs)
        .where(sql`normalize(${clubs.name}) LIKE ${'%' + q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() + '%'}`)
        .orderBy(asc(clubs.name))
    : await db
        .select(cols)
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

// PATCH /api/clubs/:id — manually update kit colours
clubsRouter.patch('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const body = await c.req.json().catch(() => ({})) as Partial<{
    home_body: string | null
    home_leftarm: string | null
    home_rightarm: string | null
    home_shorts: string | null
    home_socks: string | null
    home_pattern: string | null
  }>

  // Only allow known kit columns to be updated
  const allowed = ['home_body', 'home_leftarm', 'home_rightarm', 'home_shorts', 'home_socks', 'home_pattern'] as const
  const patch: Record<string, string | null> = {}
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key] ?? null
  }

  if (Object.keys(patch).length === 0) return c.json({ error: 'No valid fields' }, 400)

  await db.update(clubs).set(patch).where(eq(clubs.id, id))
  const [updated] = await db.select().from(clubs).where(eq(clubs.id, id))
  return c.json(updated ?? { error: 'Not found' })
})

// POST /api/clubs/scrape-kits — scrape home kit colours from Wikipedia
// Body (optional): { ids: number[] } — if omitted, scrapes all clubs with a wikipedia_url
clubsRouter.post('/scrape-kits', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { ids?: number[] }
  const requestedIds = Array.isArray(body?.ids) && body.ids.length > 0 ? body.ids : null

  const allClubs = await db
    .select({ id: clubs.id, wikipedia_url: clubs.wikipedia_url })
    .from(clubs)
    .where(isNotNull(clubs.wikipedia_url))

  const target = requestedIds
    ? allClubs.filter(c => requestedIds.includes(c.id))
    : allClubs

  let updated = 0
  let skipped = 0

  for (const club of target) {
    try {
      const colours = await scrapeClubKitColours(club.wikipedia_url!)
      if (!colours.home_body) { skipped++; continue }
      await db.update(clubs).set(colours).where(sql`${clubs.id} = ${club.id}`)
      updated++
    } catch {
      skipped++
    }
    await new Promise(r => setTimeout(r, 300))
  }

  return c.json({ updated, skipped })
})
