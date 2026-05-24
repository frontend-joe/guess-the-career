import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'

export const honorGameRouter = new Hono()

interface HonorColumn {
  key: string
  label: string
  col: string
}

const HONOR_COLUMNS: HonorColumn[] = [
  { key: 'champions_league', label: 'UEFA Champions League',   col: 'honors_champions_league' },
  { key: 'fa_cup',           label: 'FA Cup',                  col: 'honors_fa_cup' },
  { key: 'league_cup',       label: 'League Cup',              col: 'honors_league_cup' },
  { key: 'club_world_cup',   label: 'Club World Cup',          col: 'honors_club_world_cup' },
  { key: 'world_cup',        label: 'FIFA World Cup',          col: 'honors_world_cup' },
  { key: 'euros',            label: 'European Championship',   col: 'honors_euros' },
  { key: 'copa_america',     label: 'Copa América',            col: 'honors_copa_america' },
  { key: 'ballon_dor',       label: "Ballon d'Or",             col: 'honors_ballon_dor' },
  { key: 'world_player',     label: 'World Player of the Year', col: 'honors_world_player' },
]

interface HonorPlayer {
  id: number
  name: string
  wikipedia_url: string
  photo_url: string | null
  count: number
}

interface HonorQuestion {
  honor_key: string
  honor_label: string
  player1: HonorPlayer
  player2: HonorPlayer
}

/** Shuffle an array in place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * GET /api/honor-game/session?exclude=1,2,3
 *
 * Returns 10 HonorQuestion objects. For each question a trophy category is
 * picked at random and two players with different win counts for that trophy
 * are selected. Player IDs in ?exclude are avoided where possible.
 */
honorGameRouter.get('/session', (c) => {
  const excludeIds = (c.req.query('exclude') ?? '')
    .split(',').map(Number).filter(n => n > 0)

  function getPlayersForColumn(col: string, withExclusion: boolean): HonorPlayer[] {
    const exclusionClause = withExclusion && excludeIds.length > 0
      ? `AND id NOT IN (${excludeIds.join(',')})`
      : ''
    return sqlite.prepare(`
      SELECT id, name, wikipedia_url, photo_url, ${col} AS count
      FROM footballers
      WHERE ${col} > 0
        ${exclusionClause}
      ORDER BY RANDOM()
    `).all() as HonorPlayer[]
  }

  // Build a map of available columns → player pools
  function buildPools(withExclusion: boolean): Map<HonorColumn, HonorPlayer[]> {
    const pools = new Map<HonorColumn, HonorPlayer[]>()
    for (const hc of HONOR_COLUMNS) {
      const players = getPlayersForColumn(hc.col, withExclusion)
      // Need at least 2 players with different counts to form a valid question
      const counts = new Set(players.map(p => p.count))
      if (counts.size >= 2) pools.set(hc, players)
    }
    return pools
  }

  let pools = buildPools(true)
  if (pools.size === 0) pools = buildPools(false)
  if (pools.size === 0) {
    return c.json({ error: 'Not enough honour data — rescrape some players first.' }, 422)
  }

  const availableColumns = [...pools.keys()]
  const questions: HonorQuestion[] = []

  // Build 10 questions, cycling through available categories
  const shuffledCols = shuffle([...availableColumns])
  let colIdx = 0

  for (let i = 0; i < 10; i++) {
    // Cycle columns (with repetition if fewer than 10 available)
    const hc = shuffledCols[colIdx % shuffledCols.length]
    colIdx++

    const players = pools.get(hc)!
    // Pick two players with different counts
    let p1: HonorPlayer | null = null
    let p2: HonorPlayer | null = null

    for (let j = 0; j < players.length && !p2; j++) {
      if (!p1) { p1 = players[j]; continue }
      if (players[j].count !== p1.count) { p2 = players[j] }
    }

    if (!p1 || !p2) continue  // shouldn't happen given our pool filter, but be safe

    // Randomise which player appears on which side
    if (Math.random() < 0.5) [p1, p2] = [p2, p1]

    questions.push({
      honor_key:   hc.key,
      honor_label: hc.label,
      player1: p1,
      player2: p2,
    })
  }

  if (questions.length === 0) {
    return c.json({ error: 'Could not build any questions from available data.' }, 422)
  }

  return c.json(questions)
})
