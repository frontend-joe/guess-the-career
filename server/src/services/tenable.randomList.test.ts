import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A random list is a Tenable round with no ranking in it: a rule, a pool of
// players it is true of, and ten of them to name. The pool runs to two
// hundred, which is where a round built for a top ten comes apart — the list
// gets cut to the board's length and the rest of a correct pool turns into
// wrong answers.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'randomlist-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { answersForRound, impliedCluesFor, isOrdered, candidatesForType } = await import('./tenable.ts')
const rooms = await import('./gameRooms.ts')

// Forty giants, which is four boards' worth and well past ROUND_SIZE.
const GIANTS = 40
for (let i = 1; i <= GIANTS; i++) {
  sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality, position, height_cm)
       VALUES (?, ?, ?, 'England', 'Goalkeeper', ?)`,
    )
    .run(`Tall Person ${i}`, `Person ${i}`, `https://en.wikipedia.org/wiki/Tall_Person_${i}`, 197 + (i % 5))
}

const PARAMS = { listId: 'over-6ft5' }

test('a random list is an unordered round whose whole pool is the answer', () => {
  assert.equal(isOrdered('random-list', PARAMS), false)

  const answers = answersForRound('random-list', PARAMS, 'goals')
  assert.equal(answers.length, GIANTS, 'every giant is a right answer, not just ten of them')
  // The badge reads in feet and inches; the number behind it is still there to
  // sort by, because 6'6" does not compare.
  assert.match(answers[0].display!, /^\d+'\d+"$/)
  assert.equal(typeof answers[0].value, 'number')
})

test('the lists show up as rounds to pick', () => {
  const found = candidatesForType('random-list').find((c) => c.params.listId === 'over-6ft5')
  assert.ok(found, 'the list is offered as a round')
  assert.equal(found.answer_count, GIANTS)
  assert.equal(found.title, 'Players 6\'6" (197cm) and over')
})

test('a list that hands you the position does not sell it back as a clue', () => {
  assert.deepEqual(impliedCluesFor('random-list', { listId: 'fullbacks-6ft' }), ['position'])
  // And one that gives nothing away implies nothing.
  assert.deepEqual(impliedCluesFor('random-list', { listId: 'animal-names' }), [])
})

test('a clue is there for the whole pool, not just the first ten', () => {
  const roundId = (sqlite
    .prepare(
      `INSERT INTO tenable_rounds (category, type, params, metric, title, answer_count)
       VALUES ('football', 'random-list', ?, 'goals', 'Giants', ?) RETURNING id`,
    )
    .get(JSON.stringify(PARAMS), GIANTS) as { id: number }).id

  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get('randomlist-host@example.com') as { id: number }
  const room = rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
  const host = rooms.participantsOf(room.id)[0]
  const inst = rooms.freezeRound(room.id, roundId)
  rooms.startRound(room.id, inst.id)

  const clued = sqlite
    .prepare('SELECT COUNT(*) AS n FROM game_round_answers WHERE instance_id = ? AND clue_json IS NOT NULL')
    .get(inst.id) as { n: number }
  assert.equal(clued.n, GIANTS, 'everybody on the board can be clued')

  // Unordered, so the clue is about whoever is still missing rather than about
  // the slot that was tapped — and it has to be a real clue, not a blank.
  const hint = rooms.takeHint(inst.id, host, 1)
  assert.ok(hint.clue, 'the clue is not empty')
})

// A position string is a list in priority order, and reading the whole of it
// threw out the best answers on these boards. Fernando Hierro — "Defender,
// defensive midfielder", 127 career goals — is the first name anybody shouts
// at "scoring defenders", and was not a defender to it.
test('a defender who could also play midfield is still a defender', async () => {
  const { qualifyCandidate } = await import('./randomLists.ts')
  const base = {
    id: 0, name: 'Fernando Hierro', photo_url: null, nationality: 'Spain',
    height_cm: null, seniorGoals: 127, seniorApps: 600, englandCaps: 0, playedInEngland: false,
  }
  assert.ok(qualifyCandidate('defender-50-goals', { ...base, position: 'Defender, defensive midfielder' }))
  // What he was comes first; a midfielder who could fill in at the back is
  // still a midfielder.
  assert.equal(qualifyCandidate('defender-50-goals', { ...base, position: 'Defensive midfielder, defender' }), null)
  assert.ok(qualifyCandidate('midfield-100-goals', { ...base, position: 'Defensive midfielder, defender' }))
})

// An unordered board is the one board a late answer is entirely safe on —
// nothing is ranked, so nobody can be pushed off — and it was the only one
// refusing them.
test('a late answer joins an unordered board instead of being turned away', () => {
  // The same round the clue test picked; it is unique on (type, params, metric).
  const roundId = (sqlite
    .prepare("SELECT id FROM tenable_rounds WHERE type = 'random-list' AND params = ?")
    .get(JSON.stringify(PARAMS)) as { id: number }).id

  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get('latecomer-host@example.com') as { id: number }
  const room = rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
  const host = rooms.participantsOf(room.id)[0]
  const inst = rooms.freezeRound(room.id, roundId)
  rooms.startRound(room.id, inst.id)

  // Somebody the board never knew about, who qualifies for the list.
  sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality, position, height_cm)
       VALUES ('Late Giant', 'Giant', 'https://en.wikipedia.org/wiki/Late_Giant', 'England', 'Goalkeeper', 201)`,
    )
    .run()
  const guess = rooms.submitGuess(inst.id, host, 'late-1', 'Late Giant')

  assert.equal(guess.verdict, 'hit', 'the board takes him rather than calling him wrong')

  const board = rooms.roomState(rooms.roomByCode(room.code)!).round!.board
  assert.ok(board.revealed.some((r) => r.name === 'Late Giant'))
  // And nobody already on the board moved to make room, because there was
  // never an order to make room in.
  assert.equal(board.revealed.length, 1)
  assert.equal(board.guesses.find((g) => g.raw === 'Late Giant')!.verdict, 'hit')
})

// Ten slots under "Defenders with 50+ senior career goals" read as THE ten
// defenders, when it is any ten of forty-eight. "England Bundesliga players
// (most appearances)" read exactly the same way while being a strict top ten
// where the fourth-best name in the room is wrong. They are different games
// and the caption was the same either way.
test('a ranked round says it is ranked, and a pool round does not', async () => {
  const { titleFor } = await import('./tenable.ts')

  assert.equal(
    titleFor('random-list', PARAMS, 'goals', 'x'),
    'Players 6\'6" (197cm) and over',
    'any ten of a pool keeps its plain wording',
  )
  assert.equal(
    titleFor('nationality', { nationality: 'England', league: 'Bundesliga' }, 'apps', 'x'),
    'Top 10: England Bundesliga players (most appearances)',
  )

  // An authored title is somebody's own sentence and already says what it is.
  const slug = 'rivers'
  sqlite
    .prepare(
      `INSERT INTO general_rounds (slug, topic, title, ordered)
       VALUES (?, 'Geography', 'The 10 longest rivers in the world', 1)`,
    )
    .run(slug)
  assert.equal(
    titleFor('general', { round: slug }, 'goals', 'x'),
    'The 10 longest rivers in the world',
  )
})
