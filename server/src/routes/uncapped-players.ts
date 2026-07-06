import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db, sqlite } from '../db/client.ts'
import { footballers } from '../db/schema.ts'
import { normalizeClubAlias } from '../services/scraper.ts'
import { nationalitiesMatch, isSeniorNationalTeam, canonicalNationality } from '../services/football.ts'
import { clubWikiUrl } from "../services/clubs.ts";

export const uncappedRouter = new Hono()

const MIN_PLAYERS = 3


// A senior cap = an international stint for a full national team (no age-group /
// B / Olympic suffix) with at least one appearance.
function hasSeniorCap(intlStints: { club: string; apps: number | null }[]): boolean {
  return intlStints.some((s) => isSeniorNationalTeam(s.club) && (s.apps ?? 0) > 0)
}

// Every footballer who has ever made a senior international appearance (any
// country). Uncapped players are everyone else.
function cappedSet(): Set<number> {
  const rows = sqlite
    .prepare(`SELECT footballer_id, club, apps FROM career_stints WHERE stint_type = 'international'`)
    .all() as { footballer_id: number; club: string; apps: number | null }[]
  const s = new Set<number>()
  for (const r of rows) {
    if (isSeniorNationalTeam(r.club) && (r.apps ?? 0) > 0) s.add(r.footballer_id)
  }
  return s
}

// Rank a non-senior international side by level. Higher score = higher honour.
// (These players are uncapped, so senior sides never reach here.)
function intlLevel(club: string): { score: number; label: string } | null {
  const t = club.trim()
  if (/\bB$/.test(t)) return { score: 95, label: 'B' }
  if (/\bOlympic\b/i.test(t)) return { score: 90, label: 'Olympic' }
  if (/\bAmateur\b/i.test(t)) return { score: 85, label: 'Amateur' }
  const m = t.match(/U-?(\d{1,2})/i)
  if (m) return { score: Number(m[1]), label: `U${m[1]}` }
  return null
}

// The highest international level a player reached, as a display string, e.g.
// "12 U21 caps" / "Olympic caps" — or "No caps" when they never featured at any
// recognised youth/B/Olympic level.
function topIntlCaps(footballerId: number): string {
  const stints = sqlite
    .prepare(`SELECT club, apps FROM career_stints WHERE footballer_id = ? AND stint_type = 'international'`)
    .all(footballerId) as { club: string; apps: number | null }[]
  let best: { score: number; label: string; apps: number } | null = null
  for (const s of stints) {
    const lvl = intlLevel(s.club)
    if (!lvl) continue
    const apps = s.apps ?? 0
    if (!best || lvl.score > best.score) best = { ...lvl, apps }
  }
  if (!best) return 'No caps'
  return best.apps > 0
    ? `${best.apps} ${best.label} cap${best.apps === 1 ? '' : 's'}`
    : `${best.label} caps`
}

// Combine a player's stint "years" strings for one club into a single span.
function yearsSpan(raw: string[]): string | null {
  const nums = raw.join('|').match(/\d{4}/g)
  if (!nums || nums.length === 0) return null
  const years = nums.map(Number)
  const min = Math.min(...years)
  const max = Math.max(...years)
  return min === max ? String(min) : `${min}–${max}`
}

// The club a player made the most senior appearances for (any club) — the hint.
function hintClubFor(footballerId: number): { club: string | null; clubWikiUrl: string | null; apps: number; years: string | null } {
  const stints = sqlite
    .prepare(`SELECT club, apps, years, club_wikipedia_url FROM career_stints WHERE footballer_id = ? AND stint_type = 'senior'`)
    .all(footballerId) as { club: string; apps: number | null; years: string | null; club_wikipedia_url: string | null }[]
  const byClub = new Map<string, { apps: number; name: string; wiki: string | null; years: string[] }>()
  let total = 0
  for (const s of stints) {
    const key = normalizeClubAlias(s.club)
    const name = s.club.replace(/^→\s*/, '').replace(/\s*\((loan|trial)\)\s*$/i, '')
    const cur = byClub.get(key) ?? { apps: 0, name, wiki: s.club_wikipedia_url, years: [] }
    cur.apps += s.apps ?? 0
    total += s.apps ?? 0
    if (s.club_wikipedia_url && !cur.wiki) cur.wiki = s.club_wikipedia_url
    if (s.years) cur.years.push(s.years)
    byClub.set(key, cur)
  }
  let best: { apps: number; name: string; wiki: string | null; years: string[] } | null = null
  for (const v of byClub.values()) if (!best || v.apps > best.apps) best = v
  return {
    club: best?.name ?? null,
    clubWikiUrl: best ? (best.wiki ?? clubWikiUrl(best.name)) : null,
    apps: total,
    years: best ? yearsSpan(best.years) : null,
  }
}

// [nationality, uncappedCount] for nationalities with >= MIN uncapped players
// (players with at least one senior club stint so they have a hint).
function findValidCountries(): [string, number][] {
  const rows = sqlite
    .prepare(
      `SELECT f.id, f.nationality
       FROM footballers f
       JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
       WHERE f.nationality IS NOT NULL AND f.nationality != ''
       GROUP BY f.id`,
    )
    .all() as { id: number; nationality: string }[]
  const capped = cappedSet()
  const natPlayers = new Map<string, Set<number>>()
  for (const { id, nationality } of rows) {
    if (capped.has(id)) continue
    // Group historical variants (West/East Germany → Germany) under one country.
    const nat = canonicalNationality(nationality)
    if (!nat) continue
    if (!natPlayers.has(nat)) natPlayers.set(nat, new Set())
    natPlayers.get(nat)!.add(id)
  }
  const valid: [string, number][] = []
  for (const [nat, players] of natPlayers) {
    if (players.size >= MIN_PLAYERS) valid.push([nat, players.size])
  }
  return valid
}

interface UncappedPlayer {
  id: number
  name: string
  photo_url: string | null
  apps: number
  caps: string
  position: string | null
  hintClub: string | null
  clubWikiUrl: string | null
  years: string | null
}

// All uncapped players of a nationality with their most-played club + years hint.
function getCountryPlayers(nationality: string): UncappedPlayer[] {
  // Match every raw nationality that canonicalises to the requested country so a
  // grouped country (e.g. Germany) includes its variants (West/East Germany).
  const target = canonicalNationality(nationality).toLowerCase()
  const natRows = sqlite
    .prepare(`SELECT DISTINCT nationality FROM footballers WHERE nationality IS NOT NULL AND nationality != ''`)
    .all() as { nationality: string }[]
  const matching = natRows
    .map((r) => r.nationality)
    .filter((n) => canonicalNationality(n).toLowerCase() === target)
  if (matching.length === 0) return []
  const placeholders = matching.map(() => '?').join(',')
  const rows = sqlite
    .prepare(
      `SELECT f.id, f.name, f.photo_url, f.position, cs.club, cs.apps, cs.years, cs.club_wikipedia_url
       FROM footballers f
       JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
       WHERE f.nationality IN (${placeholders})`,
    )
    .all(...matching) as {
    id: number; name: string; photo_url: string | null; position: string | null
    club: string; apps: number | null; years: string | null; club_wikipedia_url: string | null
  }[]
  const capped = cappedSet()

  const players = new Map<number, {
    name: string; photo_url: string | null; position: string | null
    byClub: Map<string, { apps: number; name: string; wiki: string | null; years: string[] }>
  }>()
  for (const r of rows) {
    if (capped.has(r.id)) continue
    if (!players.has(r.id)) players.set(r.id, { name: r.name, photo_url: r.photo_url, position: r.position, byClub: new Map() })
    const p = players.get(r.id)!
    const key = normalizeClubAlias(r.club)
    const name = r.club.replace(/^→\s*/, '').replace(/\s*\((loan|trial)\)\s*$/i, '')
    const cur = p.byClub.get(key) ?? { apps: 0, name, wiki: r.club_wikipedia_url, years: [] }
    cur.apps += r.apps ?? 0
    if (r.club_wikipedia_url && !cur.wiki) cur.wiki = r.club_wikipedia_url
    if (r.years) cur.years.push(r.years)
    p.byClub.set(key, cur)
  }

  const out: UncappedPlayer[] = []
  for (const [id, p] of players) {
    let best: { apps: number; name: string; wiki: string | null; years: string[] } | null = null
    let total = 0
    for (const v of p.byClub.values()) { total += v.apps; if (!best || v.apps > best.apps) best = v }
    if (!best) continue
    out.push({
      id, name: p.name, photo_url: p.photo_url, apps: total, caps: topIntlCaps(id), position: p.position,
      hintClub: best.name, clubWikiUrl: best.wiki ?? clubWikiUrl(best.name), years: yearsSpan(best.years),
    })
  }
  out.sort((a, b) => b.apps - a.apps || a.name.localeCompare(b.name))
  return out
}

// ── Admin ───────────────────────────────────────────────────────────────────
uncappedRouter.get('/admin/countries', (c) => {
  const valid = findValidCountries().sort((a, b) => b[1] - a[1])

  // Seed every detected country as enabled on the first visit (when the table is
  // empty) so all are checked by default.
  const seeded = sqlite.prepare(`SELECT COUNT(*) as n FROM uncapped_enabled_countries`).get() as { n: number }
  if (seeded.n === 0 && valid.length > 0) {
    const insert = sqlite.prepare(`INSERT OR IGNORE INTO uncapped_enabled_countries (nationality, round_size) VALUES (?, 5)`)
    sqlite.transaction((nats: string[]) => { for (const nat of nats) insert.run(nat) })(valid.map(([nat]) => nat))
  }

  const enabled = sqlite
    .prepare(`SELECT nationality, round_size FROM uncapped_enabled_countries`)
    .all() as { nationality: string; round_size: number }[]
  const enabledMap = new Map(enabled.map((e) => [e.nationality, e.round_size]))
  const data = valid.map(([nationality, playerCount]) => ({
    nationality,
    playerCount,
    enabled: enabledMap.has(nationality),
    roundSize: enabledMap.get(nationality) ?? 5,
  }))
  return c.json({ data, total: data.length, enabledCount: enabled.length })
})

uncappedRouter.get('/admin/countries/:nationality/players', (c) => {
  return c.json(getCountryPlayers(c.req.param('nationality')))
})

uncappedRouter.post(
  '/admin/countries/enable',
  zValidator('json', z.object({ nationality: z.string().min(1), roundSize: z.number().int().optional() })),
  (c) => {
    const { nationality, roundSize } = c.req.valid('json')
    const size = roundSize && roundSize > 0 ? Math.floor(roundSize) : 5
    sqlite
      .prepare(
        `INSERT INTO uncapped_enabled_countries (nationality, round_size) VALUES (?, ?)
         ON CONFLICT(nationality) DO UPDATE SET round_size = excluded.round_size`,
      )
      .run(nationality, size)
    return c.json({ ok: true })
  },
)

uncappedRouter.delete(
  '/admin/countries/enable',
  zValidator('json', z.object({ nationality: z.string().min(1) })),
  (c) => {
    sqlite
      .prepare(`DELETE FROM uncapped_enabled_countries WHERE LOWER(nationality) = LOWER(?)`)
      .run(c.req.valid('json').nationality)
    return c.json({ ok: true })
  },
)

// ── Schedule ────────────────────────────────────────────────────────────────
uncappedRouter.get('/schedule', (c) => {
  const rows = sqlite
    .prepare(`SELECT id, date, nationality, created_at FROM uncapped_schedule ORDER BY date ASC`)
    .all()
  return c.json(rows)
})

uncappedRouter.get('/schedule/rounds', (c) => {
  const scheduled = sqlite
    .prepare(`SELECT date, nationality FROM uncapped_schedule ORDER BY date ASC`)
    .all() as { date: string; nationality: string }[]
  if (scheduled.length === 0) return c.json([])
  const countMap = new Map<string, number>()
  for (const [nat, count] of findValidCountries()) countMap.set(nat, count)
  const sizeRows = sqlite
    .prepare(`SELECT nationality, round_size FROM uncapped_enabled_countries`)
    .all() as { nationality: string; round_size: number }[]
  const sizeMap = new Map(sizeRows.map((r) => [r.nationality, r.round_size]))
  return c.json(scheduled.map((row) => ({
    date: row.date,
    nationality: row.nationality,
    roundSize: sizeMap.get(row.nationality) ?? 5,
    playerCount: countMap.get(row.nationality) ?? 0,
  })))
})

uncappedRouter.put(
  '/schedule/:date',
  zValidator('json', z.object({ nationality: z.string().min(1) })),
  (c) => {
    const date = c.req.param('date')
    const { nationality } = c.req.valid('json')
    const existing = sqlite.prepare(`SELECT id FROM uncapped_schedule WHERE date = ?`).get(date)
    if (existing) {
      sqlite.prepare(`UPDATE uncapped_schedule SET nationality = ? WHERE date = ?`).run(nationality, date)
    } else {
      sqlite.prepare(`INSERT INTO uncapped_schedule (date, nationality) VALUES (?, ?)`).run(date, nationality)
    }
    return c.json({ ok: true })
  },
)

uncappedRouter.delete('/schedule/:date', (c) => {
  sqlite.prepare(`DELETE FROM uncapped_schedule WHERE date = ?`).run(c.req.param('date'))
  return c.json({ ok: true })
})

uncappedRouter.delete('/schedule', (c) => {
  sqlite.prepare(`DELETE FROM uncapped_schedule`).run()
  return c.json({ ok: true })
})

// GET /api/uncapped-players/answers?nationality=X
uncappedRouter.get('/answers', (c) => {
  const nationality = c.req.query('nationality') ?? ''
  if (!nationality) return c.json({ error: 'nationality required' }, 400)
  return c.json(getCountryPlayers(nationality))
})

// POST /api/uncapped-players/verify — a guess qualifies when the footballer's
// nationality matches AND they never made a senior international appearance.
uncappedRouter.post(
  '/verify',
  zValidator('json', z.object({
    footballerName: z.string().min(1),
    footballerId: z.number().int().nullish(),
    nationality: z.string().min(1),
  })),
  async (c) => {
    const { footballerName, footballerId, nationality } = c.req.valid('json')

    const qualifies = (intlStints: { club: string; apps: number | null }[], nat: string | null | undefined) =>
      nationalitiesMatch(nat, nationality) && !hasSeniorCap(intlStints)

    type FailReason = 'wrong_nationality' | 'capped' | 'no_nationality'
    const seniorCapCount = (intl: { club: string; apps: number | null }[]) =>
      intl.filter((s) => isSeniorNationalTeam(s.club)).reduce((n, s) => n + (s.apps ?? 0), 0)
    function invalidJson(name: string, nat: string | null | undefined, intl: { club: string; apps: number | null }[] = []) {
      const hasNat = !!(nat && nat.trim())
      const natOk = nationalitiesMatch(nat, nationality)
      const reason: FailReason = !hasNat ? 'no_nationality' : !natOk ? 'wrong_nationality' : 'capped'
      return { valid: false as const, foundName: name, foundNationality: hasNat && !natOk ? nat : null, capCount: reason === 'capped' ? seniorCapCount(intl) : null, imported: false, reason }
    }

    const success = (f: { id: number; name: string; photo_url: string | null }, imported: boolean) => {
      const hint = hintClubFor(f.id)
      const row = sqlite.prepare(`SELECT position FROM footballers WHERE id = ?`).get(f.id) as { position: string | null } | undefined
      return c.json({ valid: true, footballer: { id: f.id, name: f.name, photo_url: f.photo_url }, position: row?.position ?? null, hintClub: hint.club, clubWikiUrl: hint.clubWikiUrl, apps: hint.apps, caps: topIntlCaps(f.id), years: hint.years, imported })
    }

    const intlOf = (id: number) =>
      sqlite.prepare(`SELECT club, apps FROM career_stints WHERE footballer_id = ? AND stint_type = 'international'`).all(id) as { club: string; apps: number | null }[]

    // Step 1: resolve footballer from DB
    let footballer: { id: number; name: string; wikipedia_url: string; photo_url: string | null; nationality: string | null } | undefined
    if (footballerId != null) {
      footballer = await db
        .select({ id: footballers.id, name: footballers.name, wikipedia_url: footballers.wikipedia_url, photo_url: footballers.photo_url, nationality: footballers.nationality })
        .from(footballers).where(eq(footballers.id, footballerId)).limit(1).then((r) => r[0])
    }
    if (!footballer) {
      footballer = await db
        .select({ id: footballers.id, name: footballers.name, wikipedia_url: footballers.wikipedia_url, photo_url: footballers.photo_url, nationality: footballers.nationality })
        .from(footballers)
        .where(sql`LOWER(normalize(${footballers.name})) = LOWER(normalize(${footballerName}))`)
        .limit(1).then((r) => r[0])
    }

    // Auto-scraping is disabled for this game: a guess is only validated against
    // footballers already in the database (no Wikipedia fetch/import).
    if (footballer) {
      const intl = intlOf(footballer.id)
      if (qualifies(intl, footballer.nationality)) return success(footballer, false)
      return c.json(invalidJson(footballer.name, footballer.nationality, intl))
    }

    return c.json({ valid: false, footballer: null, imported: false })
  },
)
