import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sqlite, normalizeName } from '../db/client.ts'
import { scrapeWikipedia } from '../services/scraper.ts'

export const centurionsRouter = new Hono()

const VALID_MODES = [
  'one-club',
  'goals-200',
  'goals-500',
  'international',
  'international-goals',
  'appearances',
  'one-club-300',
  'one-club-apps',
  'dual-centurion',
] as const

type Mode = typeof VALID_MODES[number]

interface CenturionPlayer {
  id: number
  name: string
  photo_url: string | null
  nationality: string | null
  hint_club: string | null
  hint_club_wiki_url: string | null
  hint_years: string | null
  stat: number
  slot_key: string
}

type FootballerRow = { id: number; name: string; wikipedia_url: string | null; photo_url: string | null }

// Subquery: club with most senior apps + its wikipedia URL
const HINT_CLUB_SUBQUERY = `(
  SELECT club FROM career_stints
  WHERE footballer_id = f.id AND stint_type = 'senior' AND apps IS NOT NULL
  GROUP BY club ORDER BY SUM(apps) DESC LIMIT 1
)`

const HINT_WIKI_SUBQUERY = `(
  SELECT club_wikipedia_url FROM career_stints
  WHERE footballer_id = f.id AND stint_type = 'senior' AND apps IS NOT NULL
  GROUP BY club ORDER BY SUM(apps) DESC LIMIT 1
)`

const HINT_YEARS_SUBQUERY = `(
  SELECT cs_y.years FROM career_stints cs_y
  WHERE cs_y.footballer_id = f.id AND cs_y.stint_type = 'senior' AND cs_y.apps IS NOT NULL
    AND cs_y.club = (
      SELECT club FROM career_stints
      WHERE footballer_id = f.id AND stint_type = 'senior' AND apps IS NOT NULL
      GROUP BY club ORDER BY SUM(apps) DESC LIMIT 1
    )
  ORDER BY COALESCE(cs_y.apps, 0) DESC LIMIT 1
)`

// ── List queries (all qualifying players) ────────────────────────────────────

function goalTotalQuery(min: number, max?: number): CenturionPlayer[] {
  const having = max != null ? `stat >= ${min} AND stat <= ${max}` : `stat >= ${min}`
  return sqlite.prepare(`
    SELECT f.id, f.name, f.photo_url, f.nationality,
           SUM(cs.goals) as stat,
           ${HINT_CLUB_SUBQUERY} as hint_club,
           ${HINT_WIKI_SUBQUERY} as hint_club_wiki_url,
           ${HINT_YEARS_SUBQUERY} as hint_years,
           CAST(f.id AS TEXT) as slot_key
    FROM footballers f
    JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
    WHERE cs.goals IS NOT NULL
    GROUP BY f.id
    HAVING ${having}
    ORDER BY stat DESC
  `).all() as CenturionPlayer[]
}

function queryForMode(mode: Mode): CenturionPlayer[] {
  switch (mode) {
    case 'one-club':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               cs.club as hint_club,
               MAX(cs.club_wikipedia_url) as hint_club_wiki_url,
               (SELECT cs_y.years FROM career_stints cs_y
                WHERE cs_y.footballer_id = f.id AND cs_y.stint_type = 'senior' AND cs_y.club = cs.club
                ORDER BY COALESCE(cs_y.apps, 0) DESC LIMIT 1) as hint_years,
               (CAST(f.id AS TEXT) || '|||' || cs.club) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.goals IS NOT NULL
        GROUP BY f.id, cs.club
        HAVING stat >= 100
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]

    case 'goals-200':
      return goalTotalQuery(200, 299)

    case 'goals-500':
      return goalTotalQuery(300)

    case 'international':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.apps) as stat,
               NULL as hint_club,
               NULL as hint_club_wiki_url,
               NULL as hint_years,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'international'
        WHERE cs.apps IS NOT NULL
        GROUP BY f.id
        HAVING stat >= 100
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]

    case 'international-goals':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               NULL as hint_club,
               NULL as hint_club_wiki_url,
               NULL as hint_years,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'international'
        WHERE cs.goals IS NOT NULL
          AND cs.club NOT GLOB '* U[0-9]*'
          AND cs.club NOT LIKE '%Under-%'
        GROUP BY f.id
        HAVING stat >= 50
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]

    case 'appearances':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.apps) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
               ${HINT_WIKI_SUBQUERY} as hint_club_wiki_url,
               ${HINT_YEARS_SUBQUERY} as hint_years,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.apps IS NOT NULL
        GROUP BY f.id
        HAVING stat >= 500
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]

    case 'one-club-300':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.apps) as stat,
               cs.club as hint_club,
               MAX(cs.club_wikipedia_url) as hint_club_wiki_url,
               (SELECT cs_y.years FROM career_stints cs_y
                WHERE cs_y.footballer_id = f.id AND cs_y.stint_type = 'senior' AND cs_y.club = cs.club
                ORDER BY COALESCE(cs_y.apps, 0) DESC LIMIT 1) as hint_years,
               (CAST(f.id AS TEXT) || '|||' || cs.club) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.apps IS NOT NULL
        GROUP BY f.id, cs.club
        HAVING stat >= 300
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]

    case 'one-club-apps':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.apps) as stat,
               cs.club as hint_club,
               MAX(cs.club_wikipedia_url) as hint_club_wiki_url,
               (SELECT cs_y.years FROM career_stints cs_y
                WHERE cs_y.footballer_id = f.id AND cs_y.stint_type = 'senior' AND cs_y.club = cs.club
                ORDER BY COALESCE(cs_y.apps, 0) DESC LIMIT 1) as hint_years,
               (CAST(f.id AS TEXT) || '|||' || cs.club) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.apps IS NOT NULL
        GROUP BY f.id, cs.club
        HAVING stat >= 400
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]

    case 'dual-centurion':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               (SELECT SUM(cs.goals) FROM career_stints cs
                WHERE cs.footballer_id = f.id AND cs.stint_type = 'senior' AND cs.goals IS NOT NULL) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
               ${HINT_WIKI_SUBQUERY} as hint_club_wiki_url,
               ${HINT_YEARS_SUBQUERY} as hint_years,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        WHERE (
          SELECT SUM(cs.goals) FROM career_stints cs
          WHERE cs.footballer_id = f.id AND cs.stint_type = 'senior' AND cs.goals IS NOT NULL
        ) >= 100
        AND (
          SELECT SUM(cs.apps) FROM career_stints cs
          WHERE cs.footballer_id = f.id AND cs.stint_type = 'international' AND cs.apps IS NOT NULL
        ) >= 50
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]
  }
}

// ── Single-player qualification checks (for verify endpoint) ─────────────────

function checkGoalTotal(min: number, max: number | undefined, id: number): CenturionPlayer | null {
  const having = max != null ? `stat >= ${min} AND stat <= ${max}` : `stat >= ${min}`
  return sqlite.prepare(`
    SELECT f.id, f.name, f.photo_url, f.nationality,
           SUM(cs.goals) as stat,
           ${HINT_CLUB_SUBQUERY} as hint_club,
           ${HINT_WIKI_SUBQUERY} as hint_club_wiki_url,
           ${HINT_YEARS_SUBQUERY} as hint_years,
           CAST(f.id AS TEXT) as slot_key
    FROM footballers f
    JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
    WHERE cs.goals IS NOT NULL AND f.id = ?
    GROUP BY f.id
    HAVING ${having}
    LIMIT 1
  `).get(id) as CenturionPlayer | null
}

function checkPlayerForMode(id: number, mode: Mode): CenturionPlayer | null {
  switch (mode) {
    case 'one-club':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               cs.club as hint_club,
               MAX(cs.club_wikipedia_url) as hint_club_wiki_url,
               (SELECT cs_y.years FROM career_stints cs_y WHERE cs_y.footballer_id = f.id AND cs_y.stint_type = 'senior' AND cs_y.club = cs.club ORDER BY COALESCE(cs_y.apps, 0) DESC LIMIT 1) as hint_years,
               (CAST(f.id AS TEXT) || '|||' || cs.club) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.goals IS NOT NULL AND f.id = ?
        GROUP BY f.id, cs.club
        HAVING stat >= 100
        ORDER BY stat DESC
        LIMIT 1
      `).get(id) as CenturionPlayer | null
    case 'goals-200':
      return checkGoalTotal(200, 299, id)
    case 'goals-500':
      return checkGoalTotal(300, undefined, id)
    case 'international':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.apps) as stat,
               NULL as hint_club,
               NULL as hint_club_wiki_url,
               NULL as hint_years,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'international'
        WHERE cs.apps IS NOT NULL AND f.id = ?
        GROUP BY f.id
        HAVING stat >= 100
        LIMIT 1
      `).get(id) as CenturionPlayer | null
    case 'international-goals':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               NULL as hint_club,
               NULL as hint_club_wiki_url,
               NULL as hint_years,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'international'
        WHERE cs.goals IS NOT NULL AND f.id = ?
          AND cs.club NOT GLOB '* U[0-9]*'
          AND cs.club NOT LIKE '%Under-%'
        GROUP BY f.id
        HAVING stat >= 50
        LIMIT 1
      `).get(id) as CenturionPlayer | null
    case 'appearances':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.apps) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
               ${HINT_WIKI_SUBQUERY} as hint_club_wiki_url,
               ${HINT_YEARS_SUBQUERY} as hint_years,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.apps IS NOT NULL AND f.id = ?
        GROUP BY f.id
        HAVING stat >= 500
        LIMIT 1
      `).get(id) as CenturionPlayer | null
    case 'one-club-300':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.apps) as stat,
               cs.club as hint_club,
               MAX(cs.club_wikipedia_url) as hint_club_wiki_url,
               (SELECT cs_y.years FROM career_stints cs_y WHERE cs_y.footballer_id = f.id AND cs_y.stint_type = 'senior' AND cs_y.club = cs.club ORDER BY COALESCE(cs_y.apps, 0) DESC LIMIT 1) as hint_years,
               (CAST(f.id AS TEXT) || '|||' || cs.club) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.apps IS NOT NULL AND f.id = ?
        GROUP BY f.id, cs.club
        HAVING stat >= 300
        LIMIT 1
      `).get(id) as CenturionPlayer | null
    case 'one-club-apps':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.apps) as stat,
               cs.club as hint_club,
               MAX(cs.club_wikipedia_url) as hint_club_wiki_url,
               (SELECT cs_y.years FROM career_stints cs_y WHERE cs_y.footballer_id = f.id AND cs_y.stint_type = 'senior' AND cs_y.club = cs.club ORDER BY COALESCE(cs_y.apps, 0) DESC LIMIT 1) as hint_years,
               (CAST(f.id AS TEXT) || '|||' || cs.club) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.apps IS NOT NULL AND f.id = ?
        GROUP BY f.id, cs.club
        HAVING stat >= 400
        LIMIT 1
      `).get(id) as CenturionPlayer | null
    case 'dual-centurion':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               (SELECT SUM(cs.goals) FROM career_stints cs
                WHERE cs.footballer_id = f.id AND cs.stint_type = 'senior' AND cs.goals IS NOT NULL) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
               ${HINT_WIKI_SUBQUERY} as hint_club_wiki_url,
               ${HINT_YEARS_SUBQUERY} as hint_years,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        WHERE f.id = ?
        AND (SELECT SUM(cs.goals) FROM career_stints cs
             WHERE cs.footballer_id = f.id AND cs.stint_type = 'senior' AND cs.goals IS NOT NULL) >= 100
        AND (SELECT SUM(cs.apps) FROM career_stints cs
             WHERE cs.footballer_id = f.id AND cs.stint_type = 'international' AND cs.apps IS NOT NULL) >= 50
        LIMIT 1
      `).get(id) as CenturionPlayer | null
  }
}

function insertStints(footballerId: number, stints: Awaited<ReturnType<typeof scrapeWikipedia>>['stints'], stintType: string) {
  for (const s of stints) {
    if (s.stint_type !== stintType) continue
    const existing = sqlite.prepare(
      `SELECT id FROM career_stints WHERE footballer_id = ? AND years = ? AND club = ? AND stint_type = ? LIMIT 1`
    ).get(footballerId, s.years, s.club, stintType)
    if (!existing) {
      const maxOrder = sqlite.prepare(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM career_stints WHERE footballer_id = ?`
      ).get(footballerId) as { next: number }
      sqlite.prepare(
        `INSERT INTO career_stints (footballer_id, sort_order, years, club, club_wikipedia_url, apps, goals, stint_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(footballerId, maxOrder.next, s.years, s.club, s.club_wikipedia_url ?? null, s.apps ?? null, s.goals ?? null, stintType)
    }
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

centurionsRouter.get(
  '/players',
  zValidator('query', z.object({ mode: z.enum(VALID_MODES) })),
  (c) => {
    const { mode } = c.req.valid('query')
    const players = queryForMode(mode)
    return c.json(players)
  }
)

centurionsRouter.post(
  '/verify',
  zValidator('json', z.object({
    name: z.string().min(1),
    mode: z.enum(VALID_MODES),
    footballerId: z.number().int().optional(),
  })),
  async (c) => {
    const { name, mode, footballerId: reqId } = c.req.valid('json')
    const stintType = (mode === 'international' || mode === 'international-goals') ? 'international' : 'senior'
    const scrapeAllStints = mode === 'dual-centurion'

    // Step 1: resolve footballer from DB
    let footballer: FootballerRow | undefined

    if (reqId != null) {
      footballer = sqlite.prepare(`SELECT id, name, wikipedia_url, photo_url FROM footballers WHERE id = ? LIMIT 1`)
        .get(reqId) as FootballerRow | undefined
    }
    if (!footballer) {
      footballer = sqlite.prepare(
        `SELECT id, name, wikipedia_url, photo_url FROM footballers WHERE normalize(name) = ? LIMIT 1`
      ).get(normalizeName(name)) as FootballerRow | undefined
    }

    // Step 2: if found, check qualification; re-scrape if needed
    if (footballer) {
      const player = checkPlayerForMode(footballer.id, mode)
      if (player) return c.json({ qualified: true, player, scraped: false })

      if (footballer.wikipedia_url) {
        try {
          const scraped = await scrapeWikipedia(footballer.wikipedia_url)
          insertStints(footballer.id, scraped.stints, stintType)
          if (scrapeAllStints) insertStints(footballer.id, scraped.stints, 'senior')
          const refreshed = checkPlayerForMode(footballer.id, mode)
          if (refreshed) return c.json({ qualified: true, player: refreshed, scraped: true })
        } catch {
          // fall through to Wikipedia search
        }
      }
    }

    // Step 3: search Wikipedia, scrape, insert
    try {
      const wikiHeaders = { 'User-Agent': 'GuessTheCareer-Admin/1.0' }
      const nameParts = normalizeName(name).split(/\s+/).filter(p => p.length > 2)
      function titleMatchesName(title: string) {
        return nameParts.some(p => normalizeName(title).includes(p))
      }
      async function wikiSearch(query: string) {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`
        const res = await fetch(url, { headers: wikiHeaders })
        if (!res.ok) return null
        const data = await res.json() as { query?: { search?: { title: string }[] } }
        return data.query?.search?.[0] ?? null
      }

      let result = await wikiSearch(name + ' footballer')
      if (!result || !titleMatchesName(result.title)) {
        const fallback = await wikiSearch(name)
        if (fallback && titleMatchesName(fallback.title)) result = fallback
      }
      if (!result) return c.json({ qualified: false, player: null, scraped: false })

      const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`

      const byUrl = sqlite.prepare(`SELECT id, name, wikipedia_url, photo_url FROM footballers WHERE wikipedia_url = ? LIMIT 1`)
        .get(wikiUrl) as FootballerRow | undefined

      await new Promise(r => setTimeout(r, 300))
      const scraped = await scrapeWikipedia(wikiUrl)

      const knownRecord = byUrl ?? footballer
      if (knownRecord) {
        if (!knownRecord.wikipedia_url) {
          sqlite.prepare(`UPDATE footballers SET wikipedia_url = ?, photo_url = COALESCE(photo_url, ?) WHERE id = ?`)
            .run(wikiUrl, scraped.photo_url ?? null, knownRecord.id)
        }
        insertStints(knownRecord.id, scraped.stints, stintType)
        if (scrapeAllStints) insertStints(knownRecord.id, scraped.stints, 'senior')
        const player = checkPlayerForMode(knownRecord.id, mode)
        return c.json({ qualified: !!player, player: player ?? null, scraped: true })
      }

      // Truly new footballer — insert
      const newRow = sqlite.prepare(
        `INSERT INTO footballers (name, wikipedia_url, nationality, position, all_positions, born, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
      ).get(scraped.name, scraped.wikipedia_url, scraped.nationality, scraped.position, scraped.all_positions ?? null, scraped.born, scraped.photo_url ?? null) as { id: number }

      insertStints(newRow.id, scraped.stints, stintType)
      if (scrapeAllStints) insertStints(newRow.id, scraped.stints, 'senior')
      const player = checkPlayerForMode(newRow.id, mode)
      return c.json({ qualified: !!player, player: player ?? null, scraped: true })
    } catch {
      return c.json({ qualified: false, player: null, scraped: false })
    }
  }
)
