import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db, sqlite } from '../db/client.ts'
import { footballers, career_stints } from '../db/schema.ts'
import { CLUB_ALIASES, normalizeClubAlias, scrapeWikipedia } from '../services/scraper.ts'

export const twoClubsRouter = new Hono()

// Build the full list of club name variants (canonical + all aliases)
function getClubVariants(clubName: string): string[] {
  const canonical = normalizeClubAlias(clubName)
  const aliases = Object.entries(CLUB_ALIASES)
    .filter(([, v]) => v === canonical)
    .map(([k]) => k)
  return [canonical, ...aliases]
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

// GET /api/two-clubs/session
twoClubsRouter.get('/session', async (c) => {
  const excludeParam = c.req.query('exclude') ?? ''
  const excludedPairs = new Set(
    excludeParam ? excludeParam.split(',').map(p => p.trim()).filter(Boolean) : []
  )

  const stints = sqlite.prepare(
    `SELECT footballer_id, club FROM career_stints WHERE stint_type = 'senior'`
  ).all() as StintRow[]

  const clubMap = buildClubMap(stints)
  const reserveRe = /\s(B|C|II|III|IV|reserves?|under[- ]?\d+|u\d+|youth|academy)$/i
  const clubNames = [...clubMap.keys()].filter(name => !reserveRe.test(name.trim()))

  // Find all pairs with >= 5 shared players
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

  if (validPairs.length === 0) {
    return c.json({ error: 'No valid club pairs found in database' }, 404)
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
      const normalizedName = footballerName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      footballer = await db.select({
        id: footballers.id,
        name: footballers.name,
        wikipedia_url: footballers.wikipedia_url,
        photo_url: footballers.photo_url,
      }).from(footballers)
        .where(sql`LOWER(normalize(${footballers.name})) = LOWER(normalize(${footballerName}))`)
        .limit(1)
        .then(r => r[0])

      // Also try partial normalization match
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

      if (hasClub(stintClubs, clubA) && hasClub(stintClubs, clubB)) {
        return c.json({ valid: true, footballer: { id: footballer.id, name: footballer.name, photo_url: footballer.photo_url }, imported: false })
      }

      // Stints incomplete — rescrape if we have a Wikipedia URL
      if (footballer.wikipedia_url) {
        try {
          const scraped = await scrapeWikipedia(footballer.wikipedia_url)
          const seniorStints = scraped.stints.filter(s => s.stint_type === 'senior')

          // Upsert new stints (insert only stints not already present for this footballer)
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
          const refreshedClubs = refreshed.map(s => s.club)

          if (hasClub(refreshedClubs, clubA) && hasClub(refreshedClubs, clubB)) {
            return c.json({ valid: true, footballer: { id: footballer.id, name: footballer.name, photo_url: footballer.photo_url }, imported: true })
          }
        } catch {
          // scrape failed — fall through to invalid
        }
      }

      return c.json({ valid: false, footballer: null, imported: false })
    }

    // Step 3: footballer not in DB at all — try Wikipedia name search
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(footballerName + ' footballer')}&format=json&srlimit=1`
      const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' } })
      if (!searchRes.ok) throw new Error('Wikipedia search failed')
      const searchData = await searchRes.json() as { query?: { search?: { title: string }[] } }
      const firstResult = searchData.query?.search?.[0]
      if (!firstResult) return c.json({ valid: false, footballer: null, imported: false })

      const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(firstResult.title.replace(/ /g, '_'))}`

      // Check if already in DB by URL
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
        return c.json({ valid: false, footballer: null, imported: false })
      }

      // Insert new footballer
      const [newFootballer] = await db.insert(footballers).values({
        name: scraped.name,
        wikipedia_url: scraped.wikipedia_url,
        nationality: scraped.nationality,
        position: scraped.position,
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

// GET /api/two-clubs/answers?clubA=X&clubB=Y
twoClubsRouter.get('/answers', async (c) => {
  const clubA = c.req.query('clubA') ?? ''
  const clubB = c.req.query('clubB') ?? ''
  if (!clubA || !clubB) return c.json({ error: 'clubA and clubB required' }, 400)

  // All known name variants for each club (canonical + aliases), lowercased for comparison
  const variantsA = getClubVariants(clubA).map(v => v.toLowerCase())
  const variantsB = getClubVariants(clubB).map(v => v.toLowerCase())

  const phA = variantsA.map(() => '?').join(', ')
  const phB = variantsB.map(() => '?').join(', ')

  const rows = sqlite.prepare(`
    SELECT DISTINCT f.id, f.name, f.photo_url
    FROM footballers f
    JOIN career_stints csa ON csa.footballer_id = f.id
      AND csa.stint_type = 'senior'
      AND LOWER(csa.club) IN (${phA})
    JOIN career_stints csb ON csb.footballer_id = f.id
      AND csb.stint_type = 'senior'
      AND LOWER(csb.club) IN (${phB})
    ORDER BY f.name ASC
  `).all(...variantsA, ...variantsB) as { id: number; name: string; photo_url: string | null }[]

  return c.json(rows)
})
