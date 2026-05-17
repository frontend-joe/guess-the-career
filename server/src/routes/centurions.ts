import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sqlite } from '../db/client.ts'

export const centurionsRouter = new Hono()

const VALID_MODES = [
  'midfielders',
  'defenders',
  'wingers',
  'one-club',
  'goals-200',
  'goals-300',
  'international',
  'appearances',
] as const

type Mode = typeof VALID_MODES[number]

interface CenturionPlayer {
  id: number
  name: string
  photo_url: string | null
  nationality: string | null
  hint_club: string | null
  hint_club_wiki_url: string | null
  stat: number
  slot_key: string
}

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

function buildPositionWhere(patterns: string[]): string {
  const clauses = patterns.map(p =>
    `(LOWER(f.position) LIKE '${p}' OR LOWER(f.all_positions) LIKE '${p}')`
  )
  return `(${clauses.join(' OR ')})`
}

function positionQuery(where: string): CenturionPlayer[] {
  return sqlite.prepare(`
    SELECT f.id, f.name, f.photo_url, f.nationality,
           SUM(cs.goals) as stat,
           ${HINT_CLUB_SUBQUERY} as hint_club,
           ${HINT_WIKI_SUBQUERY} as hint_club_wiki_url,
           CAST(f.id AS TEXT) as slot_key
    FROM footballers f
    JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
    WHERE ${where} AND cs.goals IS NOT NULL
    GROUP BY f.id
    HAVING stat >= 100
    ORDER BY stat DESC
  `).all() as CenturionPlayer[]
}

function goalTotalQuery(min: number, max?: number): CenturionPlayer[] {
  const having = max != null ? `stat >= ${min} AND stat <= ${max}` : `stat >= ${min}`
  return sqlite.prepare(`
    SELECT f.id, f.name, f.photo_url, f.nationality,
           SUM(cs.goals) as stat,
           ${HINT_CLUB_SUBQUERY} as hint_club,
           ${HINT_WIKI_SUBQUERY} as hint_club_wiki_url,
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
    case 'midfielders':
      return positionQuery(buildPositionWhere(['%midfielder%']))

    case 'defenders':
      return positionQuery(buildPositionWhere([
        '%back%', '%defender%', '%sweeper%', '%centre-half%', '%center-half%',
      ]))

    case 'wingers':
      return positionQuery(buildPositionWhere(['%winger%', '%wide midfielder%', '%wide forward%']))

    case 'one-club':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               cs.club as hint_club,
               MAX(cs.club_wikipedia_url) as hint_club_wiki_url,
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

    case 'goals-300':
      return goalTotalQuery(300)

    case 'international':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               NULL as hint_club,
               NULL as hint_club_wiki_url,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'international'
        WHERE cs.goals IS NOT NULL
        GROUP BY f.id
        HAVING stat >= 100
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]

    case 'appearances':
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.apps) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
               ${HINT_WIKI_SUBQUERY} as hint_club_wiki_url,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.apps IS NOT NULL
        GROUP BY f.id
        HAVING stat >= 500
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]
  }
}

centurionsRouter.get(
  '/players',
  zValidator('query', z.object({ mode: z.enum(VALID_MODES) })),
  (c) => {
    const { mode } = c.req.valid('query')
    const players = queryForMode(mode)
    return c.json(players)
  }
)
