import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db, sqlite } from '../db/client.ts'
import {
  competitions, competition_top_scorers, competition_hat_tricks, competition_top_assists,
  footballers, managers, xi_matches, xi_players, career_stints,
} from '../db/schema.ts'
import {
  scrapeCompetitionPage, scrapeWikipedia, scrapeManagerWikipedia,
  deriveCompetition,
} from '../services/scraper.ts'

export const competitionsRouter = new Hono()

const pfaPlayerSchema = z.object({
  name: z.string().min(1),
  wikipediaUrl: z.string().nullable(),
  position: z.enum(['GK', 'DF', 'MF', 'FW']),
  squadNumber: z.number().int(),
})

const importBodySchema = z.object({
  wikipediaUrl: z.string().url(),
  name: z.string().min(1),
  topScorers: z.array(z.object({
    name: z.string().min(1),
    wikipediaUrl: z.string(),
    club: z.string().min(1),
    goals: z.number().int(),
    rank: z.number().int(),
  })),
  hatTricks: z.array(z.object({
    name: z.string().min(1),
    wikipediaUrl: z.string(),
    forClub: z.string().min(1),
    againstClub: z.string().min(1),
  })),
  topAssists: z.array(z.object({
    name: z.string().min(1),
    wikipediaUrl: z.string(),
    club: z.string().min(1),
    assists: z.number().int(),
    rank: z.number().int(),
  })),
  playerOfSeason: z.object({ name: z.string(), wikipediaUrl: z.string() }).nullable(),
  managerOfSeason: z.object({ name: z.string(), wikipediaUrl: z.string() }).nullable(),
  pfaTeamOfYear: z.array(pfaPlayerSchema),
})

// POST /api/competitions/check — check which players/manager already exist in DB
competitionsRouter.post(
  '/check',
  zValidator('json', z.object({
    footballers: z.array(z.object({ name: z.string(), url: z.string() })),
    managerUrl: z.string().optional(),
    managerName: z.string().optional(),
  })),
  async (c) => {
    const body = c.req.valid('json')

    const results: { name: string; url: string; exists: boolean }[] = []
    const seen = new Set<string>()

    for (const entry of body.footballers) {
      const key = entry.url || entry.name
      if (seen.has(key)) continue
      seen.add(key)

      let exists = false
      if (entry.url) {
        const [byUrl] = await db.select({ id: footballers.id })
          .from(footballers).where(eq(footballers.wikipedia_url, entry.url)).limit(1)
        if (byUrl) exists = true
      }
      if (!exists) {
        const [byName] = await db.select({ id: footballers.id })
          .from(footballers).where(sql`LOWER(${footballers.name}) = LOWER(${entry.name})`).limit(1)
        if (byName) exists = true
      }
      results.push({ name: entry.name, url: entry.url, exists })
    }

    let managerExists: boolean | null = null
    if (body.managerUrl || body.managerName) {
      managerExists = false
      if (body.managerUrl) {
        const [byUrl] = await db.select({ id: managers.id })
          .from(managers).where(eq(managers.wikipedia_url, body.managerUrl)).limit(1)
        if (byUrl) managerExists = true
      }
      if (!managerExists && body.managerName) {
        const [byName] = await db.select({ id: managers.id })
          .from(managers).where(sql`LOWER(${managers.name}) = LOWER(${body.managerName})`).limit(1)
        if (byName) managerExists = true
      }
    }

    return c.json({ footballers: results, managerExists })
  }
)

// POST /api/competitions/scrape — preview only, no DB writes
competitionsRouter.post(
  '/scrape',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    try {
      const result = await scrapeCompetitionPage(url)
      return c.json(result)
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'Scrape failed' }, 400)
    }
  }
)

// POST /api/competitions — full import
competitionsRouter.post(
  '/',
  zValidator('json', importBodySchema),
  async (c) => {
    const body = c.req.valid('json')

    const importSummary = {
      footballers: { added: [] as string[], alreadyExisted: [] as string[], failed: [] as string[] },
      manager: 'none' as 'added' | 'existed' | 'none' | 'failed',
    }

    // Resolve or import a footballer by Wikipedia URL, falling back to name search
    async function resolveFootballer(name: string, wikiUrl: string): Promise<number | null> {
      const url = wikiUrl.trim()

      if (url) {
        const [byUrl] = await db.select({ id: footballers.id, name: footballers.name })
          .from(footballers).where(eq(footballers.wikipedia_url, url)).limit(1)
        if (byUrl) {
          importSummary.footballers.alreadyExisted.push(byUrl.name)
          return byUrl.id
        }
      }

      // Check by name
      const [byName] = await db.select({ id: footballers.id, name: footballers.name })
        .from(footballers)
        .where(sql`LOWER(${footballers.name}) = LOWER(${name})`)
        .limit(1)
      if (byName) {
        importSummary.footballers.alreadyExisted.push(byName.name)
        return byName.id
      }

      const scrapeUrl = url || await searchWikipedia(name)
      if (!scrapeUrl) { importSummary.footballers.failed.push(name); return null }

      try {
        await new Promise(r => setTimeout(r, 500))
        const scraped = await scrapeWikipedia(scrapeUrl)

        // Double-check by name after scrape (might have been imported concurrently)
        const [existing] = await db.select({ id: footballers.id, name: footballers.name })
          .from(footballers)
          .where(sql`LOWER(${footballers.name}) = LOWER(${scraped.name})`)
          .limit(1)
        if (existing) {
          importSummary.footballers.alreadyExisted.push(existing.name)
          return existing.id
        }

        const [newF] = await db.insert(footballers).values({
          name: scraped.name,
          wikipedia_url: scraped.wikipedia_url,
          nationality: scraped.nationality,
          position: scraped.position,
          born: scraped.born,
          photo_url: scraped.photo_url ?? null,
        }).returning()

        if (scraped.stints.length > 0) {
          await db.insert(career_stints)
            .values(scraped.stints.map((s, i) => ({ ...s, sort_order: i, footballer_id: newF.id })))
        }

        importSummary.footballers.added.push(newF.name)
        return newF.id
      } catch {
        importSummary.footballers.failed.push(name)
        return null
      }
    }

    // Resolve or import a manager
    async function resolveManager(name: string, wikiUrl: string): Promise<number | null> {
      const url = wikiUrl.trim()
      if (url) {
        const [byUrl] = await db.select({ id: managers.id })
          .from(managers).where(eq(managers.wikipedia_url, url)).limit(1)
        if (byUrl) { importSummary.manager = 'existed'; return byUrl.id }
      }

      const [byName] = await db.select({ id: managers.id })
        .from(managers).where(sql`LOWER(${managers.name}) = LOWER(${name})`).limit(1)
      if (byName) { importSummary.manager = 'existed'; return byName.id }

      try {
        await new Promise(r => setTimeout(r, 500))
        const scraped = await scrapeManagerWikipedia(url || await searchWikipedia(name) || '')
        const [newM] = await db.insert(managers).values({
          name: scraped.name,
          wikipedia_url: scraped.wikipedia_url,
          place_of_birth: scraped.place_of_birth,
          born: scraped.born,
        }).returning()
        importSummary.manager = 'added'
        return newM.id
      } catch {
        importSummary.manager = 'failed'
        return null
      }
    }

    // 1. Resolve all unique footballer URLs
    const allFootballerEntries = [
      ...body.topScorers.map(s => ({ name: s.name, url: s.wikipediaUrl })),
      ...body.hatTricks.map(h => ({ name: h.name, url: h.wikipediaUrl })),
      ...body.topAssists.map(a => ({ name: a.name, url: a.wikipediaUrl })),
      ...(body.playerOfSeason ? [{ name: body.playerOfSeason.name, url: body.playerOfSeason.wikipediaUrl }] : []),
      ...body.pfaTeamOfYear.map(p => ({ name: p.name, url: p.wikipediaUrl ?? '' })),
    ]

    // Deduplicate by url (or name if no url)
    const seen = new Set<string>()
    const urlToId = new Map<string, number | null>()

    for (const entry of allFootballerEntries) {
      const key = entry.url || entry.name
      if (seen.has(key)) continue
      seen.add(key)
      const id = await resolveFootballer(entry.name, entry.url)
      if (entry.url) urlToId.set(entry.url, id)
    }

    const getFootballerId = (_name: string, url: string): number | null =>
      url ? (urlToId.get(url) ?? null) : null

    // 2. Resolve manager of season
    let managerOfSeasonId: number | null = null
    if (body.managerOfSeason) {
      managerOfSeasonId = await resolveManager(body.managerOfSeason.name, body.managerOfSeason.wikipediaUrl)
    }

    // 3. Player of season ID
    const playerOfSeasonId = body.playerOfSeason
      ? getFootballerId(body.playerOfSeason.name, body.playerOfSeason.wikipediaUrl)
      : null

    // 4. Create PFA TOTY xi_match (if 11 players)
    let pfaTotypMatchId: number | null = null
    if (body.pfaTeamOfYear.length === 11) {
      const totyWikiUrl = `${body.wikipediaUrl}#PFA_Team_of_the_Year`
      const yearMatch = body.name.match(/\d{4}/)
      const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear()
      const competition = deriveCompetition(body.name)

      // Check if already exists
      const [existingMatch] = await db.select({ id: xi_matches.id })
        .from(xi_matches).where(eq(xi_matches.wikipedia_url, totyWikiUrl)).limit(1)

      if (existingMatch) {
        pfaTotypMatchId = existingMatch.id
      } else {
        const insertedMatch = sqlite.transaction(() => {
          const [newMatch] = db.insert(xi_matches).values({
            name: `${body.name} — PFA Team of the Year`,
            wikipedia_url: totyWikiUrl,
            year,
            competition,
            home_team: 'PFA Team of the Year',
            away_team: '',
            home_team_active: true,
            away_team_active: false,
          }).returning().all()

          db.insert(xi_players).values(
            body.pfaTeamOfYear.map(p => ({
              match_id: newMatch.id,
              team: 'PFA Team of the Year',
              name: p.name,
              position: p.position,
              squad_number: p.squadNumber,
              footballer_id: getFootballerId(p.name, p.wikipediaUrl ?? ''),
            }))
          ).run()

          return newMatch
        })()
        pfaTotypMatchId = insertedMatch.id
      }
    }

    // 5. Insert competition row
    const [newComp] = await db.insert(competitions).values({
      name: body.name,
      wikipedia_url: body.wikipediaUrl,
      player_of_season_id: playerOfSeasonId,
      manager_of_season_id: managerOfSeasonId,
      pfa_toty_match_id: pfaTotypMatchId,
    }).returning()

    // 6. Insert stats
    if (body.topScorers.length > 0) {
      await db.insert(competition_top_scorers).values(
        body.topScorers.map(s => ({
          competition_id: newComp.id,
          footballer_id: getFootballerId(s.name, s.wikipediaUrl),
          name: s.name,
          club: s.club,
          goals: s.goals,
          rank: s.rank,
        }))
      )
    }

    if (body.hatTricks.length > 0) {
      await db.insert(competition_hat_tricks).values(
        body.hatTricks.map(h => ({
          competition_id: newComp.id,
          footballer_id: getFootballerId(h.name, h.wikipediaUrl),
          name: h.name,
          for_club: h.forClub,
          against_club: h.againstClub,
        }))
      )
    }

    if (body.topAssists.length > 0) {
      await db.insert(competition_top_assists).values(
        body.topAssists.map(a => ({
          competition_id: newComp.id,
          footballer_id: getFootballerId(a.name, a.wikipediaUrl),
          name: a.name,
          club: a.club,
          assists: a.assists,
          rank: a.rank,
        }))
      )
    }

    const final = await db.select().from(competitions).where(eq(competitions.id, newComp.id)).limit(1).then(r => r[0])
    return c.json({ competition: final, importSummary }, 201)
  }
)

// GET /api/competitions
competitionsRouter.get('/', async (c) => {
  const rows = await db.select({
    id: competitions.id,
    name: competitions.name,
    wikipedia_url: competitions.wikipedia_url,
    image_url: competitions.image_url,
    created_at: competitions.created_at,
  }).from(competitions).orderBy(competitions.name)
  return c.json(rows)
})

// GET /api/competitions/:id
competitionsRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const [comp] = await db.select().from(competitions).where(eq(competitions.id, id)).limit(1)
  if (!comp) return c.json({ error: 'Not found' }, 404)

  const topScorers = sqlite.prepare(`
    SELECT cts.*, f.name AS footballer_name, f.photo_url
    FROM competition_top_scorers cts
    LEFT JOIN footballers f ON f.id = cts.footballer_id
    WHERE cts.competition_id = ?
    ORDER BY cts.rank
  `).all(id) as (typeof competition_top_scorers.$inferSelect & { footballer_name: string | null; photo_url: string | null })[]

  const hatTricks = sqlite.prepare(`
    SELECT cht.*, f.name AS footballer_name, f.photo_url
    FROM competition_hat_tricks cht
    LEFT JOIN footballers f ON f.id = cht.footballer_id
    WHERE cht.competition_id = ?
    ORDER BY cht.id
  `).all(id) as (typeof competition_hat_tricks.$inferSelect & { footballer_name: string | null; photo_url: string | null })[]

  const topAssists = sqlite.prepare(`
    SELECT cta.*, f.name AS footballer_name, f.photo_url
    FROM competition_top_assists cta
    LEFT JOIN footballers f ON f.id = cta.footballer_id
    WHERE cta.competition_id = ?
    ORDER BY cta.rank
  `).all(id) as (typeof competition_top_assists.$inferSelect & { footballer_name: string | null; photo_url: string | null })[]

  let playerOfSeason: { id: number; name: string; photo_url: string | null } | null = null
  if (comp.player_of_season_id) {
    const [f] = await db.select({ id: footballers.id, name: footballers.name, photo_url: footballers.photo_url })
      .from(footballers).where(eq(footballers.id, comp.player_of_season_id)).limit(1)
    if (f) playerOfSeason = f
  }

  let managerOfSeason: { id: number; name: string; photo_url: string | null } | null = null
  if (comp.manager_of_season_id) {
    const [m] = await db.select({ id: managers.id, name: managers.name, photo_url: managers.photo_url })
      .from(managers).where(eq(managers.id, comp.manager_of_season_id)).limit(1)
    if (m) managerOfSeason = m
  }

  return c.json({ competition: comp, topScorers, hatTricks, topAssists, playerOfSeason, managerOfSeason })
})

// PATCH /api/competitions/:id
competitionsRouter.patch('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const body = await c.req.json<{ image_url?: string | null }>()
  const [updated] = await db.update(competitions)
    .set({ image_url: body.image_url ?? null })
    .where(eq(competitions.id, id))
    .returning()
  if (!updated) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

// DELETE /api/competitions/:id
competitionsRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const [deleted] = await db.delete(competitions).where(eq(competitions.id, id)).returning()
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

async function searchWikipedia(name: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + ' footballer')}&format=json&srlimit=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'GuessTheCareer-Admin/1.0' } })
    if (!res.ok) return null
    const data = await res.json() as { query?: { search?: { title: string }[] } }
    const first = data.query?.search?.[0]
    if (!first) return null
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(first.title.replace(/ /g, '_'))}`
  } catch {
    return null
  }
}
