import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, sql, notInArray, isNotNull } from 'drizzle-orm'
import { db, sqlite, normalizeName } from '../db/client.ts'
import { footballers, career_stints, days } from '../db/schema.ts'
import { scrapeWikipedia, normalizeClubAlias } from '../services/scraper.ts'
import { reserveRe } from '../services/football.ts'
import { clubWikiUrl, rebuildClubs } from "../services/clubs.ts";
import { applyScrapeResult } from "../services/footballers.ts";
import { startBackfill, stopBackfill, getBackfillStatus } from "../services/backfill.ts";
import { splitName } from "../services/nameSplit.ts";
import { setAppMeta } from "../services/appMeta.ts";

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
// Generational pairs: the older player takes the first (senior) role. When both
// birth years are known we use age rather than the stored word's direction.
const GEN_GROUPS: { words: string[]; older: string; younger: string }[] = [
  { words: ['father', 'son', 'dad'], older: 'father', younger: 'son' },
  { words: ['mother', 'daughter'], older: 'mother', younger: 'daughter' },
  { words: ['uncle', 'nephew'], older: 'uncle', younger: 'nephew' },
  { words: ['aunt', 'niece'], older: 'aunt', younger: 'niece' },
  { words: ['grandfather', 'grandson', 'grandad'], older: 'grandfather', younger: 'grandson' },
  { words: ['grandmother', 'granddaughter'], older: 'grandmother', younger: 'granddaughter' },
]
const yearOf = (born: string | null): number | null => {
  const m = born?.match(/\d{4}/)
  return m ? Number(m[0]) : null
}

function getRelations(id: number, viewedBorn: string | null): { footballerId: number; name: string; relationship: string | null }[] {
  const rows = sqlite
    .prepare(
      `SELECT fl.relative_footballer_id AS rid, f.name AS name, f.born AS born, fl.relationship AS rel, 0 AS reverse
       FROM football_family_links fl JOIN footballers f ON f.id = fl.relative_footballer_id
       WHERE fl.footballer_id = ? AND fl.included = 1 AND fl.relative_footballer_id IS NOT NULL
       UNION ALL
       SELECT fl.footballer_id AS rid, f.name AS name, f.born AS born, fl.relationship AS rel, 1 AS reverse
       FROM football_family_links fl JOIN footballers f ON f.id = fl.footballer_id
       WHERE fl.relative_footballer_id = ? AND fl.included = 1`,
    )
    .all(id, id) as { rid: number; name: string; born: string | null; rel: string | null; reverse: number }[]
  const vy = yearOf(viewedBorn)
  const seen = new Set<number>()
  const out: { footballerId: number; name: string; relationship: string | null }[] = []
  for (const r of rows) {
    if (r.rid === id || seen.has(r.rid)) continue
    seen.add(r.rid)
    const relLower = r.rel?.toLowerCase()
    const group = relLower ? GEN_GROUPS.find((g) => g.words.includes(relLower)) : undefined
    let relationship: string | null
    if (group) {
      const ry = yearOf(r.born)
      if (vy != null && ry != null && vy !== ry) {
        // Label = what the relation is to the viewed player: older relation = senior role.
        relationship = ry < vy ? group.older : group.younger
      } else {
        // No ages: fall back to the stored word (reverse = as stored, forward = inverse).
        relationship = r.reverse ? r.rel : (INVERSE_REL[relLower!] ?? r.rel)
      }
    } else {
      // Symmetric (brother/cousin/…) — same label both ways.
      relationship = r.rel
    }
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
  const missingCaps = c.req.query('missingCaps') === 'true'

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

  // Admin filter: "non-retired" = has an active senior stint (years contains
  // "present" or ends with a dash, e.g. "2021–"). This is only a convenience
  // filter for the footballer list — games no longer gate on retirement.
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

  // Missing caps = no international stint recorded at all (surfaces both genuinely
  // uncapped players and those whose international data was never/incompletely scraped).
  if (missingCaps) {
    conditions.push(sql`NOT EXISTS (
      SELECT 1 FROM career_stints cs
      WHERE cs.footballer_id = ${footballers.id}
        AND cs.stint_type = 'international'
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

        await applyScrapeResult(player.id, result, existing[0]?.photo_url ?? null)

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

    // Only stamp a completed full rescrape (not an aborted one), then rebuild the
    // clubs table from the freshly canonicalized stints and record the date.
    if (!abortSignal.aborted) {
      rebuildClubs()
      setAppMeta('last_rescrape', new Date().toISOString().slice(0, 10))
    }

    await stream.writeSSE({ data: JSON.stringify({ type: 'complete' }) })
  })
})

// Backfill jobs run server-side (independent of the request) so they survive the
// Netlify proxy (which buffers/times out SSE), tab closes, and 40-minute runtimes.
// The client starts a job with a short POST and polls GET /backfill/status.
//   POST /api/footballers/backfill/:type/start  (type = photos | career-stats)
//   GET  /api/footballers/backfill/status
//   POST /api/footballers/backfill/stop
footballersRouter.post('/backfill/:type/start', (c) => {
  const type = c.req.param('type')
  if (type !== 'photos' && type !== 'career-stats' && type !== 'repair') {
    return c.json({ error: 'Unknown backfill type' }, 400)
  }
  // onlyMissing (default true) resumes where a previous run left off.
  const onlyMissing = c.req.query('all') !== 'true'
  const started = startBackfill(type, onlyMissing)
  if (!started) return c.json({ started: false, status: getBackfillStatus() }, 409)
  return c.json({ started: true, status: getBackfillStatus() })
})

footballersRouter.get('/backfill/status', (c) => c.json(getBackfillStatus()))

footballersRouter.post('/backfill/stop', (c) => {
  const stopped = stopBackfill()
  return c.json({ stopped, status: getBackfillStatus() })
})

// ── Name splitting (first_name / surname) ───────────────────────────────────
// POST /api/footballers/names/recompute — recompute splits for every player
// whose split has NOT been confirmed by an admin. Pure computation, no scraping.
footballersRouter.post('/names/recompute', (c) => {
  const rows = sqlite.prepare(
    `SELECT id, name, nationality FROM footballers WHERE name_confirmed = 0`,
  ).all() as { id: number; name: string; nationality: string | null }[]

  const update = sqlite.prepare(
    `UPDATE footballers
     SET first_name = ?, surname = ?, name_ambiguous = ?, name_split_reason = ?
     WHERE id = ?`,
  )
  let ambiguous = 0
  const tx = sqlite.transaction(() => {
    for (const r of rows) {
      const s = splitName(r.name, r.nationality)
      if (s.ambiguous) ambiguous++
      update.run(s.first_name, s.surname, s.ambiguous ? 1 : 0, s.reason, r.id)
    }
  })
  tx()
  return c.json({ updated: rows.length, ambiguous })
})

// GET /api/footballers/names/review?filter=ambiguous|unconfirmed|all&q=&page=
// The admin review queue for debatable splits.
footballersRouter.get('/names/review', (c) => {
  const filter = c.req.query('filter') ?? 'ambiguous'
  const q = (c.req.query('q') ?? '').trim().toLowerCase()
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(c.req.query('pageSize') ?? '50', 10) || 50))

  const clauses: string[] = []
  const args: unknown[] = []
  if (filter === 'ambiguous') clauses.push('name_ambiguous = 1 AND name_confirmed = 0')
  else if (filter === 'unconfirmed') clauses.push('name_confirmed = 0')
  else if (filter === 'confirmed') clauses.push('name_confirmed = 1')
  if (q) {
    clauses.push('LOWER(name) LIKE ?')
    args.push(`%${q}%`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const total = (sqlite.prepare(`SELECT COUNT(*) AS n FROM footballers ${where}`)
    .get(...args) as { n: number }).n
  const data = sqlite.prepare(
    `SELECT id, name, nationality, first_name, surname, name_confirmed, name_ambiguous, name_split_reason
     FROM footballers ${where}
     ORDER BY name ASC LIMIT ? OFFSET ?`,
  ).all(...args, pageSize, (page - 1) * pageSize)

  const counts = sqlite.prepare(
    `SELECT
       SUM(CASE WHEN name_ambiguous = 1 AND name_confirmed = 0 THEN 1 ELSE 0 END) AS ambiguous,
       SUM(CASE WHEN name_confirmed = 1 THEN 1 ELSE 0 END) AS confirmed,
       COUNT(*) AS total
     FROM footballers`,
  ).get()

  return c.json({ data, total, page, pageSize, counts })
})

// PATCH /api/footballers/:id/name-split — save a split. Saving marks it
// confirmed, so recomputes leave it alone from then on.
footballersRouter.patch(
  '/:id/name-split',
  zValidator('json', z.object({
    first_name: z.string().nullable().optional(),
    surname: z.string().min(1),
    confirmed: z.boolean().optional(),
  })),
  (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
    const b = c.req.valid('json')
    const first = b.first_name?.trim() ? b.first_name.trim() : null
    sqlite.prepare(
      `UPDATE footballers
       SET first_name = ?, surname = ?, name_confirmed = ?, name_ambiguous = 0
       WHERE id = ?`,
    ).run(first, b.surname.trim(), b.confirmed === false ? 0 : 1, id)
    return c.json({ ok: true })
  },
)

// GET /api/career-stats/leagues — distinct leagues with player/apps/goals totals.
footballersRouter.get('/career-stats/leagues', (c) => {
  const rows = sqlite.prepare(
    `SELECT COALESCE(league, division) AS league,
            COUNT(DISTINCT footballer_id) AS players,
            SUM(COALESCE(league_apps, 0)) AS apps,
            SUM(COALESCE(league_goals, 0)) AS goals
     FROM career_statistics
     WHERE COALESCE(league, division) IS NOT NULL
     GROUP BY COALESCE(league, division)
     ORDER BY players DESC, apps DESC`,
  ).all()
  return c.json(rows)
})

// GET /api/career-stats/leaders?league=Premier League&metric=goals|apps&min=100&limit=50
// Aggregated per-player league totals — the primary query for building new games.
footballersRouter.get('/career-stats/leaders', (c) => {
  const league = (c.req.query('league') ?? '').trim()
  const metric = c.req.query('metric') === 'apps' ? 'apps' : 'goals'
  const min = Math.max(0, parseInt(c.req.query('min') ?? '0', 10) || 0)
  const limit = Math.min(500, Math.max(1, parseInt(c.req.query('limit') ?? '100', 10) || 100))
  if (!league) return c.json({ error: 'league is required' }, 400)

  const col = metric === 'apps' ? 'league_apps' : 'league_goals'
  // Optional surname filters — these use the stored, review-confirmed surname
  // so "M" correctly includes Del Piero under D and Kim Min-jae under K.
  const starts = (c.req.query('surnameStarts') ?? '').trim()
  const ends = (c.req.query('surnameEnds') ?? '').trim()
  const extra: string[] = []
  const extraArgs: unknown[] = []
  if (starts) { extra.push('f.surname LIKE ?'); extraArgs.push(`${starts}%`) }
  if (ends) { extra.push('f.surname LIKE ?'); extraArgs.push(`%${ends}`) }
  const extraSql = extra.length ? ` AND ${extra.join(' AND ')}` : ''

  const rows = sqlite.prepare(
    `SELECT f.id AS footballer_id, f.name, f.first_name, f.surname, f.nationality, f.photo_url,
            SUM(COALESCE(cs.league_apps, 0)) AS apps,
            SUM(COALESCE(cs.league_goals, 0)) AS goals
     FROM career_statistics cs
     JOIN footballers f ON f.id = cs.footballer_id
     WHERE COALESCE(cs.league, cs.division) = ?${extraSql}
     GROUP BY f.id
     HAVING SUM(COALESCE(cs.${col}, 0)) >= ?
     ORDER BY SUM(COALESCE(cs.${col}, 0)) DESC
     LIMIT ?`,
  ).all(league, ...extraArgs, min, limit)
  return c.json({ league, metric, min, surnameStarts: starts || null, surnameEnds: ends || null, data: rows })
})

// GET /api/footballers/:id/career-stats — one player's per-league season rows.
footballersRouter.get('/:id/career-stats', (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const rows = sqlite.prepare(
    `SELECT club, club_wikipedia_url, season, division, league,
            league_apps, league_goals, total_apps, total_goals
     FROM career_statistics WHERE footballer_id = ? ORDER BY sort_order`,
  ).all(id)
  return c.json(rows)
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

  // Reserve/B teams borrow the parent club's crest; fall back to the clubs table
  // when a stint has no stored club link of its own.
  const stints = rawStints.map((s) => ({
    ...s,
    club_wikipedia_url: parentClubBadgeUrl(s.club) ?? s.club_wikipedia_url ?? clubWikiUrl(s.club),
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
    relations: getRelations(id, footballer.born),
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
  await applyScrapeResult(id, result, existing.photo_url)

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
