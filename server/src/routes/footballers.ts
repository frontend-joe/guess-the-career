import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, sql, notInArray, isNotNull } from 'drizzle-orm'
import { db, sqlite, normalizeName } from '../db/client.ts'
import { footballers, career_stints, days } from '../db/schema.ts'
import { scrapeWikipedia, normalizeClubAlias } from '../services/scraper.ts'
import { reserveRe } from '../services/football.ts'

// Family relations that are footballers, from the curated (included) football
// family links — in either direction, with the relationship flipped for the
// reverse direction so it reads from the viewed player's perspective.
const INVERSE_REL: Record<string, string> = {
  father: 'son', son: 'father', dad: 'son',
  mother: 'daughter', daughter: 'mother',
  uncle: 'nephew', nephew: 'uncle', aunt: 'niece', niece: 'aunt',
  grandfather: 'grandson', grandson: 'grandfather', grandad: 'grandson',
  grandmother: 'granddaughter', granddaughter: 'grandmother',
}
function getRelations(id: number): { footballerId: number; name: string; relationship: string | null }[] {
  const rows = sqlite
    .prepare(
      `SELECT fl.relative_footballer_id AS rid, f.name AS name, fl.relationship AS rel, 0 AS reverse
       FROM football_family_links fl JOIN footballers f ON f.id = fl.relative_footballer_id
       WHERE fl.footballer_id = ? AND fl.included = 1 AND fl.relative_footballer_id IS NOT NULL
       UNION ALL
       SELECT fl.footballer_id AS rid, f.name AS name, fl.relationship AS rel, 1 AS reverse
       FROM football_family_links fl JOIN footballers f ON f.id = fl.footballer_id
       WHERE fl.relative_footballer_id = ? AND fl.included = 1`,
    )
    .all(id, id) as { rid: number; name: string; rel: string | null; reverse: number }[]
  const seen = new Set<number>()
  const out: { footballerId: number; name: string; relationship: string | null }[] = []
  for (const r of rows) {
    if (r.rid === id || seen.has(r.rid)) continue
    seen.add(r.rid)
    // Stored relationship R means "footballer_id is the R of relative". So on the
    // footballer_id's own card (reverse=0) the relative is the INVERSE of R; on the
    // relative's card (reverse=1) the footballer_id is R itself.
    const relationship = r.rel
      ? (r.reverse ? r.rel : (INVERSE_REL[r.rel.toLowerCase()] ?? r.rel))
      : r.rel
    out.push({ footballerId: r.rid, name: r.name, relationship })
  }
  return out
}

// Reserve/B/youth teams should show the parent club's crest. Resolve the parent
// club's Wikipedia URL from the clubs table when the stint is a reserve side.
function parentClubBadgeUrl(club: string): string | null {
  const clean = club
    .replace(/^→\s*/, '')
    .replace(/\s*\((loan|trial|co-ownership)\)\s*$/i, '')
    .trim()
  if (!reserveRe.test(clean)) return null
  const parent = clean.replace(reserveRe, '').trim()
  if (!parent || parent === clean) return null
  for (const name of [parent, normalizeClubAlias(parent)]) {
    const row = sqlite
      .prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) AND wikipedia_url IS NOT NULL LIMIT 1`)
      .get(name) as { wikipedia_url: string | null } | undefined
    if (row?.wikipedia_url) return row.wikipedia_url
  }
  return null
}

async function fetchSportsDbPhoto(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`, {
      headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' },
    })
    const data = await res.json() as { player?: { strThumb?: string }[] }
    return data?.player?.[0]?.strThumb ?? null
  } catch {
    return null
  }
}

export const footballersRouter = new Hono()

const stintSchema = z.object({
  sort_order: z.number().int(),
  years: z.string(),
  club: z.string(),
  club_wikipedia_url: z.string().nullable().optional(),
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
  const pageParam = c.req.query('page')
  const pageSizeParam = c.req.query('pageSize')
  const missingNationality = c.req.query('missingNationality') === 'true'
  const missingPhoto = c.req.query('missingPhoto') === 'true'
  const nonRetired = c.req.query('nonRetired') === 'true'

  const conditions = []

  if (search) {
    const normalized = normalizeName(search)
    conditions.push(sql`normalize(${footballers.name}) LIKE ${`%${normalized}%`}`)
  }

  if (missingNationality) {
    conditions.push(sql`(${footballers.nationality} IS NULL OR ${footballers.nationality} = '')`)
  }

  if (missingPhoto) {
    conditions.push(sql`(${footballers.photo_url} IS NULL OR ${footballers.photo_url} = '')`)
  }

  // Non-retired = has an active senior stint (years contains "present" or ends
  // with a dash, e.g. "2021–"). Mirrors isRetired() in services/scraper.ts.
  if (nonRetired) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM career_stints cs
      WHERE cs.footballer_id = ${footballers.id}
        AND cs.stint_type = 'senior'
        AND (
          LOWER(cs.years) LIKE '%present%'
          OR TRIM(cs.years) LIKE '%–'
          OR TRIM(cs.years) LIKE '%-'
        )
    )`)
  }

  if (unassigned) {
    const assignedRows = await db
      .selectDistinct({ footballer_id: days.footballer_id })
      .from(days)
      .where(isNotNull(days.footballer_id))

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

  const where = conditions.length > 0 ? and(...conditions) : undefined

  // Paginated mode — return { data, total }
  if (pageParam != null) {
    const page = Math.max(1, parseInt(pageParam, 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeParam ?? '25', 10)))
    const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(footballers).where(where)
    const data = await db.select().from(footballers).where(where)
      .orderBy(footballers.name)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    return c.json({ data, total: Number(total) })
  }

  const rows = await db.select().from(footballers).where(where)
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
      all_positions: z.string().nullable().optional(),
      born: z.string().nullable(),
      height_cm: z.number().int().nullable().optional(),
      honors_champions_league: z.number().int().optional().default(0),
      honors_fa_cup:           z.number().int().optional().default(0),
      honors_league_cup:       z.number().int().optional().default(0),
      honors_club_world_cup:   z.number().int().optional().default(0),
      honors_world_cup:        z.number().int().optional().default(0),
      honors_euros:            z.number().int().optional().default(0),
      honors_copa_america:     z.number().int().optional().default(0),
      honors_ballon_dor:       z.number().int().optional().default(0),
      honors_world_player:     z.number().int().optional().default(0),
      stints: z.array(stintSchema),
    })
  ),
  async (c) => {
    const body = c.req.valid('json')

    // Reject only if this exact Wikipedia page is already imported. Identity is
    // the wikipedia_url (unique), not the name — distinct players legitimately
    // share a name (e.g. the two Michael Johnsons), so name is not a dedupe key.
    const [existing] = await db
      .select({ id: footballers.id })
      .from(footballers)
      .where(eq(footballers.wikipedia_url, body.wikipedia_url))
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
          all_positions: body.all_positions ?? null,
          born: body.born,
          height_cm: body.height_cm ?? null,
          honors_champions_league: body.honors_champions_league ?? 0,
          honors_fa_cup:           body.honors_fa_cup ?? 0,
          honors_league_cup:       body.honors_league_cup ?? 0,
          honors_club_world_cup:   body.honors_club_world_cup ?? 0,
          honors_world_cup:        body.honors_world_cup ?? 0,
          honors_euros:            body.honors_euros ?? 0,
          honors_copa_america:     body.honors_copa_america ?? 0,
          honors_ballon_dor:       body.honors_ballon_dor ?? 0,
          honors_world_player:     body.honors_world_player ?? 0,
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
        const existing = await db.select({ photo_url: footballers.photo_url }).from(footballers).where(eq(footballers.id, player.id)).limit(1)
        const photoUrl = existing[0]?.photo_url ?? result.photo_url ?? await fetchSportsDbPhoto(player.name)

        await db.update(footballers)
          .set({ name: result.name, nationality: result.nationality, full_name: result.full_name ?? null, birthplace: result.birthplace ?? null, position: result.position, all_positions: result.all_positions ?? null, style_of_play: result.style_of_play ?? null, born: result.born, height_cm: result.height_cm, photo_url: photoUrl, updated_at: sql`(datetime('now'))` })
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

      await new Promise<void>(r => setTimeout(r, 1000))
    }

    await stream.writeSSE({ data: JSON.stringify({ type: 'complete' }) })
  })
})

// DELETE /api/footballers — delete all footballers (cascades to stints; days set null via schema)
footballersRouter.delete('/', async (c) => {
  await db.delete(footballers)
  return c.json({ ok: true })
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

// GET /api/footballers/:id/card — player info modal (lazy-scrapes & caches the
// full name + place of birth on first view).
footballersRouter.get('/:id/card', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  let [footballer] = await db.select().from(footballers).where(eq(footballers.id, id)).limit(1)
  if (!footballer) return c.json({ error: 'Not found' }, 404)

  if ((!footballer.full_name || !footballer.birthplace) && footballer.wikipedia_url) {
    try {
      const scraped = await scrapeWikipedia(footballer.wikipedia_url)
      const full_name = footballer.full_name ?? scraped.full_name ?? null
      const birthplace = footballer.birthplace ?? scraped.birthplace ?? null
      if (full_name !== footballer.full_name || birthplace !== footballer.birthplace) {
        await db.update(footballers).set({ full_name, birthplace, updated_at: sql`(datetime('now'))` }).where(eq(footballers.id, id))
        footballer = { ...footballer, full_name, birthplace }
      }
    } catch {
      // scrape failed — return the stored data as-is
    }
  }

  const rawStints = await db
    .select()
    .from(career_stints)
    .where(eq(career_stints.footballer_id, id))
    .orderBy(sql`CASE WHEN ${career_stints.stint_type} = 'senior' THEN 0 ELSE 1 END`, career_stints.sort_order)

  // Reserve/B teams borrow the parent club's crest for the badge.
  const stints = rawStints.map((s) => ({
    ...s,
    club_wikipedia_url: parentClubBadgeUrl(s.club) ?? s.club_wikipedia_url,
  }))

  return c.json({
    id: footballer.id,
    name: footballer.name,
    full_name: footballer.full_name,
    born: footballer.born,
    birthplace: footballer.birthplace,
    height_cm: footballer.height_cm,
    position: footballer.position,
    all_positions: footballer.all_positions,
    photo_url: footballer.photo_url,
    nationality: footballer.nationality,
    wikipedia_url: footballer.wikipedia_url,
    stints,
    relations: getRelations(id),
  })
})

// PATCH /api/footballers/:id
footballersRouter.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().optional(),
      wikipedia_url: z.string().url().optional(),
      nationality: z.string().nullable().optional(),
      position: z.string().nullable().optional(),
      all_positions: z.string().nullable().optional(),
      custom_position: z.string().nullable().optional(),
      born: z.string().nullable().optional(),
      height_cm: z.number().int().nullable().optional(),
      photo_url: z.string().nullable().optional(),
    })
  ),
  async (c) => {
    const id = parseInt(c.req.param('id'))
    const body = c.req.valid('json')
    let updated
    try {
      ;[updated] = await db
        .update(footballers)
        .set({ ...body, updated_at: sql`(datetime('now'))` })
        .where(eq(footballers.id, id))
        .returning()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('UNIQUE constraint failed')) {
        return c.json({ error: 'duplicate_url', message: 'Another player already uses that Wikipedia URL' }, 409)
      }
      throw e
    }
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

// POST /api/footballers/:id/rescrape — full rescrape: update footballer fields + replace stints
footballersRouter.post('/:id/rescrape', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const [existing] = await db.select().from(footballers).where(eq(footballers.id, id)).limit(1)
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const result = await scrapeWikipedia(existing.wikipedia_url)
  const photoUrl = existing.photo_url ?? result.photo_url ?? await fetchSportsDbPhoto(result.name)

  await db.update(footballers)
    .set({
      name: result.name,
      nationality: result.nationality,
      full_name: result.full_name ?? null,
      birthplace: result.birthplace ?? null,
      position: result.position,
      all_positions: result.all_positions ?? null,
      style_of_play: result.style_of_play ?? null,
      born: result.born,
      height_cm: result.height_cm,
      photo_url: photoUrl,
      honors_champions_league: result.honors_champions_league,
      honors_fa_cup:           result.honors_fa_cup,
      honors_league_cup:       result.honors_league_cup,
      honors_club_world_cup:   result.honors_club_world_cup,
      honors_world_cup:        result.honors_world_cup,
      honors_euros:            result.honors_euros,
      honors_copa_america:     result.honors_copa_america,
      honors_ballon_dor:       result.honors_ballon_dor,
      honors_world_player:     result.honors_world_player,
      updated_at: sql`(datetime('now'))`,
    })
    .where(eq(footballers.id, id))

  await db.delete(career_stints).where(eq(career_stints.footballer_id, id))
  if (result.stints.length > 0) {
    await db.insert(career_stints).values(
      result.stints.map((s, i) => ({ ...s, sort_order: i, footballer_id: id }))
    )
  }

  const [updated] = await db.select().from(footballers).where(eq(footballers.id, id)).limit(1)
  const stints = await db.select().from(career_stints).where(eq(career_stints.footballer_id, id))
    .orderBy(sql`CASE WHEN ${career_stints.stint_type} = 'senior' THEN 0 ELSE 1 END`, career_stints.sort_order)

  return c.json({ footballer: updated, stints })
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
