import { Hono } from 'hono'
import { sqlite } from '../db/client.ts'

export const guessTheXiRouter = new Hono()

interface MatchRow {
  id: number
  name: string
  year: number
  competition: string
  home_team: string
  away_team: string
  home_team_active: number
  away_team_active: number
}

interface PlayerRow {
  id: number
  name: string
  position: string
  squad_number: number | null
  nationality: string | null
}

guessTheXiRouter.get('/session', (c) => {
  const excludeParam = c.req.query('exclude') ?? ''
  const excludeIds = excludeParam
    .split(',')
    .map(Number)
    .filter(n => n > 0)

  function fetchCandidates(withExclusion: boolean): MatchRow[] {
    const clause = withExclusion && excludeIds.length > 0
      ? `AND id NOT IN (${excludeIds.map(() => '?').join(', ')})`
      : ''
    const params = withExclusion ? excludeIds : []
    return sqlite.prepare(`
      SELECT id, name, year, competition, home_team, away_team, home_team_active, away_team_active
      FROM xi_matches
      WHERE (home_team_active = 1 OR away_team_active = 1)
      AND (
        SELECT COUNT(*) FROM xi_players WHERE match_id = xi_matches.id
      ) >= 22
      ${clause}
      ORDER BY RANDOM()
      LIMIT 30
    `).all(...params) as MatchRow[]
  }

  function pickRounds(candidates: MatchRow[]): { match: MatchRow; team: string }[] {
    const usedTeams = new Set<string>()
    const picked: { match: MatchRow; team: string }[] = []
    for (const match of candidates) {
      if (picked.length === 5) break
      const activePicks: string[] = []
      if (match.home_team_active && !usedTeams.has(match.home_team)) activePicks.push(match.home_team)
      if (match.away_team_active && !usedTeams.has(match.away_team)) activePicks.push(match.away_team)
      if (activePicks.length === 0) continue
      const team = activePicks[Math.floor(Math.random() * activePicks.length)]
      usedTeams.add(team)
      picked.push({ match, team })
    }
    return picked
  }

  let picked = pickRounds(fetchCandidates(true))
  if (picked.length < 5) picked = pickRounds(fetchCandidates(false))

  if (picked.length < 5) {
    return c.json(
      { error: 'Not enough matches in database', needed: 5, found: picked.length },
      422
    )
  }

  const rounds = picked.map(({ match, team }) => {
    const players = sqlite.prepare(`
      SELECT xp.id, xp.name, xp.position, xp.squad_number, f.nationality
      FROM xi_players xp
      LEFT JOIN footballers f ON xp.footballer_id = f.id
      WHERE xp.match_id = ? AND xp.team = ?
      ORDER BY
        CASE xp.position WHEN 'GK' THEN 1 WHEN 'DF' THEN 2 WHEN 'MF' THEN 3 WHEN 'FW' THEN 4 ELSE 5 END,
        CASE WHEN xp.squad_number IS NULL THEN 1 ELSE 0 END,
        xp.squad_number ASC
      LIMIT 11
    `).all(match.id, team) as PlayerRow[]

    const clubRow = sqlite.prepare(
      `SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`
    ).get(team) as { wikipedia_url: string | null } | undefined

    return {
      matchId: match.id,
      matchName: match.name,
      year: match.year,
      competition: match.competition,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      team,
      teamWikipediaUrl: clubRow?.wikipedia_url ?? null,
      players: players.map(p => ({
        id: p.id,
        position: p.position,
        squadNumber: p.squad_number,
        nationality: p.nationality ?? null,
      })),
      playerNames: players.map(p => p.name),
    }
  })

  return c.json(rounds)
})
