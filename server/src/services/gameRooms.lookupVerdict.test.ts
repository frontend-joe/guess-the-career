import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A guess the database has never heard of gets looked up on Wikipedia, and
// what comes back decides whether the name is blacklisted. "Blacklisted" is
// permanent — a rejected name is never looked up again, however many times it
// is shouted — so the verdict has to be a verdict, and a lookup that simply
// did not answer is not one.
//
// It used to be. Every failure returned the same `false` as a real "no", and
// the caller wrote the permanent status for all of them. One timed-out
// category fetch therefore removed a real player from the game for good:
// Giles Barnes, Jamaica international, hundred-odd Championship appearances,
// scraped and deleted and then unguessable on every board thereafter.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'verdict-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { isMensFootballer, learnUnknownName } = await import('./gameRooms.ts')

const BARNES = 'https://en.wikipedia.org/wiki/Giles_Barnes'
const realFetch = globalThis.fetch

/** Answer the category query with whatever this test wants it to say. */
function stubFetch(reply: () => Promise<Response> | Response): void {
  globalThis.fetch = (async () => reply()) as typeof globalThis.fetch
}

function categories(titles: string[]): Response {
  const body = { query: { pages: { '1': { categories: titles.map((title) => ({ title })) } } } }
  return new Response(JSON.stringify(body), { status: 200 })
}

test.after(() => {
  globalThis.fetch = realFetch
})

test('categories that say footballer are a yes', async () => {
  stubFetch(() => categories(["Category:English men's footballers", 'Category:Club León footballers']))
  assert.equal(await isMensFootballer(BARNES), 'yes')
})

test("an actor and a women's international are both a real no", async () => {
  stubFetch(() => categories(['Category:American male film actors', 'Category:1988 births']))
  assert.equal(await isMensFootballer(BARNES), 'no')

  // "women's" contains "men's", which is the whole reason the check reads
  // categories with word boundaries rather than substrings.
  stubFetch(() => categories(["Category:England women's international footballers"]))
  assert.equal(await isMensFootballer(BARNES), 'no')
})

test('a lookup that does not answer is unknown, not a no', async () => {
  // The four ways it used to come back as a permanent rejection.
  stubFetch(() => {
    throw new Error('ETIMEDOUT')
  })
  assert.equal(await isMensFootballer(BARNES), 'unknown', 'network failure')

  stubFetch(() => new Response('upstream is busy', { status: 503 }))
  assert.equal(await isMensFootballer(BARNES), 'unknown', 'Wikipedia having a moment')

  stubFetch(() => new Response('{}', { status: 200 }))
  assert.equal(await isMensFootballer(BARNES), 'unknown', 'a response shape we did not expect')

  stubFetch(() => categories([]))
  assert.equal(await isMensFootballer(BARNES), 'unknown', 'no categories at all')
})

// Why the distinction has to exist at all: the two statuses are not equally
// forgiving, and nothing retries the harsher one.
test('a rejection is forever and a failure is for an hour', async () => {
  // The name that gets through below queues a real lookup. Keep it off the
  // network: a failing fetch is caught, and the queue drains in a tick.
  stubFetch(() => {
    throw new Error('ETIMEDOUT')
  })

  const roundId = (sqlite
    .prepare(
      `INSERT INTO tenable_rounds (category, type, params, metric, title, answer_count)
       VALUES ('football', 'club', '{"club":"Nowhere"}', 'apps', 'Nowhere players', 10) RETURNING id`,
    )
    .get() as { id: number }).id
  // A room and a live round only so the review rows have something real to
  // hang off; nothing here plays it.
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get('verdict-host@example.com') as { id: number }
  const roomId = (sqlite
    .prepare(
      `INSERT INTO game_rooms (code, host_user_id, status, livekit_room)
       VALUES ('AAAAAA', ?, 'lobby', 'verdict-test') RETURNING id`,
    )
    .get(user.id) as { id: number }).id
  const instanceId = (sqlite
    .prepare(
      `INSERT INTO game_round_instances
         (room_id, round_id, seq, status, type, params_json, metric, title, ordered, target)
       VALUES (?, ?, 1, 'live', 'club', '{"club":"Nowhere"}', 'apps', 'Nowhere players', 1, 10)
       RETURNING id`,
    )
    .get(roomId, roundId) as { id: number }).id

  const review = (raw: string, status: string, ageHours = 0) =>
    sqlite
      .prepare(
        `INSERT INTO game_guess_reviews (instance_id, raw, raw_norm, status, created_at)
         VALUES (?, ?, ?, ?, datetime('now', ?))`,
      )
      .run(instanceId, raw, raw, status, `-${ageHours} hours`)

  review('a definite actor', 'rejected')
  assert.equal(learnUnknownName('a definite actor'), false, 'never looked up again')

  // Within the hour, so that shouting the same name through one round does
  // not start the same doomed search over and over.
  review('a name we could not check', 'unresolved')
  assert.equal(learnUnknownName('a name we could not check'), false)

  // And past it, the whole point of the softer status: it gets another go.
  review('a name we could not check last week', 'unresolved', 48)
  assert.equal(
    learnUnknownName('a name we could not check last week'),
    true,
    'a failed check must not cost a real player their place in the game',
  )

  // Let the queued lookup finish failing before the stub is taken away.
  await new Promise((resolve) => setTimeout(resolve, 50))
})
