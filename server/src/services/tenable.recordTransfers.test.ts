import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A throwaway database, chosen BEFORE db/client is imported — it reads
// DATABASE_PATH once, at import. Same trick as general.test.ts.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'record-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { candidatesForType, answersForRound, moveCluesFor, isOrdered, titleFor } =
  await import('./tenable.ts')

// Two clubs per game: one with a full board, one deliberately short.
function seed(tables: 'record_signings' | 'record_sales') {
  const club = sqlite.prepare(
    `INSERT INTO ${tables}_clubs (club, source_url, active) VALUES (?, ?, ?)`,
  )
  const player = sqlite.prepare(
    `INSERT INTO ${tables}_players
       (club_id, player_name, nationality, position, from_club, fee_text, fee_value, season_label, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  const full = Number(club.run('Rangers FC', `${tables}:rangers`, 1).lastInsertRowid)
  // Inserted cheapest-first, so an ordering bug cannot pass by accident.
  for (let i = 1; i <= 10; i++) {
    player.run(full, `Player ${i}`, 'Scotland', 'Forward', `Selling Club ${i}`,
      `€${i}.00m`, i * 1_000_000, `201${i % 10}/201${(i % 10) + 1}`, i)
  }
  // An unpriced row is not an answer, and must not count towards the ten.
  player.run(full, 'Unpriced Man', 'Scotland', 'Forward', 'Someone', null, null, '2000/2001', 99)

  const short = Number(club.run('Thin Pickings', `${tables}:thin`, 1).lastInsertRowid)
  for (let i = 1; i <= 9; i++) {
    player.run(short, `Thin ${i}`, 'Wales', 'Defender', 'Elsewhere', '€1.00m', 1_000_000, '2010/2011', i)
  }

  const retired = Number(club.run('Switched Off', `${tables}:off`, 0).lastInsertRowid)
  for (let i = 1; i <= 10; i++) {
    player.run(retired, `Off ${i}`, 'England', 'Keeper', 'Elsewhere', '€1.00m', 1_000_000, '2010/2011', i)
  }

  return { full, short, retired }
}

const signings = seed('record_signings')
const sales = seed('record_sales')

test('a club needs ten PRICED transfers to be a round', () => {
  for (const slug of ['record-signings', 'record-sales']) {
    const clubs = candidatesForType(slug).map((c) => c.params.club)
    assert.deepEqual(clubs, ['Rangers FC'])
    // Ten, not eleven: the unpriced row is in the table and not on the board.
    assert.equal(candidatesForType(slug)[0].answer_count, 10)
  }
})

test("the title drops a suffix nobody says out loud", () => {
  const params = { clubId: String(signings.full), club: 'Rangers FC' }
  // A ranked round says it is ranked. The label carries a colon because these
  // titles are possessive, and "Top 10 Rangers' record signings" is not
  // English.
  assert.equal(titleFor('record-signings', params, 'goals', 'x'), "Top 10: Rangers' record signings")
  assert.equal(titleFor('record-sales', params, 'goals', 'x'), "Top 10: Rangers' biggest sales")
  // And a club that does not end in s keeps its apostrophe-s.
  assert.equal(titleFor('record-signings', { club: 'Arsenal' }, 'goals', 'x'), "Top 10: Arsenal's record signings")
})

test('the board is the priced transfers, most expensive first', () => {
  const answers = answersForRound('record-signings', { clubId: String(signings.full) }, 'goals', 50)
  assert.equal(answers.length, 10)
  assert.deepEqual(answers.map((a) => a.name), [
    'Player 10', 'Player 9', 'Player 8', 'Player 7', 'Player 6',
    'Player 5', 'Player 4', 'Player 3', 'Player 2', 'Player 1',
  ])
  assert.equal(answers[0].value, 10_000_000)
  // 'fee' is what tells both apps to draw the badge as money rather than a
  // count, so it is load-bearing rather than decoration.
  assert.equal(answers[0].unit, 'fee')
  // Ranked by one source that already ranked it.
  assert.equal(isOrdered('record-signings'), true)
  assert.equal(isOrdered('record-sales'), true)
  // Asking deeper than the data goes gets the data, not an error. There is no
  // eleventh row to be a near miss with.
  assert.equal(answersForRound('record-signings', { clubId: String(signings.full) }, 'goals', 50).length, 10)
})

// The one thing here that is easy to get backwards, and silently: both tables
// keep the other club in `from_club`, so the direction is decided by the type
// rather than by the column. Get it wrong and a sales round's hint says a
// player was bought FROM the club that bought them.
test('a signing came from the other club, a sale went to it', () => {
  const bought = moveCluesFor('record-signings', { clubId: String(signings.full) })!
  const b = bought.get('player 10')!
  assert.equal(b.fromClub, 'Selling Club 10')
  assert.equal(b.toClub, null)

  const sold = moveCluesFor('record-sales', { clubId: String(sales.full) })!
  const s = sold.get('player 10')!
  assert.equal(s.toClub, 'Selling Club 10')
  assert.equal(s.fromClub, null)
})

test('a move clue describes the move, not the career', () => {
  const clues = moveCluesFor('record-signings', { clubId: String(signings.full) })!
  const c = clues.get('player 7')!
  // The written fee, since that is the number people remember.
  assert.equal(c.fee, '€7.00m')
  // The season rides in `years`, which is the label both apps already draw; a
  // single transfer has no career span to put there.
  assert.equal(c.years, '2017/2018')
  assert.equal(c.nationality, 'Scotland')
  // Career fields are deliberately empty: the club they played most for is
  // true of the player and no help with the question.
  assert.equal(c.club, null)
  assert.equal(c.squadNumber, null)
  assert.equal(c.born, null)
})

test('a round that is not about a move has no move clues', () => {
  assert.equal(moveCluesFor('club', { club: 'Arsenal' }), null)
  // Nor one of ours with no club to look up.
  assert.equal(moveCluesFor('record-signings', {}), null)
})
