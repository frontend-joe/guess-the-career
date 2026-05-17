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
  stat: number
  slot_key: string
}

const HINT_CLUB_SUBQUERY = `(
  SELECT club FROM career_stints
  WHERE footballer_id = f.id AND stint_type = 'senior' AND apps IS NOT NULL
  GROUP BY club ORDER BY SUM(apps) DESC LIMIT 1
)`

function buildPositionWhere(patterns: string[]): string {
  const clauses = patterns.map(p =>
    `(LOWER(f.position) LIKE '${p}' OR LOWER(f.all_positions) LIKE '${p}')`
  )
  return `(${clauses.join(' OR ')})`
}

function queryForMode(mode: Mode): CenturionPlayer[] {
  switch (mode) {
    case 'midfielders': {
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE ${buildPositionWhere(['%midfielder%'])}
          AND cs.goals IS NOT NULL
        GROUP BY f.id
        HAVING stat >= 100
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]
    }

    case 'defenders': {
      const where = buildPositionWhere([
        '%back%', '%defender%', '%sweeper%', '%centre-half%', '%center-half%',
      ])
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE ${where}
          AND cs.goals IS NOT NULL
        GROUP BY f.id
        HAVING stat >= 100
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]
    }

    case 'wingers': {
      const where = buildPositionWhere(['%winger%', '%wide midfielder%', '%wide forward%'])
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE ${where}
          AND cs.goals IS NOT NULL
        GROUP BY f.id
        HAVING stat >= 100
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]
    }

    case 'one-club': {
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               cs.club as hint_club,
               (CAST(f.id AS TEXT) || '|||' || cs.club) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.goals IS NOT NULL
        GROUP BY f.id, cs.club
        HAVING stat >= 100
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]
    }

    case 'goals-200': {
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.goals IS NOT NULL
        GROUP BY f.id
        HAVING stat >= 200 AND stat <= 299
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]
    }

    case 'goals-300': {
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'senior'
        WHERE cs.goals IS NOT NULL
        GROUP BY f.id
        HAVING stat >= 300
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]
    }

    case 'international': {
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.goals) as stat,
               (SELECT club FROM career_stints
                WHERE footballer_id = f.id AND stint_type = 'international' AND goals IS NOT NULL
                GROUP BY club ORDER BY SUM(goals) DESC LIMIT 1) as hint_club,
               CAST(f.id AS TEXT) as slot_key
        FROM footballers f
        JOIN career_stints cs ON cs.footballer_id = f.id AND cs.stint_type = 'international'
        WHERE cs.goals IS NOT NULL
        GROUP BY f.id
        HAVING stat >= 100
        ORDER BY stat DESC
      `).all() as CenturionPlayer[]
    }

    case 'appearances': {
      return sqlite.prepare(`
        SELECT f.id, f.name, f.photo_url, f.nationality,
               SUM(cs.apps) as stat,
               ${HINT_CLUB_SUBQUERY} as hint_club,
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
