import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db, sqlite, normalizeName } from '../db/client.ts'
import {
  transfer_windows,
  transfer_window_players,
  transfer_history_schedule,
  footballers,
  career_stints,
} from '../db/schema.ts'
import {
  scrapeTransfermarktTransfers,
  scrapeWikipedia,
  normalizeClubAlias,
} from '../services/scraper.ts'

export const transferHistoryRouter = new Hono()

const WIKI_HEADERS = { 'User-Agent': 'GuessTheCareer-Admin/1.0' }

function stripDiacritics(s: string): string {
  return normalizeName(s)
}

// Look up a club's Wikipedia URL from the clubs table (canonicalised name).
function clubWikiUrl(club: string): string | null {
  const row = sqlite
    .prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`)
    .get(normalizeClubAlias(club)) as { wikipedia_url: string | null } | undefined
  return row?.wikipedia_url ?? null
}

// ── Club-name matching ──────────────────────────────────────────────────────
// Transfermarkt uses long club names ("FC Barcelona", "Atlético de Madrid",
// "Real Betis Balompié") while our DB uses short ones ("Barcelona", "Atletico
// Madrid", "Real Betis"). Translate a transfermarkt name to the best matching
// club already in our DB (else keep the raw name).

interface ClubRow { name: string; wikipedia_url: string | null }
// `matched` is false when no DB club was found and we kept the raw name.
type ClubMatch = ClubRow & { matched: boolean }

// Generic words too ambiguous to identify a club on their own (a lone match on
// one of these is rejected; they're fine as part of a multi-token match).
const GENERIC_CLUB_WORDS = new Set([
  'united', 'city', 'real', 'racing', 'sporting', 'atletico', 'deportivo', 'dynamo',
  'dinamo', 'inter', 'olympique', 'athletic', 'rovers', 'county', 'town', 'wanderers',
  'albion', 'rangers', 'nacional', 'sport', 'sports', 'union', 'junior', 'juniors',
  'club', 'clube', 'sociedade', 'esportiva', 'esporte', 'calcio', 'futebol', 'futbol',
])

// Significant tokens for matching: strip diacritics/punctuation and drop short
// tokens (≤2 chars) — this generically removes club-type prefixes like FC, CF,
// CA, AC, AS, CD, SD, UD, CR, UE, RC… without an explicit list.
function significantTokens(s: string): string[] {
  return stripDiacritics(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
}

// Reserve / youth sides ("… B", "Castilla", "U19") must NOT collapse onto the
// senior club — leave them unmatched so they're flagged.
function isReserveTeam(raw: string): boolean {
  return /\s(B|C|II|III|IV)$/.test(raw) ||
    /\bU-?\d{1,2}\b/.test(raw) ||
    /\b(reserves?|youth|amateur|academy|castilla)\b/i.test(raw)
}

type ClubMatcher = (raw: string) => ClubMatch

function buildClubMatcher(): ClubMatcher {
  const clubs = sqlite.prepare(`SELECT name, wikipedia_url FROM clubs`).all() as ClubRow[]
  const tokenized = clubs.map((c) => ({ c, tokens: significantTokens(c.name) }))

  return (raw: string): ClubMatch => {
    const fallback: ClubMatch = { name: raw, wikipedia_url: clubWikiUrl(raw), matched: false }

    // 1. Authoritative: alias map / exact (case-insensitive) name match.
    const alias = normalizeClubAlias(raw)
    const exact = clubs.find(
      (c) => c.name.toLowerCase() === raw.toLowerCase() || c.name.toLowerCase() === alias.toLowerCase(),
    )
    if (exact) return { ...exact, matched: true }

    if (isReserveTeam(raw)) return fallback

    const rawTokens = significantTokens(raw)
    if (rawTokens.length === 0) return fallback

    // Earliest raw-name position a DB token matches (exact, or fuzzy for longer
    // tokens to absorb transliteration), or null if it isn't present at all.
    const tokenPos = (dt: string): number | null => {
      let pos: number | null = null
      rawTokens.forEach((rt, i) => {
        if ((rt === dt || (dt.length >= 5 && damerau(rt, dt) <= 1)) && (pos === null || i < pos)) pos = i
      })
      return pos
    }

    // 2. Best DB club whose every token is contained in the raw name. Rank by
    // specificity (more tokens), then how early it appears (club name leads,
    // city trails), then a real Wikipedia URL, then the shorter name.
    let best: { c: ClubRow; count: number; pos: number } | null = null
    for (const { c, tokens } of tokenized) {
      if (tokens.length === 0) continue
      if (tokens.length === 1 && GENERIC_CLUB_WORDS.has(tokens[0])) continue
      let minPos = Infinity
      let allPresent = true
      for (const dt of tokens) {
        const p = tokenPos(dt)
        if (p === null) { allPresent = false; break }
        if (p < minPos) minPos = p
      }
      if (!allPresent) continue
      const better =
        !best ||
        tokens.length > best.count ||
        (tokens.length === best.count && minPos < best.pos) ||
        (tokens.length === best.count && minPos === best.pos &&
          (c.wikipedia_url ? 1 : 0) > (best.c.wikipedia_url ? 1 : 0)) ||
        (tokens.length === best.count && minPos === best.pos &&
          (c.wikipedia_url ? 1 : 0) === (best.c.wikipedia_url ? 1 : 0) && c.name.length < best.c.name.length)
      if (better) best = { c, count: tokens.length, pos: minPos }
    }

    return best ? { ...best.c, matched: true } : fallback
  }
}

// ── Footballer resolve-or-create ────────────────────────────────────────────
// Transfermarkt gives no Wikipedia URL, so: try a DB name match first, else
// search Wikipedia by name (+ club hint), scrape the best match and create the
// footballer with senior career stints. Returns the footballer id or null.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Edit distance with transpositions — tolerates transliteration differences
// (e.g. "valeriy" vs "valery") when fuzzy-matching first names.
function damerau(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
    }
  }
  return dp[m][n]
}

// Wikipedia's search API rate-limits under bulk imports; retry on 429/503.
async function wikiSearch(query: string, attempt = 0): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&format=json&srlimit=5`
  let res: Response
  try {
    res = await fetch(url, { headers: WIKI_HEADERS })
  } catch {
    if (attempt < 3) { await sleep(600 * (attempt + 1)); return wikiSearch(query, attempt + 1) }
    return []
  }
  if ((res.status === 429 || res.status === 503) && attempt < 3) {
    await sleep(600 * (attempt + 1))
    return wikiSearch(query, attempt + 1)
  }
  if (!res.ok) return []
  const data = (await res.json()) as { query?: { search?: { title: string }[] } }
  return (data.query?.search ?? []).map((s) => s.title)
}

// A title matches a name when the surname is present and every other name part
// is present or a near-miss of some title token (handles transliterations).
function titleMatchesName(title: string, nameParts: string[]): boolean {
  if (nameParts.length === 0) return false
  const titleTokens = stripDiacritics(title).split(/\s+/).filter(Boolean)
  const has = (p: string) =>
    titleTokens.some((t) => t === p || t.includes(p) || (p.length >= 5 && damerau(t, p) <= 1))
  const surname = nameParts[nameParts.length - 1]
  if (!titleTokens.some((t) => t.includes(surname) || (surname.length >= 5 && damerau(t, surname) <= 1)))
    return false
  return nameParts.slice(0, -1).every(has) || nameParts.length === 1
}

function dbFootballerByName(name: string): number | null {
  const row = sqlite
    .prepare(`SELECT id FROM footballers WHERE normalize(name) = normalize(?) LIMIT 1`)
    .get(name) as { id: number } | undefined
  return row?.id ?? null
}

async function insertScrapedFootballer(wikiUrl: string): Promise<number | null> {
  // Avoid a unique-constraint clash if the canonical URL already exists.
  const [existing] = await db
    .select({ id: footballers.id })
    .from(footballers)
    .where(eq(footballers.wikipedia_url, wikiUrl))
    .limit(1)
  if (existing) return existing.id

  const scraped = await scrapeWikipedia(wikiUrl)

  const [byScrapedUrl] = await db
    .select({ id: footballers.id })
    .from(footballers)
    .where(eq(footballers.wikipedia_url, scraped.wikipedia_url))
    .limit(1)
  if (byScrapedUrl) return byScrapedUrl.id

  const [created] = await db
    .insert(footballers)
    .values({
      name: scraped.name,
      wikipedia_url: scraped.wikipedia_url,
      nationality: scraped.nationality,
      position: scraped.position,
      all_positions: scraped.all_positions ?? null,
      born: scraped.born,
      photo_url: scraped.photo_url ?? null,
    })
    .returning()

  const seniors = scraped.stints.filter((s) => s.stint_type === 'senior')
  if (seniors.length > 0) {
    await db.insert(career_stints).values(
      seniors.map((s, i) => ({
        footballer_id: created.id,
        sort_order: i,
        years: s.years,
        club: s.club,
        club_wikipedia_url: s.club_wikipedia_url ?? null,
        apps: s.apps ?? null,
        goals: s.goals ?? null,
        stint_type: 'senior' as const,
      })),
    )
  }
  return created.id
}

async function resolveOrCreateFootballer(
  name: string,
  clubHint: string,
): Promise<{ id: number | null; created: boolean }> {
  const existing = dbFootballerByName(name)
  if (existing) return { id: existing, created: false }

  // Wikipedia name search with a couple of disambiguating queries.
  const nameParts = stripDiacritics(name).split(/\s+/).filter((p) => p.length > 2)

  const titles: string[] = []
  for (const q of [`${name} footballer`, `${name} ${clubHint}`, name]) {
    for (const title of await wikiSearch(q)) {
      if (titleMatchesName(title, nameParts) && !titles.includes(title)) titles.push(title)
    }
    await sleep(120)
  }

  for (const title of titles.slice(0, 5)) {
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
    try {
      const id = await insertScrapedFootballer(wikiUrl)
      if (id) return { id, created: true }
    } catch {
      // try the next candidate
    }
    await sleep(250)
  }

  return { id: null, created: false }
}

// Abbreviate a full-text position ("Attacking midfielder", "Centre-back") to a
// GK/DF/MF/FW badge. Midfield is checked first so "attacking/defensive
// midfield" doesn't fall through to the FW/DF checks.
function abbrevPosition(pos: string | null): 'GK' | 'DF' | 'MF' | 'FW' | null {
  if (!pos) return null
  const s = pos.toLowerCase()
  if (s.includes('keeper') || s.includes('goalie')) return 'GK'
  if (s.includes('midfield')) return 'MF'
  if (s.includes('back') || s.includes('defender') || s.includes('sweeper') || s.includes('libero')) return 'DF'
  if (s.includes('striker') || s.includes('forward') || s.includes('winger') || s.includes('attack')) return 'FW'
  return null
}

// ── Game-shaped transfers for a window ──────────────────────────────────────
// Used by both the playable rounds feed and the admin detail view so they're
// guaranteed to match. Ordered exactly as the game shows them (fee desc).
function windowTransfers(windowId: number) {
  const players = sqlite
    .prepare(
      `SELECT tp.id, tp.player_name, tp.nationality, tp.position,
              tp.from_club, tp.from_club_wikipedia_url, tp.to_club, tp.to_club_wikipedia_url,
              tp.fee_text, tp.fee_value, tp.footballer_id,
              f.name AS footballer_name, f.nationality AS footballer_nationality,
              f.position AS footballer_position, f.photo_url, f.wikipedia_url
       FROM transfer_window_players tp
       LEFT JOIN footballers f ON tp.footballer_id = f.id
       WHERE tp.window_id = ?
       ORDER BY (tp.fee_value IS NULL), tp.fee_value DESC, tp.sort_order ASC`,
    )
    .all(windowId) as {
    id: number
    player_name: string
    nationality: string | null
    position: string | null
    from_club: string
    from_club_wikipedia_url: string | null
    to_club: string
    to_club_wikipedia_url: string | null
    fee_text: string | null
    fee_value: number | null
    footballer_id: number | null
    footballer_name: string | null
    footballer_nationality: string | null
    footballer_position: string | null
    photo_url: string | null
    wikipedia_url: string | null
  }[]

  return players.map((p) => ({
    id: p.id,
    fromClub: p.from_club,
    fromClubWikipediaUrl: p.from_club_wikipedia_url,
    toClub: p.to_club,
    toClubWikipediaUrl: p.to_club_wikipedia_url,
    feeText: p.fee_text ?? '',
    feeValue: p.fee_value,
    playerName: p.footballer_name ?? p.player_name,
    nationality: p.footballer_nationality ?? p.nationality,
    // Use the linked footballer's DB position (abbreviated); fall back to the
    // scraped GK/DF/MF/FW when no footballer is linked.
    position: abbrevPosition(p.footballer_position) ?? p.position ?? null,
    footballerId: p.footballer_id,
    wikipediaUrl: p.wikipedia_url,
    photoUrl: p.photo_url,
    // Admin-only: whether this row is linked to a footballer in our DB.
    linked: p.footballer_id !== null,
  }))
}

// ── Scrape preview ──────────────────────────────────────────────────────────
// POST /api/transfer-history/scrape — scrape transfermarkt + flag which players
// already exist in our DB. No DB writes.
transferHistoryRouter.post(
  '/scrape',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    try {
      const result = await scrapeTransfermarktTransfers(url)
      const matchClub = buildClubMatcher()
      const transfers = result.transfers.map((t) => {
        const footballer_id = dbFootballerByName(t.player_name)
        const from = matchClub(t.from_club)
        const to = matchClub(t.to_club)
        return {
          ...t,
          from_club: from.name,
          from_club_matched: from.matched,
          to_club: to.name,
          to_club_matched: to.matched,
          in_db: footballer_id !== null,
          footballer_id,
        }
      })
      return c.json({ ...result, transfers })
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'Scrape failed' }, 400)
    }
  },
)

// ── Import ────────────────────────────────────────────────────────────────--
const importSchema = z.object({
  league: z.string().min(1),
  league_code: z.string(),
  season_id: z.number().int(),
  season_label: z.string(),
  source_url: z.string().url(),
  transfers: z
    .array(
      z.object({
        player_name: z.string().min(1),
        nationality: z.string().nullable(),
        position: z.enum(['GK', 'DF', 'MF', 'FW']).nullable(),
        from_club: z.string().min(1),
        to_club: z.string().min(1),
        fee_text: z.string(),
        fee_value: z.number().int().nullable(),
        footballer_id: z.number().int().nullable().optional(),
      }),
    )
    .min(1),
})

// POST /api/transfer-history — create a window + selected transfers, auto-import
// any players not already in the DB (Wikipedia search + scrape).
transferHistoryRouter.post('/', zValidator('json', importSchema), async (c) => {
  const body = c.req.valid('json')

  // Reuse an existing window for this source URL (re-import replaces players).
  let [window] = await db
    .select()
    .from(transfer_windows)
    .where(eq(transfer_windows.source_url, body.source_url))
    .limit(1)

  if (window) {
    await db
      .delete(transfer_window_players)
      .where(eq(transfer_window_players.window_id, window.id))
  } else {
    ;[window] = await db
      .insert(transfer_windows)
      .values({
        league: body.league,
        league_code: body.league_code,
        season_id: body.season_id,
        season_label: body.season_label,
        source_url: body.source_url,
      })
      .returning()
  }

  const summary = { added: [] as string[], alreadyExisted: [] as string[], failed: [] as string[] }
  const matchClub = buildClubMatcher()

  let sortOrder = 0
  for (const t of body.transfers) {
    // If the admin manually linked an existing footballer, use it directly;
    // otherwise resolve by name (DB match, else Wikipedia search + create).
    let footballerId: number | null = null
    let created = false
    if (t.footballer_id != null) {
      const [f] = await db.select({ id: footballers.id }).from(footballers).where(eq(footballers.id, t.footballer_id)).limit(1)
      footballerId = f?.id ?? null
    }
    if (footballerId === null) {
      const r = await resolveOrCreateFootballer(t.player_name, t.to_club)
      footballerId = r.id
      created = r.created
    }
    if (footballerId === null) summary.failed.push(t.player_name)
    else if (created) summary.added.push(t.player_name)
    else summary.alreadyExisted.push(t.player_name)

    const fromClub = matchClub(t.from_club)
    const toClub = matchClub(t.to_club)

    await db.insert(transfer_window_players).values({
      window_id: window.id,
      footballer_id: footballerId,
      player_name: t.player_name,
      nationality: t.nationality,
      position: t.position,
      from_club: fromClub.name,
      from_club_wikipedia_url: fromClub.wikipedia_url,
      to_club: toClub.name,
      to_club_wikipedia_url: toClub.wikipedia_url,
      fee_text: t.fee_text,
      fee_value: t.fee_value,
      sort_order: sortOrder++,
    })
  }

  return c.json({ window, importSummary: summary })
})

// POST /api/transfer-history/resolve-player — find an existing footballer by
// name, or scrape + create one from Wikipedia. Used by the picker's "Scrape"
// action when a player isn't in the DB (e.g. a reversed/garbled scraped name).
transferHistoryRouter.post(
  '/resolve-player',
  zValidator('json', z.object({ name: z.string().min(1), club: z.string().optional() })),
  async (c) => {
    const { name, club } = c.req.valid('json')
    const { id } = await resolveOrCreateFootballer(name, club ?? '')
    if (id == null) return c.json({ error: `Couldn't find "${name}" on Wikipedia.` }, 404)
    const [f] = await db
      .select({ id: footballers.id, name: footballers.name })
      .from(footballers)
      .where(eq(footballers.id, id))
      .limit(1)
    return c.json(f)
  },
)

// ── Windows admin ─────────────────────────────────────────────────────────--
// GET /api/transfer-history/windows
transferHistoryRouter.get('/windows', async (c) => {
  const rows = await db
    .select({
      id: transfer_windows.id,
      league: transfer_windows.league,
      league_code: transfer_windows.league_code,
      season_id: transfer_windows.season_id,
      season_label: transfer_windows.season_label,
      source_url: transfer_windows.source_url,
      active: transfer_windows.active,
      created_at: transfer_windows.created_at,
      player_count: sql<number>`(SELECT COUNT(*) FROM transfer_window_players WHERE window_id = ${transfer_windows.id})`,
    })
    .from(transfer_windows)
    .orderBy(sql`${transfer_windows.season_id} ASC, ${transfer_windows.league} ASC`)
  return c.json(rows)
})

// GET /api/transfer-history/windows/:id — window + its transfers in game order
transferHistoryRouter.get('/windows/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const [window] = await db.select().from(transfer_windows).where(eq(transfer_windows.id, id)).limit(1)
  if (!window) return c.json({ error: 'Not found' }, 404)
  return c.json({ window, transfers: windowTransfers(id) })
})

// PATCH /api/transfer-history/windows/:id — toggle active / edit meta
transferHistoryRouter.patch(
  '/windows/:id',
  zValidator('json', z.object({ active: z.boolean().optional(), league: z.string().optional(), season_label: z.string().optional() })),
  async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    const data = c.req.valid('json')
    const [updated] = await db.update(transfer_windows).set(data).where(eq(transfer_windows.id, id)).returning()
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  },
)

// DELETE /api/transfer-history/windows/:id
transferHistoryRouter.delete('/windows/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  await db.delete(transfer_windows).where(eq(transfer_windows.id, id))
  return c.json({ ok: true })
})

// PATCH /api/transfer-history/transfers/:id — manually fix a transfer's clubs
// and/or link it to an existing footballer. Chosen clubs are exact DB names so
// we resolve the badge URL directly.
transferHistoryRouter.patch(
  '/transfers/:id',
  zValidator('json', z.object({
    from_club: z.string().min(1).optional(),
    to_club: z.string().min(1).optional(),
    footballer_id: z.number().int().nullable().optional(),
  })),
  async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    const { from_club, to_club, footballer_id } = c.req.valid('json')
    const set: Partial<{
      from_club: string; from_club_wikipedia_url: string | null
      to_club: string; to_club_wikipedia_url: string | null
      footballer_id: number | null
    }> = {}
    if (from_club !== undefined) { set.from_club = from_club; set.from_club_wikipedia_url = clubWikiUrl(from_club) }
    if (to_club !== undefined) { set.to_club = to_club; set.to_club_wikipedia_url = clubWikiUrl(to_club) }
    if (footballer_id !== undefined) set.footballer_id = footballer_id
    if (Object.keys(set).length === 0) return c.json({ error: 'Nothing to update' }, 400)

    const [updated] = await db
      .update(transfer_window_players)
      .set(set)
      .where(eq(transfer_window_players.id, id))
      .returning()
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true })
  },
)

// POST /api/transfer-history/windows/:id/relink — resolve still-unlinked players
transferHistoryRouter.post('/windows/:id/relink', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const unlinked = sqlite
    .prepare(
      `SELECT id, player_name, to_club FROM transfer_window_players WHERE window_id = ? AND footballer_id IS NULL`,
    )
    .all(id) as { id: number; player_name: string; to_club: string }[]

  const summary = { relinked: [] as string[], failed: [] as string[] }
  for (const p of unlinked) {
    const { id: footballerId } = await resolveOrCreateFootballer(p.player_name, p.to_club)
    if (footballerId) {
      await db
        .update(transfer_window_players)
        .set({ footballer_id: footballerId })
        .where(eq(transfer_window_players.id, p.id))
      summary.relinked.push(p.player_name)
    } else {
      summary.failed.push(p.player_name)
    }
  }
  return c.json({ ok: true, summary })
})

// ── Schedule ────────────────────────────────────────────────────────────────
// GET /api/transfer-history/schedule — admin list with window meta
transferHistoryRouter.get('/schedule', async (c) => {
  const rows = await db
    .select({
      id: transfer_history_schedule.id,
      date: transfer_history_schedule.date,
      window_id: transfer_history_schedule.window_id,
      league: transfer_windows.league,
      season_label: transfer_windows.season_label,
    })
    .from(transfer_history_schedule)
    .leftJoin(transfer_windows, eq(transfer_history_schedule.window_id, transfer_windows.id))
    .orderBy(transfer_history_schedule.date)
  return c.json(rows)
})

// GET /api/transfer-history/schedule/rounds — playable rounds for the game
transferHistoryRouter.get('/schedule/rounds', (c) => {
  const rows = sqlite
    .prepare(
      `SELECT ths.date, ths.window_id, w.league, w.season_label
       FROM transfer_history_schedule ths
       JOIN transfer_windows w ON ths.window_id = w.id
       WHERE ths.window_id IS NOT NULL AND w.active = 1
       ORDER BY ths.date ASC`,
    )
    .all() as { date: string; window_id: number; league: string; season_label: string }[]

  const rounds = rows.map((row) => {
    const transfers = windowTransfers(row.window_id)
    return {
      date: row.date,
      windowId: row.window_id,
      league: row.league,
      seasonLabel: row.season_label,
      transfers,
      playerNames: transfers.map((t) => t.playerName),
    }
  })

  return c.json(rounds)
})

// PUT /api/transfer-history/schedule/:date — upsert assignment
transferHistoryRouter.put(
  '/schedule/:date',
  zValidator('json', z.object({ window_id: z.number().int() })),
  async (c) => {
    const date = c.req.param('date')
    const { window_id } = c.req.valid('json')
    const existing = await db
      .select()
      .from(transfer_history_schedule)
      .where(eq(transfer_history_schedule.date, date))
    if (existing.length > 0) {
      const [updated] = await db
        .update(transfer_history_schedule)
        .set({ window_id })
        .where(eq(transfer_history_schedule.date, date))
        .returning()
      return c.json(updated)
    }
    const [created] = await db
      .insert(transfer_history_schedule)
      .values({ date, window_id })
      .returning()
    return c.json(created, 201)
  },
)

// DELETE /api/transfer-history/schedule — clear all
transferHistoryRouter.delete('/schedule', async (c) => {
  await db.delete(transfer_history_schedule)
  return c.json({ ok: true })
})

// DELETE /api/transfer-history/schedule/:date
transferHistoryRouter.delete('/schedule/:date', async (c) => {
  const date = c.req.param('date')
  const [deleted] = await db
    .delete(transfer_history_schedule)
    .where(eq(transfer_history_schedule.date, date))
    .returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
