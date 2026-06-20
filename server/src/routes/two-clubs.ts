import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db, sqlite, normalizeName } from '../db/client.ts'
import { footballers, career_stints } from '../db/schema.ts'
import { CLUB_ALIASES, normalizeClubAlias, scrapeWikipedia, isRetired } from '../services/scraper.ts'
import { CAREER_SPAN_SELECT, formatCareerYears } from '../services/football.ts'

export const twoClubsRouter = new Hono()

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

function buildClubMap(stints: StintRow[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>()
  for (const { footballer_id, club } of stints) {
    const canonical = normalizeClubAlias(club)
    if (!map.has(canonical)) map.set(canonical, new Set())
    map.get(canonical)!.add(footballer_id)
  }
  return map
}

const reserveRe = /\s(B|C|II|III|IV|reserves?|under[- ]?\d+|u\d+|youth|academy)$/i

function findValidPairs(stints: StintRow[]): [string, string, number][] {
  const clubMap = buildClubMap(stints)
  const clubNames = [...clubMap.keys()].filter(name => !reserveRe.test(name.trim()))

  const validPairs: [string, string, number][] = []
  for (let i = 0; i < clubNames.length; i++) {
    for (let j = i + 1; j < clubNames.length; j++) {
      const a = clubNames[i], b = clubNames[j]
      const setA = clubMap.get(a)!
      const setB = clubMap.get(b)!
      let shared = 0
      for (const id of setA) { if (setB.has(id)) shared++ }
      if (shared >= 5) validPairs.push([a, b, shared])
    }
  }
  return validPairs
}

// GET /api/two-clubs/session
twoClubsRouter.get('/session', async (c) => {
  const excludeParam = c.req.query('exclude') ?? ''
  const excludedPairs = new Set(
    excludeParam ? excludeParam.split(',').map(p => p.trim()).filter(Boolean) : []
  )

  const stints = sqlite.prepare(
    `SELECT footballer_id, club FROM career_stints WHERE stint_type = 'senior'`
  ).all() as StintRow[]

  let validPairs = findValidPairs(stints)

  if (validPairs.length === 0) {
    return c.json({ error: 'No valid club pairs found in database' }, 404)
  }

  // If any pairs are enabled, restrict to those
  const enabledRows = sqlite.prepare(
    `SELECT club_a, club_b FROM two_clubs_enabled_pairs`
  ).all() as { club_a: string; club_b: string }[]

  if (enabledRows.length > 0) {
    const enabledSet = new Set(enabledRows.map(r => `${r.club_a}|||${r.club_b}`))
    const filtered = validPairs.filter(([a, b]) => enabledSet.has(`${a}|||${b}`) || enabledSet.has(`${b}|||${a}`))
    if (filtered.length > 0) validPairs = filtered
  }

  // Filter out excluded pairs, fall back to all if exhausted
  const pairKey = (a: string, b: string) => `${a}|||${b}`
  let pool = validPairs.filter(([a, b]) => !excludedPairs.has(pairKey(a, b)) && !excludedPairs.has(pairKey(b, a)))
  if (pool.length === 0) pool = validPairs

  const [clubA, clubB] = pool[Math.floor(Math.random() * pool.length)]

  const clubARow = sqlite.prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`).get(clubA) as { wikipedia_url: string | null } | undefined
  const clubBRow = sqlite.prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`).get(clubB) as { wikipedia_url: string | null } | undefined

  return c.json({
    clubA,
    clubAWikiUrl: clubARow?.wikipedia_url ?? null,
    clubB,
    clubBWikiUrl: clubBRow?.wikipedia_url ?? null,
  })
})

// GET /api/two-clubs/admin/pairs
twoClubsRouter.get('/admin/pairs', (c) => {
  const stints = sqlite.prepare(
    `SELECT footballer_id, club FROM career_stints WHERE stint_type = 'senior'`
  ).all() as StintRow[]

  const validPairs = findValidPairs(stints)

  // Seed all pairs as enabled on first visit (when table is empty)
  const existingCount = (sqlite.prepare(`SELECT COUNT(*) as n FROM two_clubs_enabled_pairs`).get() as { n: number }).n
  if (existingCount === 0 && validPairs.length > 0) {
    const insert = sqlite.prepare(`INSERT OR IGNORE INTO two_clubs_enabled_pairs (club_a, club_b) VALUES (?, ?)`)
    const insertMany = sqlite.transaction((pairs: [string, string][]) => {
      for (const [a, b] of pairs) insert.run(a, b)
    })
    insertMany(validPairs.map(([a, b]) => [a, b]))
  }

  const enabledRows = sqlite.prepare(
    `SELECT club_a, club_b FROM two_clubs_enabled_pairs`
  ).all() as { club_a: string; club_b: string }[]
  const enabledSet = new Set(enabledRows.map(r => `${r.club_a}|||${r.club_b}`))

  const result = validPairs
    .sort((a, b) => b[2] - a[2])
    .map(([clubA, clubB, playerCount]) => {
      const clubARow = sqlite.prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`).get(clubA) as { wikipedia_url: string | null } | undefined
      const clubBRow = sqlite.prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`).get(clubB) as { wikipedia_url: string | null } | undefined
      const enabled = enabledSet.has(`${clubA}|||${clubB}`) || enabledSet.has(`${clubB}|||${clubA}`)
      return {
        clubA,
        clubAWikiUrl: clubARow?.wikipedia_url ?? null,
        clubB,
        clubBWikiUrl: clubBRow?.wikipedia_url ?? null,
        playerCount,
        enabled,
      }
    })

  return c.json(result)
})

// POST /api/two-clubs/admin/pairs/enable
twoClubsRouter.post(
  '/admin/pairs/enable',
  zValidator('json', z.object({ clubA: z.string().min(1), clubB: z.string().min(1) })),
  async (c) => {
    const { clubA, clubB } = c.req.valid('json')
    const a = normalizeClubAlias(clubA)
    const b = normalizeClubAlias(clubB)
    sqlite.prepare(
      `INSERT OR IGNORE INTO two_clubs_enabled_pairs (club_a, club_b) VALUES (?, ?)`
    ).run(a, b)
    return c.json({ ok: true })
  }
)

// DELETE /api/two-clubs/admin/pairs/enable
twoClubsRouter.delete(
  '/admin/pairs/enable',
  zValidator('json', z.object({ clubA: z.string().min(1), clubB: z.string().min(1) })),
  async (c) => {
    const { clubA, clubB } = c.req.valid('json')
    const a = normalizeClubAlias(clubA)
    const b = normalizeClubAlias(clubB)
    sqlite.prepare(
      `DELETE FROM two_clubs_enabled_pairs WHERE (club_a = ? AND club_b = ?) OR (club_a = ? AND club_b = ?)`
    ).run(a, b, b, a)
    return c.json({ ok: true })
  }
)

// GET /api/two-clubs/schedule — admin list
twoClubsRouter.get('/schedule', (c) => {
  const rows = sqlite.prepare(
    `SELECT id, date, club_a, club_b, created_at FROM two_clubs_schedule ORDER BY date ASC`
  ).all() as { id: number; date: string; club_a: string; club_b: string; created_at: string }[]
  return c.json(rows)
})

// GET /api/two-clubs/schedule/rounds — game data with wiki URLs and player counts
twoClubsRouter.get('/schedule/rounds', (c) => {
  const scheduled = sqlite.prepare(
    `SELECT date, club_a, club_b FROM two_clubs_schedule ORDER BY date ASC`
  ).all() as { date: string; club_a: string; club_b: string }[]

  if (scheduled.length === 0) return c.json([])

  // Compute player counts using the pair map
  const stints = sqlite.prepare(
    `SELECT footballer_id, club FROM career_stints WHERE stint_type = 'senior'`
  ).all() as StintRow[]
  const validPairs = findValidPairs(stints)
  const countMap = new Map<string, number>()
  for (const [a, b, count] of validPairs) {
    countMap.set(`${a}|||${b}`, count)
    countMap.set(`${b}|||${a}`, count)
  }

  const rounds = scheduled.map(row => {
    const clubARow = sqlite.prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`).get(row.club_a) as { wikipedia_url: string | null } | undefined
    const clubBRow = sqlite.prepare(`SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`).get(row.club_b) as { wikipedia_url: string | null } | undefined
    const playerCount = countMap.get(`${row.club_a}|||${row.club_b}`) ?? countMap.get(`${row.club_b}|||${row.club_a}`) ?? 0
    return {
      date: row.date,
      clubA: row.club_a,
      clubAWikiUrl: clubARow?.wikipedia_url ?? null,
      clubB: row.club_b,
      clubBWikiUrl: clubBRow?.wikipedia_url ?? null,
      playerCount,
    }
  })

  return c.json(rounds)
})

// PUT /api/two-clubs/schedule/:date — assign a pair to a date
twoClubsRouter.put(
  '/schedule/:date',
  zValidator('json', z.object({ clubA: z.string().min(1), clubB: z.string().min(1) })),
  async (c) => {
    const date = c.req.param('date')
    const { clubA, clubB } = c.req.valid('json')
    const existing = sqlite.prepare(`SELECT id FROM two_clubs_schedule WHERE date = ?`).get(date)
    if (existing) {
      sqlite.prepare(`UPDATE two_clubs_schedule SET club_a = ?, club_b = ? WHERE date = ?`).run(clubA, clubB, date)
    } else {
      sqlite.prepare(`INSERT INTO two_clubs_schedule (date, club_a, club_b) VALUES (?, ?, ?)`).run(date, clubA, clubB)
    }
    return c.json({ ok: true })
  }
)

// DELETE /api/two-clubs/schedule/:date — remove a specific date
twoClubsRouter.delete('/schedule/:date', async (c) => {
  const date = c.req.param('date')
  sqlite.prepare(`DELETE FROM two_clubs_schedule WHERE date = ?`).run(date)
  return c.json({ ok: true })
})

// DELETE /api/two-clubs/schedule — clear entire schedule
twoClubsRouter.delete('/schedule', async (c) => {
  sqlite.prepare(`DELETE FROM two_clubs_schedule`).run()
  return c.json({ ok: true })
})

// POST /api/two-clubs/verify
twoClubsRouter.post(
  '/verify',
  zValidator('json', z.object({
    footballerName: z.string().min(1),
    footballerId: z.number().int().optional(),
    clubA: z.string().min(1),
    clubB: z.string().min(1),
  })),
  async (c) => {
    const { footballerName, footballerId, clubA, clubB } = c.req.valid('json')

    // Which of the target clubs did the player NOT play for — used to build a
    // specific "didn't play for X" message.
    const targetClubs = [clubA, clubB]
    const missingClubsFor = (clubs: string[]) => targetClubs.filter(t => !hasClub(clubs, t))
    const invalidJson = (name: string, clubs: string[]) => ({
      valid: false as const,
      footballer: null,
      imported: false,
      foundName: name,
      missingClubs: missingClubsFor(clubs),
      reason: 'wrong_club' as const,
    })
    // Holds the most relevant failure (a real player who's missing some clubs).
    let fallbackInvalid: ReturnType<typeof invalidJson> | null = null

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
      let stintClubs = (await db.select({ club: career_stints.club })
        .from(career_stints)
        .where(sql`${career_stints.footballer_id} = ${footballer.id} AND ${career_stints.stint_type} = 'senior'`)).map(s => s.club)

      if (hasClub(stintClubs, clubA) && hasClub(stintClubs, clubB)) {
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

          stintClubs = (await db.select({ club: career_stints.club })
            .from(career_stints)
            .where(sql`${career_stints.footballer_id} = ${footballer.id} AND ${career_stints.stint_type} = 'senior'`)).map(s => s.club)

          if (hasClub(stintClubs, clubA) && hasClub(stintClubs, clubB)) {
            return c.json({ valid: true, footballer: { id: footballer.id, name: footballer.name, photo_url: footballer.photo_url }, imported: true })
          }
        } catch {
          // scrape failed — fall through to Wikipedia name search
        }
      }

      // A real player who's missing some of the clubs. If they played at least
      // one of them it's almost certainly the right person — report exactly which
      // clubs they're missing. Otherwise keep it as a fallback and try a namesake.
      fallbackInvalid = invalidJson(footballer.name, stintClubs)
      if (missingClubsFor(stintClubs).length < targetClubs.length) {
        return c.json(fallbackInvalid)
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
      if (!firstResult || !titleMatchesName(firstResult.title)) return c.json(fallbackInvalid ?? { valid: false, footballer: null, imported: false })

      const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(firstResult.title.replace(/ /g, '_'))}`

      // Check if already in DB by URL (may differ from footballer found by name if wikipedia_url was null)
      const byUrl = await db.select({ id: footballers.id, name: footballers.name, photo_url: footballers.photo_url })
        .from(footballers).where(eq(footballers.wikipedia_url, wikiUrl)).limit(1).then(r => r[0])

      if (byUrl) {
        const stints = await db.select({ club: career_stints.club })
          .from(career_stints)
          .where(sql`${career_stints.footballer_id} = ${byUrl.id} AND ${career_stints.stint_type} = 'senior'`)
        const stintClubs = stints.map(s => s.club)
        if (hasClub(stintClubs, clubA) && hasClub(stintClubs, clubB)) {
          return c.json({ valid: true, footballer: { id: byUrl.id, name: byUrl.name, photo_url: byUrl.photo_url }, imported: false })
        }
      }

      await new Promise(r => setTimeout(r, 300))
      const scraped = await scrapeWikipedia(wikiUrl)
      const seniorStints = scraped.stints.filter(s => s.stint_type === 'senior')
      const stintClubs = seniorStints.map(s => s.club)

      if (!hasClub(stintClubs, clubA) || !hasClub(stintClubs, clubB)) {
        return c.json(fallbackInvalid ?? invalidJson(scraped.name, stintClubs))
      }
      if (!isRetired(scraped.stints)) {
        return c.json({ valid: false, footballer: null, imported: false, foundName: scraped.name, reason: 'not_retired' as const })
      }

      // If we already have a record for this footballer (found by name in Step 2 or by URL above),
      // update their stints and wikipedia_url rather than inserting a duplicate.
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
      return c.json(fallbackInvalid ?? { valid: false, footballer: null, imported: false })
    }
  }
)

// GET /api/two-clubs/answers?clubA=X&clubB=Y
twoClubsRouter.get('/answers', async (c) => {
  const clubA = c.req.query('clubA') ?? ''
  const clubB = c.req.query('clubB') ?? ''
  if (!clubA || !clubB) return c.json({ error: 'clubA and clubB required' }, 400)

  const variantsA = getClubVariants(clubA).map(v => v.toLowerCase())
  const variantsB = getClubVariants(clubB).map(v => v.toLowerCase())
  const allVariants = [...new Set([...variantsA, ...variantsB])]

  const phA = variantsA.map(() => '?').join(', ')
  const phB = variantsB.map(() => '?').join(', ')
  const phAll = allVariants.map(() => '?').join(', ')

  // apps = combined senior appearances across the target clubs (used to pick the
  // top players to hint). Ordered apps desc so the client can hint the top ones.
  const rows = sqlite.prepare(`
    SELECT f.id, f.name, f.photo_url, f.nationality, f.position,
      (SELECT COALESCE(SUM(cs.apps), 0) FROM career_stints cs
         WHERE cs.footballer_id = f.id AND cs.stint_type = 'senior'
         AND LOWER(cs.club) IN (${phAll})) AS apps,
      ${CAREER_SPAN_SELECT}
    FROM footballers f
    JOIN career_stints csa ON csa.footballer_id = f.id
      AND csa.stint_type = 'senior'
      AND LOWER(csa.club) IN (${phA})
    JOIN career_stints csb ON csb.footballer_id = f.id
      AND csb.stint_type = 'senior'
      AND LOWER(csb.club) IN (${phB})
    GROUP BY f.id
    ORDER BY apps DESC, f.name ASC
  `).all(...allVariants, ...variantsA, ...variantsB) as { id: number; name: string; photo_url: string | null; nationality: string | null; position: string | null; apps: number; career_start: string | null; career_end: string | null }[]

  return c.json(rows.map(r => ({ ...r, careerYears: formatCareerYears(r.career_start, r.career_end) })))
})
