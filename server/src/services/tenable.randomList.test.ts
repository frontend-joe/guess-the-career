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
