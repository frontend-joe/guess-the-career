import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'

export const whoScoredMoreRouter = new Hono()

// GET /api/who-scored-more/session
// Returns 11 random attacking players (forwards, strikers) with total senior career goals.
// Accepts ?exclude=1,2,3 to avoid recently-seen player IDs; falls back to full pool if needed.
whoScoredMoreRouter.get('/session', (c) => {
  const excludeIds = (c.req.query('exclude') ?? '')
    .split(',').map(Number).filter(n => n > 0)

  function fetch(withExclusion: boolean) {
    const clause = withExclusion && excludeIds.length > 0
      ? `AND f.id NOT IN (${excludeIds.map(() => '?').join(', ')})`
      : ''
    const params = withExclusion && excludeIds.length > 0 ? excludeIds : []
    return sqlite.prepare(`
      SELECT f.id, f.name, f.wikipedia_url,
             SUM(cs.goals) AS total_goals
      FROM footballers f
      JOIN career_stints cs ON cs.footballer_id = f.id
      WHERE cs.stint_type = 'senior'
        AND cs.goals IS NOT NULL
        AND (
          LOWER(f.position) LIKE '%forward%'
          OR LOWER(f.position) LIKE '%striker%'
        )
        ${clause}
      GROUP BY f.id
      HAVING total_goals > 0
      ORDER BY RANDOM()
      LIMIT 11
    `).all(...params) as { id: number; name: string; wikipedia_url: string; total_goals: number }[]
  }

  let players = fetch(true)
  if (players.length < 11) players = fetch(false)
  if (players.length < 11) return c.json({ error: 'Not enough eligible attacking players' }, 422)

  return c.json(players)
})
