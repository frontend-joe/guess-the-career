import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, sqlite } from '../db/client.ts'
import {
  record_signings_clubs,
  record_signings_players,
  record_signings_schedule,
  footballers,
} from '../db/schema.ts'
import { scrapeTransfermarktRecordSignings } from '../services/scraper.ts'
import { clubWikiUrl } from '../services/clubs.ts'
import {
  buildClubMatcher,
  dbFootballerByName,
  resolveOrCreateFootballer,
} from '../services/playerImport.ts'

export const recordSigningsRouter = new Hono()

// ── Game-shaped signings for a club (fee desc), shared by admin + rounds ─────
function clubSignings(clubId: number) {
  const rows = sqlite
    .prepare(
      `SELECT sp.id, sp.player_name, sp.nationality, sp.position,
              sp.from_club, sp.from_club_wikipedia_url,
              sp.fee_text, sp.fee_value, sp.season_label, sp.footballer_id,
              f.name AS footballer_name, f.nationality AS footballer_nationality,
              f.position AS footballer_position, f.photo_url, f.wikipedia_url
       FROM record_signings_players sp
       LEFT JOIN footballers f ON sp.footballer_id = f.id
       WHERE sp.club_id = ?
       ORDER BY (sp.fee_value IS NULL), sp.fee_value DESC, sp.sort_order ASC`,
    )
    .all(clubId) as {
    id: number
    player_name: string
    nationality: string | null
    position: string | null
    from_club: string
    from_club_wikipedia_url: string | null
    fee_text: string | null
    fee_value: number | null
    season_label: string | null
    footballer_id: number | null
    footballer_name: string | null
    footballer_nationality: string | null
    footballer_position: string | null
    photo_url: string | null
    wikipedia_url: string | null
  }[]

  return rows.map((p) => ({
    id: p.id,
    fromClub: p.from_club,
    fromClubWikipediaUrl: p.from_club_wikipedia_url,
    feeText: p.fee_text ?? '',
    feeValue: p.fee_value,
    seasonLabel: p.season_label,
    playerName: p.footballer_name ?? p.player_name,
    nationality: p.footballer_nationality ?? p.nationality,
    position: p.footballer_position ?? p.position ?? null,
    footballerId: p.footballer_id,
    wikipediaUrl: p.wikipedia_url,
    photoUrl: p.photo_url,
    linked: p.footballer_id !== null,
  }))
}

// Resolve unlinked signings in the background: for each, find or Wikipedia-scrape
// the footballer and set footballer_id. Fire-and-forget from import/relink so the
// request returns immediately.
async function resolveMissingPlayers(rows: { rowId: number; name: string }[], clubHint: string) {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  for (const r of rows) {
    let id: number | null = null
    // Retry the whole resolution a couple of times — a transient Wikipedia
    // rate-limit shouldn't leave a straggler (e.g. the cheapest signing)
    // permanently unlinked.
    for (let attempt = 0; attempt < 3 && id == null; attempt++) {
      if (attempt > 0) await sleep(2000 * attempt)
      try {
        id = (await resolveOrCreateFootballer(r.name, clubHint)).id
      } catch {
        id = null
      }
    }
    if (id) {
      await db
        .update(record_signings_players)
        .set({ footballer_id: id })
        .where(eq(record_signings_players.id, r.rowId))
    }
    await sleep(500) // throttle between players to avoid bursting Wikipedia
  }
}

// ── Scrape preview (no writes) ───────────────────────────────────────────────
// POST /api/record-signings/scrape
recordSigningsRouter.post(
  '/scrape',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    try {
      const result = await scrapeTransfermarktRecordSignings(url)
      const matchClub = buildClubMatcher()
      const signings = result.signings.map((s) => {
        const footballer_id = dbFootballerByName(s.player_name)
        const from = matchClub(s.from_club)
        return {
          ...s,
          from_club: from.name,
          from_club_matched: from.matched,
          in_db: footballer_id !== null,
          footballer_id,
        }
      })
      return c.json({ ...result, signings })
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'Scrape failed' }, 400)
    }
  },
)

// ── Import ───────────────────────────────────────────────────────────────────
const importSchema = z.object({
  club: z.string().min(1),
  club_wikipedia_url: z.string().nullable().optional(),
  transfermarkt_id: z.string().nullable().optional(),
  source_url: z.string().url(),
  signings: z
    .array(
      z.object({
        player_name: z.string().min(1),
        nationality: z.string().nullable(),
        position: z.enum(['GK', 'DF', 'MF', 'FW']).nullable(),
        from_club: z.string().min(1),
        fee_text: z.string(),
        fee_value: z.number().int().nullable(),
        season_label: z.string(),
        footballer_id: z.number().int().nullable().optional(),
      }),
    )
    .min(1),
})

// POST /api/record-signings — create/replace a club round + its signings,
// auto-importing any players not already in the DB (Wikipedia search + scrape).
recordSigningsRouter.post('/', zValidator('json', importSchema), async (c) => {
  const body = c.req.valid('json')

  let [clubRow] = await db
    .select()
    .from(record_signings_clubs)
    .where(eq(record_signings_clubs.source_url, body.source_url))
    .limit(1)

  if (clubRow) {
    await db.delete(record_signings_players).where(eq(record_signings_players.club_id, clubRow.id))
    await db
      .update(record_signings_clubs)
      .set({ club: body.club, club_wikipedia_url: body.club_wikipedia_url ?? clubWikiUrl(body.club), transfermarkt_id: body.transfermarkt_id ?? null })
      .where(eq(record_signings_clubs.id, clubRow.id))
  } else {
    ;[clubRow] = await db
      .insert(record_signings_clubs)
      .values({
        club: body.club,
        club_wikipedia_url: body.club_wikipedia_url ?? clubWikiUrl(body.club),
        transfermarkt_id: body.transfermarkt_id ?? null,
        source_url: body.source_url,
      })
      .returning()
  }

  const matchClub = buildClubMatcher()

  // Insert every signing immediately, linking players already in the DB by name
  // (fast). Players NOT in the DB are inserted UNLINKED but fully playable (they
  // carry the scraped nationality/position/name) — they get scraped from
  // Wikipedia and linked in the background so the import request returns fast
  // instead of blocking ~minutes on 10 Wikipedia lookups (which times out).
  let sortOrder = 0
  let linked = 0
  const unresolved: { rowId: number; name: string }[] = []
  for (const s of body.signings) {
    let footballerId: number | null = null
    if (s.footballer_id != null) {
      const [f] = await db.select({ id: footballers.id }).from(footballers).where(eq(footballers.id, s.footballer_id)).limit(1)
      footballerId = f?.id ?? null
    }
    if (footballerId === null) footballerId = dbFootballerByName(s.player_name)
    if (footballerId !== null) linked++

    const fromClub = matchClub(s.from_club)
    const [row] = await db
      .insert(record_signings_players)
      .values({
        club_id: clubRow.id,
        footballer_id: footballerId,
        player_name: s.player_name,
        nationality: s.nationality,
        position: s.position,
        from_club: fromClub.name,
        from_club_wikipedia_url: fromClub.wikipedia_url,
        fee_text: s.fee_text,
        fee_value: s.fee_value,
        season_label: s.season_label,
        sort_order: sortOrder++,
      })
      .returning({ id: record_signings_players.id })
    if (footballerId === null) unresolved.push({ rowId: row.id, name: s.player_name })
  }

  if (unresolved.length > 0) void resolveMissingPlayers(unresolved, body.club)

  return c.json({ club: clubRow, importSummary: { linked, queued: unresolved.length } })
})

// POST /api/record-signings/resolve-player — find or scrape+create a footballer.
recordSigningsRouter.post(
  '/resolve-player',
  zValidator('json', z.object({ name: z.string().min(1), club: z.string().optional() })),
  async (c) => {
    const { name, club } = c.req.valid('json')
    const { id } = await resolveOrCreateFootballer(name, club ?? '')
    if (id == null) return c.json({ error: `Couldn't find "${name}" on Wikipedia.` }, 404)
    const [f] = await db.select({ id: footballers.id, name: footballers.name }).from(footballers).where(eq(footballers.id, id)).limit(1)
    return c.json(f)
  },
)

// ── Clubs admin ──────────────────────────────────────────────────────────────
// GET /api/record-signings/clubs
recordSigningsRouter.get('/clubs', (c) => {
  const rows = sqlite
    .prepare(
      `SELECT rc.id, rc.club, rc.club_wikipedia_url, rc.source_url, rc.active, rc.created_at,
              (SELECT COUNT(*) FROM record_signings_players sp WHERE sp.club_id = rc.id) AS player_count
       FROM record_signings_clubs rc
       ORDER BY rc.club ASC`,
    )
    .all() as {
    id: number
    club: string
    club_wikipedia_url: string | null
    source_url: string
    active: number
    created_at: string
    player_count: number
  }[]
  return c.json(rows.map((r) => ({ ...r, active: !!r.active })))
})

// GET /api/record-signings/clubs/:id — club + its signings in game order
recordSigningsRouter.get('/clubs/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const [clubRow] = await db.select().from(record_signings_clubs).where(eq(record_signings_clubs.id, id)).limit(1)
  if (!clubRow) return c.json({ error: 'Not found' }, 404)
  return c.json({ club: clubRow, signings: clubSignings(id) })
})

// PATCH /api/record-signings/clubs/:id — toggle active / edit club name
recordSigningsRouter.patch(
  '/clubs/:id',
  zValidator('json', z.object({ active: z.boolean().optional(), club: z.string().optional() })),
  async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    const [updated] = await db.update(record_signings_clubs).set(c.req.valid('json')).where(eq(record_signings_clubs.id, id)).returning()
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  },
)

// DELETE /api/record-signings/clubs/:id
recordSigningsRouter.delete('/clubs/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  await db.delete(record_signings_clubs).where(eq(record_signings_clubs.id, id))
  return c.json({ ok: true })
})

// PATCH /api/record-signings/signings/:id — fix from-club / link footballer
recordSigningsRouter.patch(
  '/signings/:id',
  zValidator('json', z.object({
    from_club: z.string().min(1).optional(),
    footballer_id: z.number().int().nullable().optional(),
  })),
  async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    const { from_club, footballer_id } = c.req.valid('json')
    const set: Partial<{ from_club: string; from_club_wikipedia_url: string | null; footballer_id: number | null }> = {}
    if (from_club !== undefined) { set.from_club = from_club; set.from_club_wikipedia_url = clubWikiUrl(from_club) }
    if (footballer_id !== undefined) set.footballer_id = footballer_id
    if (Object.keys(set).length === 0) return c.json({ error: 'Nothing to update' }, 400)
    const [updated] = await db.update(record_signings_players).set(set).where(eq(record_signings_players.id, id)).returning()
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true })
  },
)

// POST /api/record-signings/clubs/:id/relink — resolve still-unlinked players
recordSigningsRouter.post('/clubs/:id/relink', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const [clubRow] = await db.select({ club: record_signings_clubs.club }).from(record_signings_clubs).where(eq(record_signings_clubs.id, id)).limit(1)
  const unlinked = sqlite
    .prepare(`SELECT id, player_name FROM record_signings_players WHERE club_id = ? AND footballer_id IS NULL`)
    .all(id) as { id: number; player_name: string }[]
  if (unlinked.length > 0) {
    void resolveMissingPlayers(unlinked.map((u) => ({ rowId: u.id, name: u.player_name })), clubRow?.club ?? '')
  }
  return c.json({ ok: true, queued: unlinked.length })
})

// ── Schedule ─────────────────────────────────────────────────────────────────
// GET /api/record-signings/schedule — admin list with club meta
recordSigningsRouter.get('/schedule', async (c) => {
  const rows = await db
    .select({
      id: record_signings_schedule.id,
      date: record_signings_schedule.date,
      club_id: record_signings_schedule.club_id,
      club: record_signings_clubs.club,
    })
    .from(record_signings_schedule)
    .leftJoin(record_signings_clubs, eq(record_signings_schedule.club_id, record_signings_clubs.id))
    .orderBy(record_signings_schedule.date)
  return c.json(rows)
})

// GET /api/record-signings/schedule/rounds — playable rounds for the game
recordSigningsRouter.get('/schedule/rounds', (c) => {
  const rows = sqlite
    .prepare(
      `SELECT rss.date, rss.club_id, rc.club, rc.club_wikipedia_url
       FROM record_signings_schedule rss
       JOIN record_signings_clubs rc ON rss.club_id = rc.id
       WHERE rss.club_id IS NOT NULL AND rc.active = 1
       ORDER BY rss.date ASC`,
    )
    .all() as { date: string; club_id: number; club: string; club_wikipedia_url: string | null }[]

  const rounds = rows.map((row) => {
    const signings = clubSignings(row.club_id).slice(0, 10)
    return {
      date: row.date,
      clubId: row.club_id,
      club: row.club,
      clubWikipediaUrl: row.club_wikipedia_url,
      signings,
      playerNames: signings.map((s) => s.playerName),
    }
  })
  return c.json(rounds)
})

// PUT /api/record-signings/schedule/:date — upsert assignment
recordSigningsRouter.put(
  '/schedule/:date',
  zValidator('json', z.object({ club_id: z.number().int() })),
  async (c) => {
    const date = c.req.param('date')
    const { club_id } = c.req.valid('json')
    const existing = await db.select().from(record_signings_schedule).where(eq(record_signings_schedule.date, date))
    if (existing.length > 0) {
      const [updated] = await db.update(record_signings_schedule).set({ club_id }).where(eq(record_signings_schedule.date, date)).returning()
      return c.json(updated)
    }
    const [created] = await db.insert(record_signings_schedule).values({ date, club_id }).returning()
    return c.json(created, 201)
  },
)

// DELETE /api/record-signings/schedule — clear all
recordSigningsRouter.delete('/schedule', async (c) => {
  await db.delete(record_signings_schedule)
  return c.json({ ok: true })
})

// DELETE /api/record-signings/schedule/:date
recordSigningsRouter.delete('/schedule/:date', async (c) => {
  const date = c.req.param('date')
  const [deleted] = await db.delete(record_signings_schedule).where(eq(record_signings_schedule.date, date)).returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
