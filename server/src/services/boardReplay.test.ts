import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reduceEvents, type ReplayEvent } from './boardReplay.ts'

// reduceEvents draws both the live board and the board track of the recorded
// video. A bug here corrupts recordings that cannot be re-recorded, and it
// would not be noticed for days — hence tests on a file with no other.

const ev = (seq: number, t_ms: number, type: string, payload: unknown, actor: number | null = null): ReplayEvent => ({
  seq, t_ms, type, actor_participant_id: actor, payload: JSON.stringify(payload),
})

const LOG: ReplayEvent[] = [
  ev(1, 0, 'round_start', { title: 'Z surnames', target: 10, ordered: true, metric: 'apps', impliedClues: ['surname'] }),
  ev(2, 1000, 'guess', { raw: 'Zanetti', verdict: 'hit', matchedRank: 1 }, 7),
  ev(3, 1000, 'reveal', { rank: 1, name: 'Javier Zanetti', value: 615, unit: null }, 7),
  ev(4, 2500, 'guess', { raw: 'Nobody', verdict: 'miss', matchedRank: null }, 7),
  ev(5, 4000, 'guess', { raw: 'Zola', verdict: 'hit', matchedRank: 6 }, 7),
  ev(6, 4000, 'reveal', { rank: 6, name: 'Gianfranco Zola', value: 229, unit: null }, 7),
  ev(7, 9000, 'round_end', { reason: 'complete' }),
]

test('folds the log into a board', () => {
  const s = reduceEvents(LOG)
  assert.equal(s.title, 'Z surnames')
  assert.equal(s.target, 10)
  assert.deepEqual(s.impliedClues, ['surname'])
  assert.deepEqual(s.revealed.map((r) => r.rank), [1, 6])
  assert.equal(s.guesses.length, 3)
  assert.deepEqual(s.ended, { reason: 'complete', tMs: 9000 })
})

test('untilMs gives the board as it stood at that moment', () => {
  assert.equal(reduceEvents(LOG, 500).revealed.length, 0)
  assert.equal(reduceEvents(LOG, 1000).revealed.length, 1)
  assert.equal(reduceEvents(LOG, 3999).revealed.length, 1)
  assert.equal(reduceEvents(LOG, 4000).revealed.length, 2)
  assert.equal(reduceEvents(LOG, 8999).ended, null)
})

test('a clue appears when it was taken, not from the start', () => {
  const log = [
    LOG[0],
    ev(2, 3000, 'hint', { rank: 4, clue: { nationality: 'Italy', position: 'Defender' } }, 7),
  ]
  assert.deepEqual(reduceEvents(log, 2999).hints, [])
  const [hint] = reduceEvents(log).hints
  assert.equal(hint.rank, 4)
  assert.equal(hint.tMs, 3000)
  assert.deepEqual(hint.clue, { nationality: 'Italy', position: 'Defender' })
})

test('a hint with no clue recorded does not break the fold', () => {
  const out = reduceEvents([LOG[0], ev(2, 100, 'hint', { rank: 3, clue: null })])
  assert.deepEqual(out.hints, [{ rank: 3, clue: null, tMs: 100 }])
})

test('revealed rows come back in rank order, not reveal order', () => {
  const out = reduceEvents([
    LOG[0],
    ev(2, 1000, 'reveal', { rank: 9, name: 'Ninth' }),
    ev(3, 2000, 'reveal', { rank: 2, name: 'Second' }),
  ])
  assert.deepEqual(out.revealed.map((r) => r.rank), [2, 9])
})

test('input order does not matter — (t_ms, seq) is the total order', () => {
  const shuffled = [LOG[4], LOG[0], LOG[6], LOG[2], LOG[5], LOG[1], LOG[3]]
  assert.deepEqual(reduceEvents(shuffled), reduceEvents(LOG))
})

test('is pure: the same input twice gives the same board', () => {
  assert.deepEqual(reduceEvents(LOG), reduceEvents(LOG))
})

test('unknown event types and bad payloads are survivable', () => {
  const out = reduceEvents([
    LOG[0],
    ev(2, 10, 'recording_start', { slot: 1 }),
    { seq: 3, t_ms: 20, type: 'reveal', actor_participant_id: null, payload: 'not json' },
    LOG[2],
  ])
  // The malformed reveal degrades to rank 0 rather than throwing; the real
  // reveal still lands. Losing a frame beats losing the whole recording.
  assert.equal(out.revealed.length, 2)
  assert.equal(out.title, 'Z surnames')
})
