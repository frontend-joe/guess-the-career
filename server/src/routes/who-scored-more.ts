import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'

export const whoScoredMoreRouter = new Hono()

// GET /api/who-scored-more/session
// Returns 10 random attacking players (forwards, strikers, wingers) with total senior career goals
whoScoredMoreRouter.get('/session', (c) => {
  const players = sqlite.prepare(`
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
    GROUP BY f.id
    HAVING total_goals > 0
    ORDER BY RANDOM()
    LIMIT 11
  `).all() as { id: number; name: string; wikipedia_url: string; total_goals: number }[]

  if (players.length < 11) {
    return c.json({ error: 'Not enough eligible attacking players' }, 422)
  }

  return c.json(players)
})
