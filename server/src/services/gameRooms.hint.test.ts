import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// What the round tells Wikipedia about a name nobody has heard of.
//
// "Ivanovic" shouted at "Eastern European Chelsea players (most appearances)"
// went to the resolver with no hint at all, came back as a different Ivanović,
// and was correctly judged not to be on that board and discarded — so the
// guess was marked wrong, and typing "Branislav Ivanović" in full was the only
// way to get him. The round knew perfectly well it was a Chelsea round.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'hint-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()
const { hintFor } = await import('./gameRooms.ts')

let seq = 0
function roundAsking(params: Record<string, string>, rawNorm: string, status = 'pending'): void {
  seq += 1
  const { id: userId } = sqlite
    .prepare(`INSERT INTO users (email, password_hash) VALUES (?, 'x') RETURNING id`)
    .get(`host${seq}@example.com`) as { id: number }
  const { id: roomId } = sqlite
    .prepare(
      `INSERT INTO game_rooms (code, livekit_room, host_user_id) VALUES (?, ?, ?) RETURNING id`,
    )
    .get(`R${seq}`, `lk-${seq}`, userId) as { id: number }
  const { id: roundId } = sqlite
    .prepare(
      `INSERT INTO tenable_rounds (type, params, metric, title, answer_count)
       VALUES ('continent-club', ?, 'apps', 'a round', 10) RETURNING id`,
    )
    .get(JSON.stringify({ ...params, seq: String(seq) })) as { id: number }
  const { id: instanceId } = sqlite
    .prepare(
      `INSERT INTO game_round_instances
         (room_id, round_id, seq, type, params_json, metric, title, ordered)
       VALUES (?, ?, 1, 'continent-club', ?, 'apps', 'a round', 1) RETURNING id`,
    )
    .get(roomId, roundId, JSON.stringify(params)) as { id: number }
  sqlite
    .prepare(
      `INSERT INTO game_guess_reviews (instance_id, raw, raw_norm, status) VALUES (?, ?, ?, ?)`,
    )
    .run(instanceId, rawNorm, rawNorm, status)
}

test('a club round hands the resolver its club', () => {
  roundAsking({ continent: 'eastern-europe', club: 'Chelsea' }, 'ivanovic')
  assert.equal(hintFor('ivanovic'), 'Chelsea')
})

test('a two-club round hands over the first of them', () => {
  roundAsking({ clubA: 'Everton', clubB: 'Liverpool' }, 'cahill')
  assert.equal(hintFor('cahill'), 'Everton')
})

test('a league round has no club, so the league is the hint', () => {
  roundAsking({ continent: 'africa', league: 'Serie A' }, 'eto')
  assert.equal(hintFor('eto'), 'Serie A')
})

test('a round with neither hands over nothing rather than guessing', () => {
  roundAsking({ listId: 'defender-50-goals' }, 'hierro')
  assert.equal(hintFor('hierro'), '')
})

test('a name nobody asked about has no hint', () => {
  assert.equal(hintFor('nobodyaskedthis'), '')
})

test('only a pending review counts — a settled one is not still asking', () => {
  roundAsking({ club: 'Arsenal' }, 'settled', 'resolved')
  assert.equal(hintFor('settled'), '')
})
