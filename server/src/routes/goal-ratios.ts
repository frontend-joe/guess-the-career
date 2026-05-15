import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'

export const goalRatiosRouter = new Hono()

interface GoalRatiosRow {
  id: number
  name: string
  nationality: string | null
  position: string | null
  custom_position: string | null
  main_club: string | null
  main_club_wikipedia_url: string | null
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
      SELECT f.id, f.name, f.nationality, f.position, f.custom_position,
             (
               SELECT cs2.club FROM career_stints cs2
               WHERE cs2.footballer_id = f.id
                 AND cs2.stint_type = 'senior'
                 AND cs2.apps IS NOT NULL
                 AND cs2.club NOT LIKE '→%'
               ORDER BY cs2.apps DESC LIMIT 1
             ) AS main_club,
             (
               SELECT cs2.club_wikipedia_url FROM career_stints cs2
               WHERE cs2.footballer_id = f.id
                 AND cs2.stint_type = 'senior'
                 AND cs2.apps IS NOT NULL
                 AND cs2.club NOT LIKE '→%'
               ORDER BY cs2.apps DESC LIMIT 1
             ) AS main_club_wikipedia_url,
             cs.years, cs.club, cs.apps, cs.goals
      FROM footballers f
      JOIN career_stints cs ON cs.footballer_id = f.id
      WHERE cs.stint_type = 'senior'
        AND cs.apps IS NOT NULL
        AND cs.goals IS NOT NULL
        AND cs.apps >= 3
        AND cs.goals >= cs.apps * 0.88
      ORDER BY f.name ASC, cs.sort_order ASC
    `,
    )
    .all() as GoalRatiosRow[]

  // Group stints by footballer
  const map = new Map<
    number,
    { id: number; name: string; nationality: string | null; position: string | null; mainClub: string | null; mainClubWikipediaUrl: string | null; stints: { years: string; club: string; apps: number; goals: number }[] }
  >()

  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, { id: row.id, name: row.name, nationality: row.nationality, position: row.custom_position ?? row.position, mainClub: row.main_club, mainClubWikipediaUrl: row.main_club_wikipedia_url, stints: [] })
    }
    map.get(row.id)!.stints.push({ years: row.years, club: row.club, apps: row.apps, goals: row.goals })
  }

  return c.json(Array.from(map.values()))
})
