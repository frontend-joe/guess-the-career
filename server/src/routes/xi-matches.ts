import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db, sqlite, normalizeName } from '../db/client.ts'
import { xi_matches, xi_players, footballers, career_stints } from '../db/schema.ts'
import { scrapeMatchLineups, scrapeWikipedia, normalizeClubAlias } from '../services/scraper.ts'

export const xiMatchesRouter = new Hono()

const positionEnum = z.enum(['GK', 'DF', 'MF', 'FW'])

const playerSchema = z.object({
  name: z.string().min(1),
  position: positionEnum,
  squadNumber: z.number().int().nullable(),
  wikipediaUrl: z.string().nullable(),
  footballer_id: z.number().int().nullable().optional(),
})

const createMatchSchema = z.object({
  matchName: z.string().min(1),
  wikipediaUrl: z.string().url(),
  year: z.number().int(),
  competition: z.string().min(1),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  homePlayers: z.array(playerSchema).length(11),
  awayPlayers: z.array(playerSchema).length(11),
  homeTeamActive: z.boolean().default(true),
  awayTeamActive: z.boolean().default(true),
})

// GET /api/xi-matches
xiMatchesRouter.get('/', async (c) => {
  const matches = await db
    .select({
      id: xi_matches.id,
      name: xi_matches.name,
      wikipedia_url: xi_matches.wikipedia_url,
      year: xi_matches.year,
      competition: xi_matches.competition,
      home_team: xi_matches.home_team,
      away_team: xi_matches.away_team,
      home_team_active: xi_matches.home_team_active,
      away_team_active: xi_matches.away_team_active,
      created_at: xi_matches.created_at,
      player_count: sql<number>`(SELECT COUNT(*) FROM xi_players WHERE match_id = ${xi_matches.id})`,
    })
    .from(xi_matches)
    .orderBy(sql`${xi_matches.year} DESC`)

  return c.json(matches)
})

// POST /api/xi-matches/scrape — preview scrape (no DB writes)
xiMatchesRouter.post(
  '/scrape',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    try {
      const result = await scrapeMatchLineups(url)

      // Try to auto-link known footballer IDs for each player
      const linkPlayer = async (p: typeof result.homePlayers[0], matchTeam: string, matchYear: number) => {
        if (p.wikipediaUrl) {
          const [existing] = await db
            .select({ id: footballers.id })
            .from(footballers)
            .where(eq(footballers.wikipedia_url, p.wikipediaUrl))
            .limit(1)
          if (existing) return { ...p, footballer_id: existing.id }
        }

        // DB name lookup for players without Wikipedia URL (e.g. BBC match pages)
        const normalized = normalizeName(p.name)

        const [byName] = await db
          .select({ id: footballers.id, name: footballers.name })
          .from(footballers)
          .where(sql`normalize(${footballers.name}) = ${normalized}`)
          .limit(1)
        if (byName) return { ...p, name: byName.name, footballer_id: byName.id }

        // Last-name-only lookup for single-word entries like "Gerrard"
        if (!p.name.includes(' ')) {
          const byLastName = await db
            .select({ id: footballers.id, name: footballers.name })
            .from(footballers)
            .where(sql`normalize(${footballers.name}) LIKE ${'% ' + normalized}`)

          if (byLastName.length === 1) {
            return { ...p, name: byLastName[0].name, footballer_id: byLastName[0].id }
          }

          if (byLastName.length > 1) {
            const withStints = byLastName.map(f => ({
              ...f,
              stints: sqlite.prepare(
                `SELECT club, years FROM career_stints WHERE footballer_id = ? AND stint_type = 'senior'`
              ).all(f.id) as { club: string; years: string }[],
            }))
            const best = withStints.find(f =>
              f.stints.some(s =>
                normalizeClubAlias(s.club) === normalizeClubAlias(matchTeam) &&
                s.years.includes(String(matchYear))
              )
            ) ?? byLastName[0]
            return { ...p, name: best.name, footballer_id: best.id }
          }
        }

        return { ...p, footballer_id: null }
      }

      const homePlayers = await Promise.all(result.homePlayers.map(p => linkPlayer(p, result.homeTeam, result.year)))
      const awayPlayers = await Promise.all(result.awayPlayers.map(p => linkPlayer(p, result.awayTeam, result.year)))

      return c.json({ ...result, homePlayers, awayPlayers })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Scrape failed'
      return c.json({ error: message }, 400)
    }
  }
)

// POST /api/xi-matches — create match + xi_players + auto-import missing footballers
xiMatchesRouter.post(
  '/',
  zValidator('json', createMatchSchema),
  async (c) => {
    const body = c.req.valid('json')

    // Insert match + players atomically (better-sqlite3 is sync — use raw transaction)
    const match = sqlite.transaction(() => {
      const [newMatch] = db
        .insert(xi_matches)
        .values({
          name: body.matchName,
          wikipedia_url: body.wikipediaUrl,
          year: body.year,
          competition: body.competition,
          home_team: body.homeTeam,
          away_team: body.awayTeam,
          home_team_active: body.homeTeamActive,
          away_team_active: body.awayTeamActive,
        })
        .returning()
        .all()

      const allPlayers = [
        ...body.homePlayers.map(p => ({ ...p, team: body.homeTeam })),
        ...body.awayPlayers.map(p => ({ ...p, team: body.awayTeam })),
      ]

      db.insert(xi_players).values(
        allPlayers.map(p => ({
          match_id: newMatch.id,
          team: p.team,
          name: p.name,
          position: p.position,
          squad_number: p.squadNumber,
          footballer_id: p.footballer_id ?? null,
        }))
      ).run()

      return newMatch
    })()

    // Auto-import missing footballers (outside transaction so we can use delays)
    const importSummary = {
      added: [] as string[],
      alreadyExisted: [] as string[],
      failed: [] as string[],
    }

    const allPlayersForImport = [
      ...(body.homeTeamActive ? body.homePlayers.map(p => ({ ...p, team: body.homeTeam })) : []),
      ...(body.awayTeamActive ? body.awayPlayers.map(p => ({ ...p, team: body.awayTeam })) : []),
    ]

    for (const player of allPlayersForImport) {
      if (player.footballer_id != null) {
        importSummary.alreadyExisted.push(player.name)
        continue
      }

      if (!player.wikipediaUrl) {
        try {
          const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(player.name + ' footballer')}&format=json&srlimit=1`
          const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'GuessTheCareer/1.0' } })
          if (!searchRes.ok) throw new Error('search failed')
          const searchData = await searchRes.json() as { query?: { search?: { title: string }[] } }
          const firstResult = searchData.query?.search?.[0]
          if (!firstResult) { importSummary.failed.push(player.name); continue }
          player.wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(firstResult.title.replace(/ /g, '_'))}`
        } catch {
          importSummary.failed.push(player.name)
          continue
        }
      }

      try {
        // Check if already in footballers by URL
        const [existing] = await db
          .select({ id: footballers.id, name: footballers.name })
          .from(footballers)
          .where(eq(footballers.wikipedia_url, player.wikipediaUrl))
          .limit(1)

        if (existing) {
          // Link the xi_player to the existing footballer and sync name
          await db
            .update(xi_players)
            .set({ footballer_id: existing.id, name: existing.name })
            .where(
              sql`match_id = ${match.id} AND name = ${player.name} AND team = ${player.team}`
            )
          importSummary.alreadyExisted.push(existing.name)
          continue
        }

        // Scrape and insert new footballer
        await new Promise(resolve => setTimeout(resolve, 500))
        const scraped = await scrapeWikipedia(player.wikipediaUrl)

        // Check by name too (might exist under a slightly different URL)
        const [nameMatch] = await db
          .select({ id: footballers.id, name: footballers.name })
          .from(footballers)
          .where(sql`LOWER(${footballers.name}) = LOWER(${scraped.name})`)
          .limit(1)

        if (nameMatch) {
          await db
            .update(xi_players)
            .set({ footballer_id: nameMatch.id, name: nameMatch.name })
            .where(
              sql`match_id = ${match.id} AND name = ${player.name} AND team = ${player.team}`
            )
          importSummary.alreadyExisted.push(nameMatch.name)
          continue
        }

        const [newFootballer] = await db
          .insert(footballers)
          .values({
            name: scraped.name,
            wikipedia_url: scraped.wikipedia_url,
            nationality: scraped.nationality,
            position: scraped.position,
            born: scraped.born,
          })
          .returning()

        if (scraped.stints.length > 0) {
          await db.insert(career_stints).values(
            scraped.stints.map((s, i) => ({ ...s, sort_order: i, footballer_id: newFootballer.id }))
          )
        }

        // Link and sync name
        await db
          .update(xi_players)
          .set({ footballer_id: newFootballer.id, name: newFootballer.name })
          .where(
            sql`match_id = ${match.id} AND name = ${player.name} AND team = ${player.team}`
          )

        importSummary.added.push(newFootballer.name)
      } catch {
        importSummary.failed.push(player.name)
      }
    }

    const finalMatch = await db
      .select()
      .from(xi_matches)
      .where(eq(xi_matches.id, match.id))
      .limit(1)
      .then(r => r[0])

    return c.json({ match: finalMatch, importSummary }, 201)
  }
)

// GET /api/xi-matches/:id
xiMatchesRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const [match] = await db
    .select()
    .from(xi_matches)
    .where(eq(xi_matches.id, id))
    .limit(1)

  if (!match) return c.json({ error: 'Not found' }, 404)

  const players = await db
    .select()
    .from(xi_players)
    .where(eq(xi_players.match_id, id))
    .orderBy(
      sql`CASE position WHEN 'GK' THEN 1 WHEN 'DF' THEN 2 WHEN 'MF' THEN 3 WHEN 'FW' THEN 4 END`,
      xi_players.squad_number
    )

  const homePlayers = players.filter(p => p.team === match.home_team)
  const awayPlayers = players.filter(p => p.team === match.away_team)

  return c.json({ match, homePlayers, awayPlayers })
})

// PATCH /api/xi-matches/:id
xiMatchesRouter.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).optional(),
      year: z.number().int().optional(),
      competition: z.string().optional(),
      home_team: z.string().optional(),
      away_team: z.string().optional(),
      home_team_active: z.boolean().optional(),
      away_team_active: z.boolean().optional(),
    })
  ),
  async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const body = c.req.valid('json')
    const [updated] = await db
      .update(xi_matches)
      .set(body)
      .where(eq(xi_matches.id, id))
      .returning()

    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  }
)

// DELETE /api/xi-matches/:id
xiMatchesRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const [deleted] = await db
    .delete(xi_matches)
    .where(eq(xi_matches.id, id))
    .returning()

  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

// PUT /api/xi-matches/:id/players — replace all players for a match
xiMatchesRouter.put(
  '/:id/players',
  zValidator(
    'json',
    z.object({
      homePlayers: z.array(playerSchema).length(11),
      awayPlayers: z.array(playerSchema).length(11),
    })
  ),
  async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const [match] = await db
      .select()
      .from(xi_matches)
      .where(eq(xi_matches.id, id))
      .limit(1)
    if (!match) return c.json({ error: 'Not found' }, 404)

    const body = c.req.valid('json')

    sqlite.transaction(() => {
      db.delete(xi_players).where(eq(xi_players.match_id, id)).run()
      const all = [
        ...body.homePlayers.map(p => ({ ...p, team: match.home_team })),
        ...body.awayPlayers.map(p => ({ ...p, team: match.away_team })),
      ]
      db.insert(xi_players).values(
        all.map(p => ({
          match_id: id,
          team: p.team,
          name: p.name,
          position: p.position,
          squad_number: p.squadNumber,
          footballer_id: p.footballer_id ?? null,
        }))
      ).run()
    })()

    return c.json({ ok: true })
  }
)

// PATCH /api/xi-matches/players/:playerId — update a single player
xiMatchesRouter.patch(
  '/players/:playerId',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).optional(),
      position: positionEnum.optional(),
      squad_number: z.number().int().nullable().optional(),
      footballer_id: z.number().int().nullable().optional(),
    })
  ),
  async (c) => {
    const playerId = parseInt(c.req.param('playerId'))
    if (isNaN(playerId)) return c.json({ error: 'Invalid id' }, 400)

    const body = c.req.valid('json')
    const [updated] = await db
      .update(xi_players)
      .set(body)
      .where(eq(xi_players.id, playerId))
      .returning()

    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  }
)
