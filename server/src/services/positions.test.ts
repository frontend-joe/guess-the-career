import { test } from 'node:test'
import assert from 'node:assert/strict'
import { positionBuckets, positionBucketKey } from './positions.ts'

const buckets = (custom: string | null, all: string | null, position: string | null) =>
  positionBuckets(custom, all, position)

test('the whole position list counts, not the first entry', () => {
  // Bergkamp belongs on the forwards board and on the midfielders board. A
  // round that read only the first word would leave him off one of them,
  // and that is the entire point of the round type.
  assert.deepEqual(
    buckets(null, 'Second striker, Attacking midfielder, Forward, Midfielder', null),
    ['midfielder', 'forward'],
  )
})

test('the spellings nobody agreed on all land in one place', () => {
  for (const spelling of ['Centre-back', 'Centre back', 'Center-back', 'Central defender', 'Sweeper']) {
    assert.deepEqual(buckets(null, null, spelling), ['defender'], spelling)
  }
  for (const spelling of ['Left back', 'Left-back', 'Full-back', 'Left wing-back', 'Wingback']) {
    assert.deepEqual(buckets(null, null, spelling), ['defender'], spelling)
  }
})

test('a winger is a forward', () => {
  // A room naming forwards will shout them. The ones who were really wide
  // midfielders are nearly always written as both, so they reach the
  // midfield board through their other entry.
  assert.deepEqual(buckets(null, null, 'Winger'), ['forward'])
  assert.deepEqual(buckets(null, 'Attacking midfielder, Winger', null), ['midfielder', 'forward'])
})

test('a hand-corrected position wins outright', () => {
  // Somebody looked at this player and fixed the scrape. Folding the old
  // answer back in would undo the correction.
  assert.deepEqual(
    buckets('Centre Back', 'Striker, Forward', 'Striker'),
    ['defender'],
  )
})

test('the two scraped fields are unioned, because neither contains the other', () => {
  // all_positions is richer on 1,700 players and absent on 1,534; position
  // carries a token all_positions lacks on 428, Matthäus's sweeper among
  // them.
  assert.deepEqual(
    buckets(null, 'Centre-back, Defensive midfielder, Central midfielder, Midfielder', 'Midfielder, sweeper'),
    ['defender', 'midfielder'],
  )
})

test('pitch order, not the order the infobox happened to use', () => {
  // Two players whose infoboxes disagree about where to start must still
  // produce the same key, or the LIKE in the round SQL is matching noise.
  assert.equal(
    positionBucketKey(null, 'Forward, Midfielder, Defender', null),
    positionBucketKey(null, 'Defender, Midfielder, Forward', null),
  )
  assert.equal(
    positionBucketKey(null, 'Striker, Centre-back', null),
    '|defender|forward|',
  )
})

test('a position that is not football at all buckets to nothing', () => {
  // A rugby prop and an American footballer, both scraped by mistake. A
  // bucket would make them eligible for a board rather than leave them
  // visible as the errors they are.
  assert.deepEqual(buckets(null, null, 'Prop'), [])
  assert.deepEqual(buckets(null, null, 'Defensive end'), [])
  assert.equal(positionBucketKey(null, null, null), '')
  assert.equal(positionBucketKey(null, null, ''), '')
})

test('the key is delimited so one bucket cannot match inside another', () => {
  // Nothing in the four is a prefix of another today. A key that only works
  // because of the words chosen is a trap for whoever adds the fifth.
  assert.equal(positionBucketKey(null, null, 'Goalkeeper'), '|goalkeeper|')
  assert.ok(positionBucketKey(null, null, 'Goalkeeper').includes('|goalkeeper|'))
})

// Keeping goal is the one job that is exclusive, and all_positions does not
// know it — in either direction.
test('an outfielder all_positions calls a goalkeeper is not one', () => {
  // Ronaldo, Scholes, Drogba, Puyol, Neymar: sixteen of them, picked up from
  // somewhere on a long article. The primary field was right every time.
  // The midfielder is all_positions being generous about Ronaldo, which is
  // its habit and harmless here: a longer pool on a name-any-10 board means
  // more answers accepted, not more wrong ones demanded. The goalkeeper is
  // the one that had to go.
  assert.deepEqual(
    buckets(null, 'Goalkeeper, Winger, Striker, Forward, Midfielder', 'Striker'),
    ['midfielder', 'forward'],
  )
  assert.deepEqual(
    buckets(null, 'Goalkeeper, Striker, Forward, Midfielder', 'Midfielder, centre-forward'),
    ['midfielder', 'forward'],
  )
})

test('a goalkeeper is only a goalkeeper', () => {
  // The other direction, and the same mistake: all_positions gives Seaman
  // and Neuer "Centre-back" and Buffon "Winger", which would have put
  // thirty-three keepers on defender and forward boards.
  assert.deepEqual(buckets(null, 'Goalkeeper, Centre-back', 'Goalkeeper'), ['goalkeeper'])
  assert.deepEqual(buckets(null, 'Goalkeeper, Centre-back, Winger', 'Goalkeeper'), ['goalkeeper'])
  // Even when all_positions forgets the goalkeeping entirely — Taffarel is
  // down as a forward there.
  assert.deepEqual(buckets(null, 'Forward', 'Goalkeeper'), ['goalkeeper'])
})

test('Petr Cech keeps goal despite his other sport', () => {
  // His infobox says Goaltender because he also plays ice hockey. Mapped
  // rather than corrected in his row, because the next scrape would put it
  // back.
  assert.deepEqual(buckets(null, 'Goalkeeper, Centre-back, Striker', 'Goaltender'), ['goalkeeper'])
})

test('a hand-corrected goalkeeper still wins outright', () => {
  assert.deepEqual(buckets('Goalkeeper', 'Striker, Forward', 'Striker'), ['goalkeeper'])
})
