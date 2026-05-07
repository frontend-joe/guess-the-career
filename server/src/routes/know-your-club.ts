import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'

export const knowYourClubRouter = new Hono()

interface ClubRow {
  id: number
  name: string
  wikipedia_url: string | null
  player_count: number
}

interface PlayerRow {
  id: number
  name: string
  photo_url: string
  nationality: string | null
}

// GET /api/know-your-club/clubs
// Returns all clubs with ≥10 footballers who have a confirmed photo_url
knowYourClubRouter.get('/clubs', (c) => {
  const clubs = sqlite.prepare(`
    SELECT c.id, c.name, c.wikipedia_url, COUNT(DISTINCT cs.footballer_id) AS player_count
    FROM clubs c
    JOIN career_stints cs ON cs.club = c.name
    JOIN footballers f ON cs.footballer_id = f.id
    WHERE f.photo_url IS NOT NULL
      AND cs.stint_type = 'senior'
    GROUP BY c.id, c.name
    HAVING player_count >= 10
    ORDER BY c.name ASC
  `).all() as ClubRow[]

  return c.json({
    clubs: clubs.map((club) => ({
      id: club.id,
      name: club.name,
      wikipediaUrl: club.wikipedia_url,
      playerCount: club.player_count,
    })),
  })
})

// GET /api/know-your-club/session?clubId=X
// Returns 10 random players with photos for the given club
knowYourClubRouter.get('/session', (c) => {
  const clubId = parseInt(c.req.query('clubId') ?? '')
  if (isNaN(clubId)) return c.json({ error: 'clubId required' }, 400)

  const club = sqlite.prepare(
    'SELECT id, name, wikipedia_url FROM clubs WHERE id = ?'
  ).get(clubId) as { id: number; name: string; wikipedia_url: string | null } | undefined

  if (!club) return c.json({ error: 'Club not found' }, 404)

  const players = sqlite.prepare(`
    SELECT DISTINCT f.id, f.name, f.photo_url, f.nationality
    FROM footballers f
    JOIN career_stints cs ON cs.footballer_id = f.id
    WHERE cs.club = ?
      AND cs.stint_type = 'senior'
      AND f.photo_url IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 10
  `).all(club.name) as PlayerRow[]

  if (players.length < 10) {
    return c.json({ error: 'Not enough players with photos for this club' }, 422)
  }

  const { player_count } = sqlite.prepare(`
    SELECT COUNT(DISTINCT f.id) AS player_count
    FROM footballers f
    JOIN career_stints cs ON cs.footballer_id = f.id
    WHERE cs.club = ?
      AND cs.stint_type = 'senior'
      AND f.photo_url IS NOT NULL
  `).get(club.name) as { player_count: number }

  return c.json({
    club: {
      id: club.id,
      name: club.name,
      wikipediaUrl: club.wikipedia_url,
      playerCount: player_count,
    },
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      photoUrl: p.photo_url,
      nationality: p.nationality,
    })),
  })
})
