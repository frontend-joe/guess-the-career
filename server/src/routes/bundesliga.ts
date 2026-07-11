import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db, sqlite, normalizeName } from '../db/client.ts'
import { footballers, career_stints } from '../db/schema.ts'
import { scrapeWikipedia, normalizeClubAlias } from '../services/scraper.ts'
import {
  nationalitiesMatch,
  isGermanClub,
  isGermany,
  reserveRe,
} from '../services/football.ts'
import { clubWikiUrl } from "../services/clubs.ts";

export const bundesligaRouter = new Hono()

const MIN_PLAYERS = 3


// The German club a player made the most senior appearances for (the hint),
// plus their total appearances across German clubs.
function hintClubFor(footballerId: number): { club: string | null; clubWikiUrl: string | null; apps: number } {
  const stints = sqlite
    .prepare(`SELECT club, apps FROM career_stints WHERE footballer_id = ? AND stint_type = 'senior'`)
    .all(footballerId) as { club: string; apps: number | null }[]
  const byClub = new Map<string, number>()
  let total = 0
  for (const s of stints) {
    if (!isGermanClub(s.club)) continue
    const key = normalizeClubAlias(s.club)
    byClub.set(key, (byClub.get(key) ?? 0) + (s.apps ?? 0))
    total += s.apps ?? 0
  }
  let best: string | null = null
  let bestApps = -1
  for (const [club, apps] of byClub) {
    if (apps > bestApps) { bestApps = apps; best = club }
  }
  return { club: best, clubWikiUrl: best ? clubWikiUrl(best) : null, apps: total }
}

interface NatStintRow { nationality: string | null; footballer_id: number; club: string }

// [nationality, playerCount] for foreign countries (not Germany) with >= MIN
// players who have a senior stint at an German club.
function findValidCountries(): [string, number][] {
  const rows = sqlite
    .prepare(
      `SELECT f.nationality, cs.footballer_id, cs.club
       FROM footballers f
       JOIN career_stints cs ON cs.footballer_id = f.id
       WHERE cs.stint_type = 'senior' AND f.nationality IS NOT NULL AND f.nationality != ''`,
    )
    .all() as NatStintRow[]

  const natPlayers = new Map<string, Set<number>>()
  for (const { nationality, footballer_id, club } of rows) {
    if (!nationality) continue
    const nat = nationality.trim()
    if (isGermany(nat)) continue
    if (reserveRe.test(normalizeClubAlias(club).trim())) continue
    if (!isGermanClub(club)) continue
    if (!natPlayers.has(nat)) natPlayers.set(nat, new Set())
    natPlayers.get(nat)!.add(footballer_id)
  }

  const valid: [string, number][] = []
  for (const [nat, players] of natPlayers) {
    if (players.size >= MIN_PLAYERS) valid.push([nat, players.size])
  }
  return valid
}

interface BundesligaPlayer {
  id: number
  name: string
  photo_url: string | null
  apps: number
  position: string | null
  hintClub: string | null
  clubWikiUrl: string | null
  years: string | null
}

// Combine a player's stint "years" strings for one club into a single span,
// e.g. "2004–2009|2011" -> "2004–2011".
function yearsSpan(raw: string[]): string | null {
  const nums = raw.join('|').match(/\d{4}/g)
  if (!nums || nums.length === 0) return null
  const years = nums.map(Number)
  const min = Math.min(...years)
  const max = Math.max(...years)
  return min === max ? String(min) : `${min}–${max}`
}

// All foreign players of a nationality who played for an German club, with the
// hint club (most German appearances).
function getCountryPlayers(nationality: string): BundesligaPlayer[] {
  const rows = sqlite
    .prepare(
      `SELECT f.id, f.name, f.photo_url, f.position, cs.club, cs.apps, cs.years
       FROM footballers f
       JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
       WHERE LOWER(f.nationality) = LOWER(?)`,
    )
    .all(nationality) as {
    id: number; name: string; photo_url: string | null; position: string | null; club: string; apps: number | null; years: string | null
  }[]

  // group by player → spanish apps + years per club
  const players = new Map<number, { name: string; photo_url: string | null; position: string | null; byClub: Map<string, number>; yearsByClub: Map<string, string[]> }>()
  for (const r of rows) {
    if (!isGermanClub(r.club)) continue
    if (!players.has(r.id)) players.set(r.id, { name: r.name, photo_url: r.photo_url, position: r.position, byClub: new Map(), yearsByClub: new Map() })
    const p = players.get(r.id)!
    const key = normalizeClubAlias(r.club)
    p.byClub.set(key, (p.byClub.get(key) ?? 0) + (r.apps ?? 0))
    if (r.years) {
      const arr = p.yearsByClub.get(key) ?? []
      arr.push(r.years)
      p.yearsByClub.set(key, arr)
    }
  }

  const out: BundesligaPlayer[] = []
  for (const [id, p] of players) {
    let best: string | null = null
    let bestApps = -1
    let total = 0
    for (const [club, apps] of p.byClub) {
      total += apps
      if (apps > bestApps) { bestApps = apps; best = club }
    }
    out.push({
      id, name: p.name, photo_url: p.photo_url, apps: total, position: p.position,
      hintClub: best, clubWikiUrl: best ? clubWikiUrl(best) : null,
      years: best ? yearsSpan(p.yearsByClub.get(best) ?? []) : null,
    })
  }
  out.sort((a, b) => b.apps - a.apps || a.name.localeCompare(b.name))
  return out
}

// ── Admin ───────────────────────────────────────────────────────────────────
// GET /api/bundesliga/admin/countries
bundesligaRouter.get('/admin/countries', (c) => {
  const valid = findValidCountries().sort((a, b) => b[1] - a[1])
  const enabled = sqlite
    .prepare(`SELECT nationality, round_size FROM bundesliga_enabled_countries`)
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

// GET /api/bundesliga/admin/countries/:nationality/players
bundesligaRouter.get('/admin/countries/:nationality/players', (c) => {
  return c.json(getCountryPlayers(c.req.param('nationality')))
})

// POST /api/bundesliga/admin/countries/enable { nationality, roundSize }
bundesligaRouter.post(
  '/admin/countries/enable',
  zValidator('json', z.object({ nationality: z.string().min(1), roundSize: z.number().int().optional() })),
  (c) => {
    const { nationality, roundSize } = c.req.valid('json')
    const size = roundSize && roundSize > 0 ? Math.floor(roundSize) : 5
    sqlite
      .prepare(
        `INSERT INTO bundesliga_enabled_countries (nationality, round_size) VALUES (?, ?)
         ON CONFLICT(nationality) DO UPDATE SET round_size = excluded.round_size`,
      )
      .run(nationality, size)
    return c.json({ ok: true })
  },
)

// DELETE /api/bundesliga/admin/countries/enable { nationality }
bundesligaRouter.delete(
  '/admin/countries/enable',
  zValidator('json', z.object({ nationality: z.string().min(1) })),
  (c) => {
    sqlite
      .prepare(`DELETE FROM bundesliga_enabled_countries WHERE LOWER(nationality) = LOWER(?)`)
      .run(c.req.valid('json').nationality)
    return c.json({ ok: true })
  },
)

// ── Schedule ────────────────────────────────────────────────────────────────
bundesligaRouter.get('/schedule', (c) => {
  const rows = sqlite
    .prepare(`SELECT id, date, nationality, created_at FROM bundesliga_schedule ORDER BY date ASC`)
    .all()
  return c.json(rows)
})

// GET /api/bundesliga/schedule/rounds — playable rounds
bundesligaRouter.get('/schedule/rounds', (c) => {
  const scheduled = sqlite
    .prepare(`SELECT date, nationality FROM bundesliga_schedule ORDER BY date ASC`)
    .all() as { date: string; nationality: string }[]
  if (scheduled.length === 0) return c.json([])

  const countMap = new Map<string, number>()
  for (const [nat, count] of findValidCountries()) countMap.set(nat, count)
  const sizeRows = sqlite
    .prepare(`SELECT nationality, round_size FROM bundesliga_enabled_countries`)
    .all() as { nationality: string; round_size: number }[]
  const sizeMap = new Map(sizeRows.map((r) => [r.nationality, r.round_size]))

  const rounds = scheduled.map((row) => ({
    date: row.date,
    nationality: row.nationality,
    roundSize: sizeMap.get(row.nationality) ?? 5,
    playerCount: countMap.get(row.nationality) ?? 0,
  }))
  return c.json(rounds)
})

bundesligaRouter.put(
  '/schedule/:date',
  zValidator('json', z.object({ nationality: z.string().min(1) })),
  (c) => {
    const date = c.req.param('date')
    const { nationality } = c.req.valid('json')
    const existing = sqlite.prepare(`SELECT id FROM bundesliga_schedule WHERE date = ?`).get(date)
    if (existing) {
      sqlite.prepare(`UPDATE bundesliga_schedule SET nationality = ? WHERE date = ?`).run(nationality, date)
    } else {
      sqlite.prepare(`INSERT INTO bundesliga_schedule (date, nationality) VALUES (?, ?)`).run(date, nationality)
    }
    return c.json({ ok: true })
  },
)

bundesligaRouter.delete('/schedule/:date', (c) => {
  sqlite.prepare(`DELETE FROM bundesliga_schedule WHERE date = ?`).run(c.req.param('date'))
  return c.json({ ok: true })
})

bundesligaRouter.delete('/schedule', (c) => {
  sqlite.prepare(`DELETE FROM bundesliga_schedule`).run()
  return c.json({ ok: true })
})

// GET /api/bundesliga/answers?nationality=X
bundesligaRouter.get('/answers', (c) => {
  const nationality = c.req.query('nationality') ?? ''
  if (!nationality) return c.json({ error: 'nationality required' }, 400)
  return c.json(getCountryPlayers(nationality))
})

// POST /api/bundesliga/verify — a guess qualifies when the footballer's
// nationality matches the country AND they played for an German club.
bundesligaRouter.post(
  '/verify',
  zValidator('json', z.object({
    footballerName: z.string().min(1),
    footballerId: z.number().int().nullish(),
    nationality: z.string().min(1),
  })),
  async (c) => {
    const { footballerName, footballerId, nationality } = c.req.valid('json')

    const qualifies = (stintClubs: string[], nat: string | null | undefined) =>
      nationalitiesMatch(nat, nationality) && stintClubs.some(isGermanClub)

    type FailReason = 'wrong_nationality' | 'wrong_club' | 'wrong_both'
    function invalidJson(name: string, nat: string | null | undefined, stintClubs: string[]) {
      const natOk = nationalitiesMatch(nat, nationality)
      const clubOk = stintClubs.some(isGermanClub)
      const reason: FailReason = !natOk && !clubOk ? 'wrong_both' : !natOk ? 'wrong_nationality' : 'wrong_club'
      return { valid: false as const, foundName: name, foundNationality: !natOk ? (nat ?? null) : null, imported: false, reason }
    }

    const success = (f: { id: number; name: string; photo_url: string | null }, imported: boolean) => {
      const hint = hintClubFor(f.id)
      const row = sqlite.prepare(`SELECT position FROM footballers WHERE id = ?`).get(f.id) as { position: string | null } | undefined
      return c.json({ valid: true, footballer: { id: f.id, name: f.name, photo_url: f.photo_url }, position: row?.position ?? null, hintClub: hint.club, clubWikiUrl: hint.clubWikiUrl, apps: hint.apps, imported })
    }

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

    if (footballer) {
      const stints = await db
        .select({ club: career_stints.club })
        .from(career_stints)
        .where(sql`${career_stints.footballer_id} = ${footballer.id} AND ${career_stints.stint_type} = 'senior'`)
      const stintClubs = stints.map((s) => s.club)
      if (qualifies(stintClubs, footballer.nationality)) return success(footballer, false)

      // Stints may be stale — rescrape and re-check
      if (footballer.wikipedia_url) {
        try {
          const scraped = await scrapeWikipedia(footballer.wikipedia_url)
          const seniors = scraped.stints.filter((s) => s.stint_type === 'senior')
          for (const s of seniors) {
            const exists = sqlite.prepare(`SELECT id FROM career_stints WHERE footballer_id = ? AND years = ? AND club = ? AND stint_type = 'senior' LIMIT 1`).get(footballer.id, s.years, s.club)
            if (!exists) {
              const maxOrder = sqlite.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM career_stints WHERE footballer_id = ?`).get(footballer.id) as { next: number }
              await db.insert(career_stints).values({ footballer_id: footballer.id, sort_order: maxOrder.next, years: s.years, club: s.club, club_wikipedia_url: s.club_wikipedia_url ?? null, apps: s.apps ?? null, goals: s.goals ?? null, stint_type: 'senior' })
            }
          }
          const refreshed = sqlite.prepare(`SELECT club FROM career_stints WHERE footballer_id = ? AND stint_type = 'senior'`).all(footballer.id) as { club: string }[]
          if (qualifies(refreshed.map((s) => s.club), scraped.nationality ?? footballer.nationality)) return success(footballer, true)
        } catch { /* fall through */ }
      }
    }

    // Step 3: Wikipedia name search → import
    try {
      const wikiHeaders = { 'User-Agent': 'GuessTheCareer-Admin/1.0' }
      const strip = normalizeName
      const nameParts = strip(footballerName).split(/\s+/).filter((p) => p.length > 2)
      const titleMatches = (title: string) => nameParts.length > 0 && nameParts.every((p) => strip(title).includes(p))
      async function wikiSearch(query: string): Promise<string[]> {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`
        const res = await fetch(url, { headers: wikiHeaders })
        if (!res.ok) return []
        const data = (await res.json()) as { query?: { search?: { title: string }[] } }
        return (data.query?.search ?? []).map((s) => s.title)
      }

      const titles: string[] = []
      for (const q of [`${footballerName} footballer`, `${footballerName} ${nationality}`, footballerName]) {
        for (const title of await wikiSearch(q)) if (titleMatches(title) && !titles.includes(title)) titles.push(title)
      }
      if (titles.length === 0) return c.json({ valid: false, footballer: null, imported: false })

      let fallbackInvalid: ReturnType<typeof invalidJson> | null = null
      for (const title of titles.slice(0, 6)) {
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
        const byUrl = await db
          .select({ id: footballers.id, name: footballers.name, photo_url: footballers.photo_url, nationality: footballers.nationality })
          .from(footballers).where(eq(footballers.wikipedia_url, wikiUrl)).limit(1).then((r) => r[0])
        if (byUrl) {
          const stints = sqlite.prepare(`SELECT club FROM career_stints WHERE footballer_id = ? AND stint_type = 'senior'`).all(byUrl.id) as { club: string }[]
          if (qualifies(stints.map((s) => s.club), byUrl.nationality)) return success(byUrl, false)
        }
        await new Promise((r) => setTimeout(r, 300))
        let scraped
        try { scraped = await scrapeWikipedia(wikiUrl) } catch { continue }
        const seniors = scraped.stints.filter((s) => s.stint_type === 'senior')
        const stintClubs = seniors.map((s) => s.club)
        if (!qualifies(stintClubs, scraped.nationality)) {
          fallbackInvalid ??= invalidJson(scraped.name, scraped.nationality, stintClubs)
          continue
        }

        const knownRecord = byUrl ?? footballer
        if (knownRecord) {
          sqlite.prepare(`UPDATE footballers SET wikipedia_url = ?, photo_url = COALESCE(photo_url, ?), nationality = COALESCE(nationality, ?) WHERE id = ?`)
            .run(wikiUrl, scraped.photo_url ?? null, scraped.nationality ?? null, knownRecord.id)
          for (const s of seniors) {
            const exists = sqlite.prepare(`SELECT id FROM career_stints WHERE footballer_id = ? AND years = ? AND club = ? AND stint_type = 'senior' LIMIT 1`).get(knownRecord.id, s.years, s.club)
            if (!exists) {
              const maxOrder = sqlite.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM career_stints WHERE footballer_id = ?`).get(knownRecord.id) as { next: number }
              await db.insert(career_stints).values({ footballer_id: knownRecord.id, sort_order: maxOrder.next, years: s.years, club: s.club, club_wikipedia_url: s.club_wikipedia_url ?? null, apps: s.apps ?? null, goals: s.goals ?? null, stint_type: 'senior' })
            }
          }
          return success({ id: knownRecord.id, name: knownRecord.name, photo_url: scraped.photo_url ?? knownRecord.photo_url }, true)
        }

        const [created] = await db.insert(footballers).values({
          name: scraped.name, wikipedia_url: scraped.wikipedia_url, nationality: scraped.nationality,
          position: scraped.position, all_positions: scraped.all_positions ?? null, born: scraped.born, photo_url: scraped.photo_url ?? null,
        }).returning()
        if (seniors.length > 0) {
          await db.insert(career_stints).values(seniors.map((s, i) => ({
            footballer_id: created.id, sort_order: i, years: s.years, club: s.club,
            club_wikipedia_url: s.club_wikipedia_url ?? null, apps: s.apps ?? null, goals: s.goals ?? null, stint_type: 'senior' as const,
          })))
        }
        return success({ id: created.id, name: created.name, photo_url: created.photo_url ?? null }, true)
      }
      return c.json(fallbackInvalid ?? { valid: false, footballer: null, imported: false })
    } catch {
      return c.json({ valid: false, footballer: null, imported: false })
    }
  },
)
