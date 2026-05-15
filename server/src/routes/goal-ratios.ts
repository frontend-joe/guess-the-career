import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'

export const goalRatiosRouter = new Hono()

interface GoalRatiosRow {
  id: number
  name: string
  nationality: string | null
  years: string
  club: string
  apps: number
  goals: number
}

// GET /api/goal-ratios/players
goalRatiosRouter.get('/players', (c) => {
  const rows = sqlite
    .prepare(
      `
      SELECT f.id, f.name, f.nationality,
             cs.years, cs.club, cs.apps, cs.goals
      FROM footballers f
      JOIN career_stints cs ON cs.footballer_id = f.id
      WHERE cs.stint_type = 'senior'
        AND cs.apps IS NOT NULL
        AND cs.goals IS NOT NULL
        AND cs.apps >= 3
        AND cs.goals > cs.apps
      ORDER BY f.name ASC, cs.sort_order ASC
    `,
    )
    .all() as GoalRatiosRow[]

  // Group stints by footballer
  const map = new Map<
    number,
    { id: number; name: string; nationality: string | null; stints: { years: string; club: string; apps: number; goals: number }[] }
  >()

  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, { id: row.id, name: row.name, nationality: row.nationality, stints: [] })
    }
    map.get(row.id)!.stints.push({ years: row.years, club: row.club, apps: row.apps, goals: row.goals })
  }

  return c.json(Array.from(map.values()))
})
