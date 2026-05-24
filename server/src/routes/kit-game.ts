import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'
import { randomUUID } from 'node:crypto'

export const kitGameRouter = new Hono()

interface KitQuestion {
  slug: string
  squad_number: number
  club_at_time: string
  footballer_id: number
  footballer_name: string
  photo_url: string | null
  home_body: string
  home_leftarm: string | null
  home_rightarm: string | null
  home_shorts: string | null
  home_socks: string | null
  home_pattern: string | null
  number_colour: string | null  // player-level override for the squad number colour
}

// GET /api/kit-game/question?exclude=1,2,3
kitGameRouter.get('/question', (c) => {
  const excludeParam = c.req.query('exclude') ?? ''
  const excludeIds = excludeParam
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n))

  const exclusionClause = excludeIds.length > 0
    ? `AND f.id NOT IN (${excludeIds.join(',')})`
    : ''

  const row = sqlite.prepare(`
    SELECT
      xp.squad_number,
      xp.club_at_time,
      f.id   AS footballer_id,
      f.name AS footballer_name,
      f.photo_url,
      c.home_body,
      c.home_leftarm,
      c.home_rightarm,
      c.home_shorts,
      c.home_socks,
      c.home_pattern,
      xp.number_colour
    FROM xi_players xp
    JOIN footballers f ON f.id = xp.footballer_id
    JOIN clubs c ON LOWER(c.name) = LOWER(COALESCE(NULLIF(TRIM(xp.club_at_time), ''), xp.team))
    JOIN xi_matches xm ON xm.id = xp.match_id
    WHERE xp.available_in_kits = 1
      AND xp.squad_number IS NOT NULL
      AND xp.footballer_id IS NOT NULL
      AND c.home_body IS NOT NULL
      ${exclusionClause}
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as Omit<KitQuestion, 'slug'> | undefined

  if (!row) return c.json(null)

  const question: KitQuestion = { ...row, slug: randomUUID() }
  return c.json(question)
})
