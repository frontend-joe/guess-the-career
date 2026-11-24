import { test } from 'node:test'
import assert from 'node:assert/strict'
import { positionBuckets, positionBucketKey } from './positions.ts'

const buckets = (custom: string | null, position: string | null) =>
  positionBuckets(custom, position)

test('the whole field counts, not the first word of it', () => {
  // Bergkamp belongs on the forwards board and on the midfielders board. A
  // round that read only the first word would leave him off one of them,
  // and that is the entire point of the round type.
  assert.deepEqual(buckets(null, 'Forward, attacking midfielder'), ['midfielder', 'forward'])
  assert.deepEqual(buckets(null, 'Centre-back, defensive midfielder'), ['defender', 'midfielder'])
  assert.deepEqual(buckets(null, 'Midfielder, sweeper'), ['defender', 'midfielder'])
})

test('the spellings nobody agreed on all land in one place', () => {
  for (const spelling of ['Centre-back', 'Centre back', 'Center-back', 'Central defender', 'Sweeper']) {
    assert.deepEqual(buckets(null, spelling), ['defender'], spelling)
  }
  for (const spelling of ['Left back', 'Left-back', 'Full-back', 'Left wing-back', 'Wingback']) {
    assert.deepEqual(buckets(null, spelling), ['defender'], spelling)
  }
  for (const spelling of ['Striker', 'Second striker', 'Centre forward', 'Centre-forward', 'Inside forward']) {
    assert.deepEqual(buckets(null, spelling), ['forward'], spelling)
  }
})

test('a winger is a forward', () => {
  // A room naming forwards will shout them. The ones who were really wide
  // midfielders are nearly always written as both, so they reach the
  // midfield board through their other entry.
  assert.deepEqual(buckets(null, 'Winger'), ['forward'])
  assert.deepEqual(buckets(null, 'Attacking midfielder, winger'), ['midfielder', 'forward'])
})

test('a hand-corrected position wins outright', () => {
  // Somebody looked at this player and fixed the scrape. Reading the old
  // answer as well would undo the correction.
  assert.deepEqual(buckets('Centre Back', 'Striker'), ['defender'])
  assert.deepEqual(buckets('Goalkeeper', 'Striker'), ['goalkeeper'])
})

test('pitch order, not the order the infobox happened to use', () => {
  // Two players whose infoboxes disagree about where to start must still
  // produce the same key, or the LIKE in the round SQL is matching noise.
  assert.equal(
    positionBucketKey(null, 'Forward, Midfielder, Defender'),
    positionBucketKey(null, 'Defender, Midfielder, Forward'),
  )
  assert.equal(positionBucketKey(null, 'Striker, Centre-back'), '|defender|forward|')
})

test('a goalkeeper is only ever a goalkeeper', () => {
  // Nothing on file mixes the two today. The rule is here because
  // all_positions is full of exactly that mistake — Seaman and Neuer as
  // centre-backs, Buffon as a winger — and a rescrape could put it in the
  // column this module does read.
  assert.deepEqual(buckets(null, 'Goalkeeper'), ['goalkeeper'])
  assert.deepEqual(buckets(null, 'Goalkeeper, Centre-back'), ['goalkeeper'])
})

test('Petr Cech keeps goal despite his other sport', () => {
  // His infobox says Goaltender because he also plays ice hockey. Mapped
  // rather than corrected in his row, since the next scrape would put it
  // back.
  assert.deepEqual(buckets(null, 'Goaltender'), ['goalkeeper'])
})

test('a position that is not football at all buckets to nothing', () => {
  // A rugby prop and an American footballer, both scraped by mistake. A
  // bucket would make them eligible for a board rather than leave them
  // visible as the errors they are.
  assert.deepEqual(buckets(null, 'Prop'), [])
  assert.deepEqual(buckets(null, 'Defensive end'), [])
  assert.equal(positionBucketKey(null, null), '')
  assert.equal(positionBucketKey(null, ''), '')
})

test('the key is delimited so one bucket cannot match inside another', () => {
  assert.equal(positionBucketKey(null, 'Goalkeeper'), '|goalkeeper|')
  assert.equal(positionBucketKey(null, 'Midfielder'), '|midfielder|')
})
