import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'
import { TOP_CLUBS } from '../data/topClubs.ts'

export const whoPlayedMoreRouter = new Hono()

interface PlayerClubRow {
  id: number
  name: string
  wikipedia_url: string
  photo_url: string | null
  club: string
  club_apps: number
  club_wikipedia_url: string | null
}

// GET /api/who-played-more/session
// Returns 10 pairs of players who both played for the same club, sorted easy→hard
// (largest apps difference first). Accepts ?exclude=1,2,3 to avoid recently-seen players.
whoPlayedMoreRouter.get('/session', (c) => {
  const excludeIds = (c.req.query('exclude') ?? '')
    .split(',').map(Number).filter(n => n > 0)

  function fetchRows(withExclusion: boolean): PlayerClubRow[] {
    const clause = withExclusion && excludeIds.length > 0
      ? `AND f.id NOT IN (${excludeIds.map(() => '?').join(', ')})`
      : ''
    const params = withExclusion && excludeIds.length > 0 ? excludeIds : []
    return sqlite.prepare(`
      SELECT f.id, f.name, f.wikipedia_url, f.photo_url,
             cs.club, SUM(cs.apps) AS club_apps,
             MAX(cs.club_wikipedia_url) AS club_wikipedia_url
      FROM footballers f
      JOIN career_stints cs ON cs.footballer_id = f.id
      WHERE cs.stint_type = 'senior'
        AND cs.apps IS NOT NULL
        ${clause}
      GROUP BY f.id, cs.club
      HAVING club_apps > 0
    `).all(...params) as PlayerClubRow[]
  }

  function buildPairs(rows: PlayerClubRow[]) {
    // Group players by club — only top clubs, no B/reserve teams
    const byClub = new Map<string, PlayerClubRow[]>()
    for (const row of rows) {
      if (!TOP_CLUBS.has(row.club.toLowerCase().trim())) continue
      const list = byClub.get(row.club) ?? []
      list.push(row)
      byClub.set(row.club, list)
    }

    // Generate all valid pairs within each club
    interface Pair {
      player1: PlayerClubRow
      player2: PlayerClubRow
      club: string
      diff: number
    }
    const allPairs: Pair[] = []
    for (const [club, players] of byClub) {
      if (players.length < 2) continue
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          allPairs.push({
            player1: players[i],
            player2: players[j],
            club,
            diff: Math.abs(players[i].club_apps - players[j].club_apps),
          })
        }
      }
    }

    function shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }

    function greedyPick(pool: Pair[]): Pair[] {
      const usedIds = new Set<number>()
      const selected: Pair[] = []
      for (const pair of pool) {
        if (selected.length === 10) break
        if (usedIds.has(pair.player1.id) || usedIds.has(pair.player2.id)) continue
        usedIds.add(pair.player1.id)
        usedIds.add(pair.player2.id)
        selected.push(pair)
      }
      // Sort selected pairs easy→hard (largest diff first)
      return selected.sort((a, b) => b.diff - a.diff)
    }

    // Prefer pairs within 50 apps of each other; fall back to ≤200 then all.
    // Shuffle each pool first so we get different pairs every session.
    const pools = [
      shuffle(allPairs.filter(p => p.diff <= 50)),
      shuffle(allPairs.filter(p => p.diff <= 200)),
      shuffle([...allPairs]),
    ]

    for (const pool of pools) {
      const selected = greedyPick(pool)
      if (selected.length === 10) return selected
    }

    return greedyPick(shuffle([...allPairs]))
  }

  let pairs = buildPairs(fetchRows(true))
  if (pairs.length < 10) pairs = buildPairs(fetchRows(false))
  if (pairs.length < 10) return c.json({ error: 'Not enough eligible player pairs' }, 422)

  function toPlayer(row: PlayerClubRow) {
    return { id: row.id, name: row.name, wikipedia_url: row.wikipedia_url, photo_url: row.photo_url, apps: row.club_apps }
  }

  // Randomly assign which player in each pair is shown first (so correct answer isn't always player2)
  const result = pairs.map(({ player1, player2, club }) => {
    const flip = Math.random() < 0.5
    return {
      player1: flip ? toPlayer(player2) : toPlayer(player1),
      player2: flip ? toPlayer(player1) : toPlayer(player2),
      club,
      club_wikipedia_url: player1.club_wikipedia_url ?? player2.club_wikipedia_url ?? null,
    }
  })

  return c.json({ pairs: result })
})
