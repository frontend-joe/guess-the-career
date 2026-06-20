import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db, sqlite, normalizeName } from '../db/client.ts'
import { footballers, career_stints } from '../db/schema.ts'
import { CLUB_ALIASES, normalizeClubAlias, scrapeWikipedia, isRetired } from '../services/scraper.ts'

export const threeClubsRouter = new Hono()

// A trio qualifies if at least this many players turned out for all three clubs
// (the game still only asks the player to name 3, leaving some margin).
const MIN_SHARED = 4

// Build the full list of club name variants (canonical + all aliases + loan-prefix forms)
function getClubVariants(clubName: string): string[] {
  const canonical = normalizeClubAlias(clubName)
  const aliases = Object.entries(CLUB_ALIASES)
    .filter(([, v]) => v === canonical)
    .map(([k]) => k)
  const base = [canonical, ...aliases]
  // Loan stints are stored with a "→ " prefix — include those forms too
  return [...base, ...base.map(v => `→ ${v}`)]
}

function hasClub(stintClubs: string[], targetClub: string): boolean {
  const variants = getClubVariants(targetClub)
  return stintClubs.some(c => variants.includes(normalizeClubAlias(c)))
}

interface StintRow { footballer_id: number; club: string }

const reserveRe = /\s(B|C|II|III|IV|reserves?|under[- ]?\d+|u\d+|youth|academy)$/i

function clubWiki(name: string): string | null {
  const row = sqlite.prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`).get(name) as { wikipedia_url: string | null } | undefined
  return row?.wikipedia_url ?? null
}

// Order-independent trio key.
function trioKey(a: string, b: string, c: string): string {
  return [a, b, c].sort((x, y) => x.localeCompare(y)).join('|||')
}

// Find every trio of clubs with >= MIN_SHARED players who played for all three.
// Player-centric: each player contributes the C(k,3) combinations of their clubs,
// so the cost is Σ C(kᵢ,3) rather than O(clubs³).
function findValidTrios(stints: StintRow[]): [string, string, string, number][] {
  const playerClubs = new Map<number, Set<string>>()
  for (const { footballer_id, club } of stints) {
    const canonical = normalizeClubAlias(club)
    if (reserveRe.test(canonical.trim())) continue
    if (!playerClubs.has(footballer_id)) playerClubs.set(footballer_id, new Set())
    playerClubs.get(footballer_id)!.add(canonical)
  }

  const counts = new Map<string, number>()
  for (const set of playerClubs.values()) {
    if (set.size < 3) continue
    const clubs = [...set].sort((x, y) => x.localeCompare(y))
    for (let i = 0; i < clubs.length; i++) {
      for (let j = i + 1; j < clubs.length; j++) {
        for (let k = j + 1; k < clubs.length; k++) {
          const key = `${clubs[i]}|||${clubs[j]}|||${clubs[k]}`
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }
    }
  }

  const valid: [string, string, string, number][] = []
  for (const [key, count] of counts) {
    if (count < MIN_SHARED) continue
    const [a, b, c] = key.split('|||')
    valid.push([a, b, c, count])
  }
  return valid
}

// GET /api/three-clubs/session
threeClubsRouter.get('/session', async (c) => {
  const excludeParam = c.req.query('exclude') ?? ''
  const excluded = new Set(
    excludeParam ? excludeParam.split(',').map(p => p.trim()).filter(Boolean) : []
  )

  const stints = sqlite.prepare(
    `SELECT footballer_id, club FROM career_stints WHERE stint_type = 'senior'`
  ).all() as StintRow[]

  let validTrios = findValidTrios(stints)
  if (validTrios.length === 0) {
    return c.json({ error: 'No valid club trios found in database' }, 404)
  }

  // If any trios are enabled, restrict to those
  const enabledRows = sqlite.prepare(
    `SELECT club_a, club_b, club_c FROM three_clubs_enabled_trios`
  ).all() as { club_a: string; club_b: string; club_c: string }[]

  if (enabledRows.length > 0) {
    const enabledSet = new Set(enabledRows.map(r => trioKey(r.club_a, r.club_b, r.club_c)))
    const filtered = validTrios.filter(([a, b, c]) => enabledSet.has(trioKey(a, b, c)))
    if (filtered.length > 0) validTrios = filtered
  }

  let pool = validTrios.filter(([a, b, c]) => !excluded.has(trioKey(a, b, c)))
  if (pool.length === 0) pool = validTrios

  const [clubA, clubB, clubC] = pool[Math.floor(Math.random() * pool.length)]

  return c.json({
    clubA, clubAWikiUrl: clubWiki(clubA),
    clubB, clubBWikiUrl: clubWiki(clubB),
    clubC, clubCWikiUrl: clubWiki(clubC),
  })
})

// GET /api/three-clubs/admin/trios
threeClubsRouter.get('/admin/trios', (c) => {
  const stints = sqlite.prepare(
    `SELECT footballer_id, club FROM career_stints WHERE stint_type = 'senior'`
  ).all() as StintRow[]

  const validTrios = findValidTrios(stints)

  // Seed all trios as enabled on first visit (when table is empty)
  const existingCount = (sqlite.prepare(`SELECT COUNT(*) as n FROM three_clubs_enabled_trios`).get() as { n: number }).n
  if (existingCount === 0 && validTrios.length > 0) {
    const insert = sqlite.prepare(`INSERT OR IGNORE INTO three_clubs_enabled_trios (club_a, club_b, club_c) VALUES (?, ?, ?)`)
    const insertMany = sqlite.transaction((trios: [string, string, string][]) => {
      for (const [a, b, cc] of trios) insert.run(a, b, cc)
    })
    insertMany(validTrios.map(([a, b, cc]) => [a, b, cc]))
  }

  const enabledRows = sqlite.prepare(
    `SELECT club_a, club_b, club_c FROM three_clubs_enabled_trios`
  ).all() as { club_a: string; club_b: string; club_c: string }[]
  const enabledSet = new Set(enabledRows.map(r => trioKey(r.club_a, r.club_b, r.club_c)))

  const result = validTrios
    .sort((a, b) => b[3] - a[3])
    .map(([clubA, clubB, clubC, playerCount]) => ({
      clubA, clubAWikiUrl: clubWiki(clubA),
      clubB, clubBWikiUrl: clubWiki(clubB),
      clubC, clubCWikiUrl: clubWiki(clubC),
      playerCount,
      enabled: enabledSet.has(trioKey(clubA, clubB, clubC)),
    }))

  return c.json(result)
})

// POST /api/three-clubs/admin/trios/enable
threeClubsRouter.post(
  '/admin/trios/enable',
  zValidator('json', z.object({ clubA: z.string().min(1), clubB: z.string().min(1), clubC: z.string().min(1) })),
  async (c) => {
    const { clubA, clubB, clubC } = c.req.valid('json')
    const [a, b, cc] = [clubA, clubB, clubC].map(normalizeClubAlias).sort((x, y) => x.localeCompare(y))
    sqlite.prepare(
      `INSERT OR IGNORE INTO three_clubs_enabled_trios (club_a, club_b, club_c) VALUES (?, ?, ?)`
    ).run(a, b, cc)
    return c.json({ ok: true })
  }
)

// DELETE /api/three-clubs/admin/trios/enable
threeClubsRouter.delete(
  '/admin/trios/enable',
  zValidator('json', z.object({ clubA: z.string().min(1), clubB: z.string().min(1), clubC: z.string().min(1) })),
  async (c) => {
    const { clubA, clubB, clubC } = c.req.valid('json')
    const [a, b, cc] = [clubA, clubB, clubC].map(normalizeClubAlias).sort((x, y) => x.localeCompare(y))
    sqlite.prepare(
      `DELETE FROM three_clubs_enabled_trios WHERE club_a = ? AND club_b = ? AND club_c = ?`
    ).run(a, b, cc)
    return c.json({ ok: true })
  }
)

// GET /api/three-clubs/schedule — admin list
threeClubsRouter.get('/schedule', (c) => {
  const rows = sqlite.prepare(
    `SELECT id, date, club_a, club_b, club_c, created_at FROM three_clubs_schedule ORDER BY date ASC`
  ).all() as { id: number; date: string; club_a: string; club_b: string; club_c: string; created_at: string }[]
  return c.json(rows)
})

// GET /api/three-clubs/schedule/rounds — game data with wiki URLs and player counts
threeClubsRouter.get('/schedule/rounds', (c) => {
  const scheduled = sqlite.prepare(
    `SELECT date, club_a, club_b, club_c FROM three_clubs_schedule ORDER BY date ASC`
  ).all() as { date: string; club_a: string; club_b: string; club_c: string }[]

  if (scheduled.length === 0) return c.json([])

  const stints = sqlite.prepare(
    `SELECT footballer_id, club FROM career_stints WHERE stint_type = 'senior'`
  ).all() as StintRow[]
  const countMap = new Map<string, number>()
  for (const [a, b, cc, count] of findValidTrios(stints)) countMap.set(trioKey(a, b, cc), count)

  const rounds = scheduled.map(row => ({
    date: row.date,
    clubA: row.club_a, clubAWikiUrl: clubWiki(row.club_a),
    clubB: row.club_b, clubBWikiUrl: clubWiki(row.club_b),
    clubC: row.club_c, clubCWikiUrl: clubWiki(row.club_c),
    playerCount: countMap.get(trioKey(row.club_a, row.club_b, row.club_c)) ?? 0,
  }))

  return c.json(rounds)
})

// PUT /api/three-clubs/schedule/:date — assign a trio to a date
threeClubsRouter.put(
  '/schedule/:date',
  zValidator('json', z.object({ clubA: z.string().min(1), clubB: z.string().min(1), clubC: z.string().min(1) })),
  async (c) => {
    const date = c.req.param('date')
    const { clubA, clubB, clubC } = c.req.valid('json')
    const existing = sqlite.prepare(`SELECT id FROM three_clubs_schedule WHERE date = ?`).get(date)
    if (existing) {
      sqlite.prepare(`UPDATE three_clubs_schedule SET club_a = ?, club_b = ?, club_c = ? WHERE date = ?`).run(clubA, clubB, clubC, date)
    } else {
      sqlite.prepare(`INSERT INTO three_clubs_schedule (date, club_a, club_b, club_c) VALUES (?, ?, ?, ?)`).run(date, clubA, clubB, clubC)
    }
    return c.json({ ok: true })
  }
)

// DELETE /api/three-clubs/schedule/:date — remove a specific date
threeClubsRouter.delete('/schedule/:date', async (c) => {
  const date = c.req.param('date')
  sqlite.prepare(`DELETE FROM three_clubs_schedule WHERE date = ?`).run(date)
  return c.json({ ok: true })
})

// DELETE /api/three-clubs/schedule — clear entire schedule
threeClubsRouter.delete('/schedule', async (c) => {
  sqlite.prepare(`DELETE FROM three_clubs_schedule`).run()
  return c.json({ ok: true })
})

// POST /api/three-clubs/verify
threeClubsRouter.post(
  '/verify',
  zValidator('json', z.object({
    footballerName: z.string().min(1),
    footballerId: z.number().int().optional(),
    clubA: z.string().min(1),
    clubB: z.string().min(1),
    clubC: z.string().min(1),
  })),
  async (c) => {
    const { footballerName, footballerId, clubA, clubB, clubC } = c.req.valid('json')
    const playedAll = (clubs: string[]) => hasClub(clubs, clubA) && hasClub(clubs, clubB) && hasClub(clubs, clubC)

    // Step 1: resolve footballer from DB
    let footballer: { id: number; name: string; wikipedia_url: string; photo_url: string | null } | undefined

    if (footballerId != null) {
      footballer = await db.select({
        id: footballers.id,
        name: footballers.name,
        wikipedia_url: footballers.wikipedia_url,
        photo_url: footballers.photo_url,
      }).from(footballers).where(eq(footballers.id, footballerId)).limit(1).then(r => r[0])
    }

    if (!footballer) {
      const normalizedName = normalizeName(footballerName)
      footballer = await db.select({
        id: footballers.id,
        name: footballers.name,
        wikipedia_url: footballers.wikipedia_url,
        photo_url: footballers.photo_url,
      }).from(footballers)
        .where(sql`LOWER(normalize(${footballers.name})) = LOWER(normalize(${footballerName}))`)
        .limit(1)
        .then(r => r[0])

      if (!footballer) {
        footballer = await db.select({
          id: footballers.id,
          name: footballers.name,
          wikipedia_url: footballers.wikipedia_url,
          photo_url: footballers.photo_url,
        }).from(footballers)
          .where(sql`normalize(${footballers.name}) = ${normalizedName}`)
          .limit(1)
          .then(r => r[0])
      }
    }

    // Step 2: if footballer found, check stints
    if (footballer) {
      const stints = await db.select({ club: career_stints.club })
        .from(career_stints)
        .where(sql`${career_stints.footballer_id} = ${footballer.id} AND ${career_stints.stint_type} = 'senior'`)
      const stintClubs = stints.map(s => s.club)

      if (playedAll(stintClubs)) {
        return c.json({ valid: true, footballer: { id: footballer.id, name: footballer.name, photo_url: footballer.photo_url }, imported: false })
      }

      // Stints incomplete — rescrape if we have a Wikipedia URL
      if (footballer.wikipedia_url) {
        try {
          const scraped = await scrapeWikipedia(footballer.wikipedia_url)
          const seniorStints = scraped.stints.filter(s => s.stint_type === 'senior')

          for (const s of seniorStints) {
            const existing = sqlite.prepare(
              `SELECT id FROM career_stints WHERE footballer_id = ? AND years = ? AND club = ? AND stint_type = 'senior' LIMIT 1`
            ).get(footballer.id, s.years, s.club)
            if (!existing) {
              const maxOrder = sqlite.prepare(
                `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM career_stints WHERE footballer_id = ?`
              ).get(footballer.id) as { next: number }
              await db.insert(career_stints).values({
                footballer_id: footballer.id,
                sort_order: maxOrder.next,
                years: s.years,
                club: s.club,
                club_wikipedia_url: s.club_wikipedia_url ?? null,
                apps: s.apps ?? null,
                goals: s.goals ?? null,
                stint_type: 'senior',
              })
            }
          }

          const refreshed = await db.select({ club: career_stints.club })
            .from(career_stints)
            .where(sql`${career_stints.footballer_id} = ${footballer.id} AND ${career_stints.stint_type} = 'senior'`)
          if (playedAll(refreshed.map(s => s.club))) {
            return c.json({ valid: true, footballer: { id: footballer.id, name: footballer.name, photo_url: footballer.photo_url }, imported: true })
          }
        } catch {
          // scrape failed — fall through to Wikipedia name search
        }
      }
    }

    // Step 3: footballer not in DB at all — try Wikipedia name search
    try {
      const wikiHeaders = { 'User-Agent': 'GuessTheCareer-Admin/1.0' }
      const nameParts = normalizeName(footballerName).split(/\s+/).filter(p => p.length > 2)
      function titleMatchesName(title: string) {
        const t = normalizeName(title)
        return nameParts.length > 0 && nameParts.every(p => t.includes(p))
      }
      async function wikiSearch(query: string) {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`
        const res = await fetch(url, { headers: wikiHeaders })
        if (!res.ok) return null
        const data = await res.json() as { query?: { search?: { title: string }[] } }
        return data.query?.search?.[0] ?? null
      }

      let firstResult = await wikiSearch(footballerName + ' footballer')
      if (!firstResult || !titleMatchesName(firstResult.title)) {
        const r2 = await wikiSearch(footballerName + ' ' + clubA)
        if (r2 && titleMatchesName(r2.title)) firstResult = r2
      }
      if (!firstResult || !titleMatchesName(firstResult.title)) {
        const r3 = await wikiSearch(footballerName)
        if (r3 && titleMatchesName(r3.title)) firstResult = r3
      }
      if (!firstResult || !titleMatchesName(firstResult.title)) return c.json({ valid: false, footballer: null, imported: false })

      const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(firstResult.title.replace(/ /g, '_'))}`

      const byUrl = await db.select({ id: footballers.id, name: footballers.name, photo_url: footballers.photo_url })
        .from(footballers).where(eq(footballers.wikipedia_url, wikiUrl)).limit(1).then(r => r[0])

      if (byUrl) {
        const stints = await db.select({ club: career_stints.club })
          .from(career_stints)
          .where(sql`${career_stints.footballer_id} = ${byUrl.id} AND ${career_stints.stint_type} = 'senior'`)
        if (playedAll(stints.map(s => s.club))) {
          return c.json({ valid: true, footballer: { id: byUrl.id, name: byUrl.name, photo_url: byUrl.photo_url }, imported: false })
        }
      }

      await new Promise(r => setTimeout(r, 300))
      const scraped = await scrapeWikipedia(wikiUrl)
      const seniorStints = scraped.stints.filter(s => s.stint_type === 'senior')
      const stintClubs = seniorStints.map(s => s.club)

      if (!playedAll(stintClubs)) {
        return c.json({ valid: false, footballer: null, imported: false })
      }
      if (!isRetired(scraped.stints)) {
        return c.json({ valid: false, footballer: null, imported: false, reason: 'not_retired' as const })
      }

      const knownRecord = byUrl ?? footballer
      if (knownRecord) {
        if (!knownRecord.photo_url || footballer?.wikipedia_url === null) {
          sqlite.prepare(`UPDATE footballers SET wikipedia_url = ?, photo_url = COALESCE(photo_url, ?) WHERE id = ?`)
            .run(wikiUrl, scraped.photo_url ?? null, knownRecord.id)
        }
        for (const s of seniorStints) {
          const existing = sqlite.prepare(
            `SELECT id FROM career_stints WHERE footballer_id = ? AND years = ? AND club = ? AND stint_type = 'senior' LIMIT 1`
          ).get(knownRecord.id, s.years, s.club)
          if (!existing) {
            const maxOrder = sqlite.prepare(
              `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM career_stints WHERE footballer_id = ?`
            ).get(knownRecord.id) as { next: number }
            await db.insert(career_stints).values({
              footballer_id: knownRecord.id,
              sort_order: maxOrder.next,
              years: s.years,
              club: s.club,
              club_wikipedia_url: s.club_wikipedia_url ?? null,
              apps: s.apps ?? null,
              goals: s.goals ?? null,
              stint_type: 'senior',
            })
          }
        }
        return c.json({ valid: true, footballer: { id: knownRecord.id, name: knownRecord.name, photo_url: scraped.photo_url ?? knownRecord.photo_url }, imported: true })
      }

      // Truly new footballer — insert
      const [newFootballer] = await db.insert(footballers).values({
        name: scraped.name,
        wikipedia_url: scraped.wikipedia_url,
        nationality: scraped.nationality,
        position: scraped.position,
        all_positions: scraped.all_positions ?? null,
        born: scraped.born,
        photo_url: scraped.photo_url ?? null,
      }).returning()

      if (seniorStints.length > 0) {
        await db.insert(career_stints).values(
          seniorStints.map((s, i) => ({
            footballer_id: newFootballer.id,
            sort_order: i,
            years: s.years,
            club: s.club,
            club_wikipedia_url: s.club_wikipedia_url ?? null,
            apps: s.apps ?? null,
            goals: s.goals ?? null,
            stint_type: 'senior' as const,
          }))
        )
      }

      return c.json({ valid: true, footballer: { id: newFootballer.id, name: newFootballer.name, photo_url: newFootballer.photo_url ?? null }, imported: true })
    } catch {
      return c.json({ valid: false, footballer: null, imported: false })
    }
  }
)

// GET /api/three-clubs/answers?clubA=X&clubB=Y&clubC=Z
threeClubsRouter.get('/answers', async (c) => {
  const clubA = c.req.query('clubA') ?? ''
  const clubB = c.req.query('clubB') ?? ''
  const clubC = c.req.query('clubC') ?? ''
  if (!clubA || !clubB || !clubC) return c.json({ error: 'clubA, clubB and clubC required' }, 400)

  const variantsA = getClubVariants(clubA).map(v => v.toLowerCase())
  const variantsB = getClubVariants(clubB).map(v => v.toLowerCase())
  const variantsC = getClubVariants(clubC).map(v => v.toLowerCase())
  const allVariants = [...new Set([...variantsA, ...variantsB, ...variantsC])]

  const phA = variantsA.map(() => '?').join(', ')
  const phB = variantsB.map(() => '?').join(', ')
  const phC = variantsC.map(() => '?').join(', ')
  const phAll = allVariants.map(() => '?').join(', ')

  // apps = combined senior appearances across the target clubs (used to pick the
  // top players to hint). Ordered apps desc so the client can hint the top ones.
  const rows = sqlite.prepare(`
    SELECT f.id, f.name, f.photo_url, f.nationality, f.position,
      (SELECT COALESCE(SUM(cs.apps), 0) FROM career_stints cs
         WHERE cs.footballer_id = f.id AND cs.stint_type = 'senior'
         AND LOWER(cs.club) IN (${phAll})) AS apps
    FROM footballers f
    JOIN career_stints csa ON csa.footballer_id = f.id
      AND csa.stint_type = 'senior'
      AND LOWER(csa.club) IN (${phA})
    JOIN career_stints csb ON csb.footballer_id = f.id
      AND csb.stint_type = 'senior'
      AND LOWER(csb.club) IN (${phB})
    JOIN career_stints csc ON csc.footballer_id = f.id
      AND csc.stint_type = 'senior'
      AND LOWER(csc.club) IN (${phC})
    GROUP BY f.id
    ORDER BY apps DESC, f.name ASC
  `).all(...allVariants, ...variantsA, ...variantsB, ...variantsC) as { id: number; name: string; photo_url: string | null; nationality: string | null; position: string | null; apps: number }[]

  return c.json(rows)
})
