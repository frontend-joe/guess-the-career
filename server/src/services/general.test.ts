import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A throwaway database, chosen BEFORE db/client is imported — it reads
// DATABASE_PATH once, at import. Everything below then runs against a freshly
// migrated file, which means these tests also check the seed migration itself:
// a typo in 0097 fails here rather than in a game.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'geo-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { matchesPlace, isPlaceExactly, norm } = await import('./nameMatch.ts')
const {
  generalRounds, generalAnswers, saveGeneralRound, deleteGeneralRound,
} = await import('./general.ts')
const { answersForRound, isOrdered, categoryOf, titleFor } = await import('./tenable.ts')

// ── The matcher ──────────────────────────────────────────────────────────────

test('a place matches its own name', () => {
  assert.equal(matchesPlace('Switzerland', 'Switzerland'), true)
  assert.equal(matchesPlace('  sWiTzErLaNd ', 'Switzerland'), true)
})

test('noise words are optional in either direction', () => {
  assert.equal(matchesPlace('Mt Everest', 'Everest'), true)
  assert.equal(matchesPlace('Everest', 'Mount Everest'), true)
  assert.equal(matchesPlace('Baikal', 'Lake Baikal'), true)
  assert.equal(matchesPlace('River Nile', 'Nile'), true)
})

test('an alias is accepted where no spelling rule could reach', () => {
  assert.equal(matchesPlace('Huang He', 'Yellow River', ['Huang He']), true)
  assert.equal(matchesPlace('Czech Republic', 'Czechia', ['Czech Republic']), true)
  assert.equal(matchesPlace('Huang He', 'Yellow River'), false)
})

test('one typo is forgiven, two on a long name', () => {
  assert.equal(matchesPlace('Switzerlnd', 'Switzerland'), true)
  assert.equal(matchesPlace('Madagascer', 'Madagascar'), true)
  // Two edits on an eleven-character name is a different word.
  assert.equal(matchesPlace('Switzrlnd', 'Switzerland'), false)
  assert.equal(matchesPlace('Saint Vincent and the Grenadins', 'Saint Vincent and the Grenadines'), true)
})

// This is the whole reason places do not go through matchesName: every
// assertion here passes that matcher, because a surname on its own is a
// perfectly good guess at a footballer and a terrible one at a place.
test('part of a place name is not the place', () => {
  assert.equal(matchesPlace('York', 'New York'), false)
  assert.equal(matchesPlace('Africa', 'South Africa'), false)
  assert.equal(matchesPlace('Korea', 'South Korea'), false)
  assert.equal(matchesPlace('Dakota', 'North Dakota'), false)
  assert.equal(matchesPlace('Guinea', 'New Guinea'), false)
})

test('nothing matches on three characters', () => {
  assert.equal(matchesPlace('Chad', 'Chad'), true)
  assert.equal(matchesPlace('Chat', 'Chad'), false)
})

// ── The seeded rounds ────────────────────────────────────────────────────────

test('the seed migration lands a playable set of rounds', () => {
  const rounds = generalRounds()
  assert.ok(rounds.length >= 20, `expected 20+ seeded rounds, got ${rounds.length}`)
  // Every one needs a registry row, or the game cannot be handed it: the
  // multiplayer freeze looks a round up in tenable_rounds, not here.
  for (const r of rounds) {
    assert.notEqual(r.roundId, null, `${r.slug} has no tenable_rounds row`)
    assert.ok(r.answerCount >= 10, `${r.slug} has only ${r.answerCount} answers`)
  }
})

test('a ranked round comes back in its authored order, with its badges', () => {
  const answers = answersForRound('general', { round: 'rivers-longest' }, 'goals', 10)
  assert.equal(answers.length, 10)
  assert.equal(answers[0].name, 'Nile')
  assert.equal(answers[0].display, '6,650')
  assert.equal(answers[0].unit, 'km')
  assert.equal(answers[9].name, 'Amur')
  // Descending by value is what makes the board a ranking rather than a list.
  const values = answers.map((a) => a.value)
  assert.deepEqual(values, [...values].sort((a, b) => b - a))
  assert.equal(isOrdered('general', { round: 'rivers-longest' }), true)
})

test('an unordered round is a pool bigger than the board', () => {
  const answers = answersForRound('general', { round: 'countries-s' }, 'goals', 100)
  assert.ok(answers.length > 10, `a pool of ${answers.length} is not a pool`)
  assert.equal(isOrdered('general', { round: 'countries-s' }), false)
  assert.ok(answers.some((a) => a.name === 'Spain'))
  // Every answer really does begin with the letter the question asks for.
  for (const a of answers) assert.match(a.name, /^S/)
})

test('aliases survive the trip out of the database', () => {
  const answers = answersForRound('general', { round: 'rivers-longest' }, 'goals', 10)
  const yellow = answers.find((a) => a.name === 'Yellow River')
  assert.ok(yellow)
  assert.ok(yellow.aliases?.includes('Huang He'))
})

test('an authored round knows which game it belongs to', () => {
  assert.equal(categoryOf('general'), 'general')
  assert.equal(categoryOf('surname-initial'), 'football')
  assert.equal(
    titleFor('general', { round: 'mountains-highest' }, 'goals', 'fallback'),
    'The 10 highest mountains in the world',
  )
})

// ── The editor ───────────────────────────────────────────────────────────────

test('saving a round creates it, its answers and its registry row', () => {
  const { slug, roundId } = saveGeneralRound({
    slug: 'Test Round!!',
    topic: 'seas',
    title: 'The 2 biggest oceans',
    ordered: true,
    unit: 'km²',
    answers: [
      { name: 'Pacific Ocean', aliases: ['Pacific'], value: 165250000, display: '165m' },
      { name: 'Atlantic Ocean', aliases: ['Atlantic'], value: 106460000, display: '106m' },
    ],
  })
  assert.equal(slug, 'test-round', 'a typed title should become a usable slug')
  const row = sqlite
    .prepare('SELECT category, params, title FROM tenable_rounds WHERE id = ?')
    .get(roundId) as { category: string; params: string; title: string }
  assert.equal(row.category, 'general')
  // The params are how a round finds its answers back. If this string and the
  // one the service writes ever disagree, every round silently empties.
  assert.equal(row.params, '{"round":"test-round"}')
  assert.equal(generalAnswers('test-round').length, 2)
  assert.equal(answersForRound('general', { round: 'test-round' }, 'goals', 10)[0].name, 'Pacific Ocean')
})

test('saving again replaces the answers rather than appending them', () => {
  saveGeneralRound({
    slug: 'test-round',
    topic: 'seas',
    title: 'The 1 biggest ocean',
    ordered: true,
    unit: 'km²',
    answers: [{ name: 'Pacific Ocean', aliases: [], value: 165250000, display: '165m' }],
  })
  assert.equal(generalAnswers('test-round').length, 1)
  const registry = sqlite
    .prepare("SELECT title, answer_count FROM tenable_rounds WHERE params = '{\"round\":\"test-round\"}'")
    .get() as { title: string; answer_count: number }
  assert.equal(registry.title, 'The 1 biggest ocean')
  assert.equal(registry.answer_count, 1)
})

test('deleting a round takes its registry row with it', () => {
  deleteGeneralRound('test-round')
  assert.equal(generalRounds().find((r) => r.slug === 'test-round'), undefined)
  assert.equal(generalAnswers('test-round').length, 0)
  const left = sqlite
    .prepare("SELECT COUNT(*) AS n FROM tenable_rounds WHERE params = '{\"round\":\"test-round\"}'")
    .get() as { n: number }
  assert.equal(left.n, 0, 'expected no registry row')
})

test('a ranked round may count up as readily as down', () => {
  const answers = answersForRound('general', { round: 'countries-smallest' }, 'goals', 10)
  assert.equal(answers[0].name, 'Vatican City')
  assert.equal(answers[9].name, 'Malta')
  // Ascending. The board shows the order a round is AUTHORED in — nothing
  // sorts it on the way out — which is the only reason this round can exist.
  const values = answers.map((a) => a.value)
  assert.deepEqual(values, [...values].sort((a, b) => a - b))
})

test('every seeded round is playable: ten answers and a registry row', () => {
  for (const r of generalRounds()) {
    assert.ok(r.answerCount >= 10, `${r.slug} has only ${r.answerCount} answers`)
    assert.notEqual(r.roundId, null, `${r.slug} has no tenable_rounds row`)
    // An unordered round is only worth playing if the pool beats the board.
    if (!r.ordered) assert.ok(r.answerCount > 10, `${r.slug} is unordered but has no spare answers`)
    // A ranked round needs its numbers; an unordered one must not pretend to.
    if (r.ordered) assert.ok(r.unit, `${r.slug} is ranked but says nothing about its unit`)
    else assert.equal(r.unit, null, `${r.slug} is unordered but carries a unit`)
  }
})

// The category was renamed after it had already shipped, so the rename had to
// move live rows as well as table names (migration 0101). This pins that: a
// leftover 'geography' row would be a round nobody can reach — invisible on the
// admin screen, absent from the picker, and still sitting in the database.
test('nothing is left behind under the old category name', () => {
  const stale = sqlite
    .prepare("SELECT COUNT(*) AS n FROM tenable_rounds WHERE category = 'geography' OR type = 'geography'")
    .get() as { n: number }
  assert.equal(stale.n, 0)
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'geography%'")
    .all()
  assert.deepEqual(tables, [])
  // And the rounds really did come across, rather than the old ones simply
  // having been dropped.
  assert.ok(generalRounds().length >= 20)
})

test('an exact answer is never a guess at a different one', () => {
  // "The Gambia" strips to "gambia", which is one edit from Zambia, and both are
  // answers to "African countries ending in A". The spelling latitude that
  // forgives a typo is what makes one answer reachable from the other, so an
  // exact name or alias has to be checked first — see pickAnswer.
  const gambia = { name: 'Gambia', aliases: ['The Gambia'] }
  const zambia = { name: 'Zambia', aliases: [] }
  assert.equal(isPlaceExactly('The Gambia', gambia.name, gambia.aliases), true)
  assert.equal(isPlaceExactly('The Gambia', zambia.name, zambia.aliases), false)
  // Without the exact pass, this is the collision that would decide it:
  assert.equal(matchesPlace('The Gambia', 'Zambia'), true)
})

test('an optional article does not change the answer', () => {
  assert.equal(matchesPlace("Midsummer Night's Dream", "A Midsummer Night's Dream"), true)
  assert.equal(matchesPlace('View to a Kill', 'A View to a Kill'), true)
  assert.equal(matchesPlace('The Strand', 'Strand'), true)
})

// The real guard on seven hundred hand-written answers. Every name and every
// alias in every round must resolve to the answer it belongs to and to nothing
// else — checked with pickAnswer's own precedence, since that is what decides it
// in a game. A round where two answers can be reached by the same word is a
// round that credits the wrong one, and no amount of reading the list spots it.
test('no answer or alias in any round is ambiguous', () => {
  const problems: string[] = []
  for (const round of generalRounds()) {
    const answers = generalAnswers(round.slug)
    for (const answer of answers) {
      for (const probe of [answer.name, ...answer.aliases]) {
        const byName = answers.filter((x) => norm(x.name) === norm(probe))
        const byAlias = answers.filter((x) => isPlaceExactly(probe, x.name, x.aliases))
        const hits = byName.length ? byName
          : byAlias.length ? byAlias
          : answers.filter((x) => matchesPlace(probe, x.name, x.aliases))
        if (!hits.some((h) => h.name === answer.name)) {
          problems.push(`${round.slug}: "${probe}" resolves to ${hits.map((h) => h.name).join(', ') || 'nothing'}, not ${answer.name}`)
        } else if (hits.length > 1) {
          problems.push(`${round.slug}: "${probe}" (${answer.name}) is also ${hits.filter((h) => h.name !== answer.name).map((h) => h.name).join(', ')}`)
        }
      }
    }
  }
  assert.deepEqual(problems, [])
})

test('no round repeats an answer', () => {
  for (const round of generalRounds()) {
    const names = generalAnswers(round.slug).map((a) => a.name.toLowerCase())
    assert.deepEqual([...new Set(names)].length, names.length, `${round.slug} repeats an answer`)
  }
})

// ── The host's final say ─────────────────────────────────────────────────────
//
// Some rounds are judgement, not fact. "Excuses for being late to work" has no
// authority to appeal to, so the game needs a way to agree with a player rather
// than argue with a database in front of a camera.

const rooms = await import('./gameRooms.ts')

function liveRound(slug: string) {
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get(`host-${slug}@example.com`) as { id: number }
  const room = rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
  const host = rooms.participantsOf(room.id)[0]
  rooms.joinRoom(room.code, 'Guest', { platform: 'ios' })
  const guest = rooms.participantsOf(room.id).find((p) => p.display_name === 'Guest')!
  const roundId = (sqlite
    .prepare('SELECT id FROM tenable_rounds WHERE params = ?')
    .get(JSON.stringify({ round: slug })) as { id: number }).id
  const inst = rooms.freezeRound(room.id, roundId)
  rooms.startRound(room.id, inst.id)
  return { room, host, guest, inst }
}

test('the host can count an answer the list did not have', () => {
  const { room, host, guest, inst } = liveRound('cheese-types')
  assert.equal(rooms.submitGuess(inst.id, guest, 'g1', 'Pecorino').verdict, 'miss')

  const result = rooms.allowGuess(inst.id, host, 'Pecorino')
  assert.equal(result.name, 'Pecorino')

  const board = rooms.roomState(rooms.roomByCode(room.code)!).round!.board
  const row = board.revealed.find((a) => a.name === 'Pecorino')
  assert.ok(row, 'the answer should be on the board')
  // Marked, because a board that was judged and a board that was answered are
  // different things and the recording should be able to tell.
  assert.equal(row.allowed, true)
  // Credited to whoever said it, not to the host who allowed it. They were
  // right; the list was short.
  assert.equal(row.byParticipantId, guest.id)
})

test('only the host has the final say', () => {
  const { guest, inst } = liveRound('board-games')
  assert.throws(() => rooms.allowGuess(inst.id, guest, 'Jenga'), /Only the host/)
})

test('a ranked round has no slot to invent', () => {
  // Third place belongs to whatever is third. There is no honest rank to give
  // a river that is not on the list, so the override is refused rather than
  // quietly appended.
  const { host, inst } = liveRound('rivers-longest')
  assert.throws(() => rooms.allowGuess(inst.id, host, 'Severn'), /ranked round/)
})

test('the same answer cannot be counted twice', () => {
  const { host, inst } = liveRound('card-games')
  rooms.allowGuess(inst.id, host, 'Gin rummy')
  assert.throws(() => rooms.allowGuess(inst.id, host, 'gin rummy'), /already up there/)
})

test('counting the tenth answer finishes the round', () => {
  const { host, guest, inst } = liveRound('chinese-zodiac')
  for (const animal of ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey']) {
    rooms.submitGuess(inst.id, guest, `z-${animal}`, animal)
  }
  const result = rooms.allowGuess(inst.id, host, 'Unicorn')
  assert.equal(result.complete, true)
  // And nothing more can be added to a board that is full.
  assert.throws(() => rooms.allowGuess(inst.id, host, 'Griffin'), /is \w+/)
})
