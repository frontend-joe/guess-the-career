import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A push token is not a handset.
//
// Apple issues a different token for the sandbox and the production gateway,
// so one phone moving from a development build to a TestFlight build arrives
// with a token nothing has ever seen; Google reissues on a reinstall.
// Identified by token alone that is a new phone, so it took a new device row
// — and because game_participants.device_id is how a guest is recognised
// coming back, it took a new seat too. Everybody who updated grew a second
// card.
//
// The secret is the handset: issued once, kept by the app, changed by
// nothing. When the app offers it, it wins.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'device-identity-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()
const { registerDevice } = await import('./push.ts')
const rooms = await import('./gameRooms.ts')

const deviceCount = () =>
  (sqlite.prepare('SELECT COUNT(*) AS n FROM push_devices').get() as { n: number }).n

let seq = 0
function room() {
  seq += 1
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get(`identity-host${seq}@example.com`) as { id: number }
  return rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
}

test('the same phone with a new token keeps its row, and its seat', () => {
  const r = room()
  const before = deviceCount()

  // Monday: the guest joins from a development build.
  const sandbox = registerDevice({ platform: 'ios', token: 'apns-sandbox-token', displayName: 'Mate' })
  const first = rooms.joinRoom(r.code, 'Mate', { deviceId: sandbox.id }).participant

  // Tuesday: everybody updates. Same phone, same secret it was handed on
  // Monday, a token Apple has never issued before.
  const production = registerDevice({
    platform: 'ios',
    token: 'apns-production-token',
    displayName: 'Mate',
    knownSecret: sandbox.secret,
  })
  const second = rooms.joinRoom(r.code, 'Mate', { deviceId: production.id }).participant

  assert.equal(production.id, sandbox.id, 'the same handset, so the same device row')
  assert.equal(deviceCount(), before + 1, 'one phone, one row')
  assert.equal(second.id, first.id, 'one phone, one seat')
  assert.equal(
    rooms.roomState(rooms.roomByCode(r.code)!).participants.length,
    2,
    'the host and the one guest, not the host and two of them',
  )
})

test('without the secret the same phone is a new phone — the bug, pinned', () => {
  const r = room()
  const sandbox = registerDevice({ platform: 'ios', token: 'old-token', displayName: 'Mate' })
  rooms.joinRoom(r.code, 'Mate', { deviceId: sandbox.id })

  // No knownSecret: this is what both apps used to send.
  const reissued = registerDevice({ platform: 'ios', token: 'new-token', displayName: 'Mate' })
  rooms.joinRoom(r.code, 'Mate', { deviceId: reissued.id })

  assert.notEqual(reissued.id, sandbox.id)
  assert.equal(
    rooms.roomState(rooms.roomByCode(r.code)!).participants.length,
    3,
    'the duplicate card the room was seeing',
  )
})

test('a merge carries the seats over rather than cutting them loose', () => {
  const r = room()
  // The mess as it stands: the phone registered twice, and has a seat under
  // each — one from before the update and one from after.
  const kept = registerDevice({ platform: 'android', token: 'token-a', displayName: 'Mate' })
  const stray = registerDevice({ platform: 'android', token: 'token-b', displayName: 'Mate' })
  const oldSeat = rooms.joinRoom(r.code, 'Mate', { deviceId: kept.id }).participant
  const newSeat = rooms.joinRoom(r.code, 'Mate', { deviceId: stray.id }).participant
  assert.notEqual(oldSeat.id, newSeat.id)

  // The phone comes back holding the FIRST secret and the SECOND token.
  const merged = registerDevice({
    platform: 'android',
    token: 'token-b',
    displayName: 'Mate',
    knownSecret: kept.secret,
  })

  assert.equal(merged.id, kept.id)
  assert.equal(
    (sqlite.prepare('SELECT COUNT(*) AS n FROM push_devices WHERE id = ?').get(stray.id) as { n: number }).n,
    0,
    'the stray row is gone',
  )
  // device_id is declared ON DELETE SET NULL, so deleting the stray used to
  // cut its seat loose — a card nothing could ever match again, which the
  // next join could not rejoin into, so it took a third seat.
  const orphans = sqlite
    .prepare('SELECT COUNT(*) AS n FROM game_participants WHERE room_id = ? AND device_id IS NULL AND user_id IS NULL')
    .get(r.id) as { n: number }
  assert.equal(orphans.n, 0)
  const both = sqlite
    .prepare('SELECT COUNT(*) AS n FROM game_participants WHERE room_id = ? AND device_id = ?')
    .get(r.id, kept.id) as { n: number }
  assert.equal(both.n, 2, 'both seats now point at the one phone')
  // And the next join lands on one of them rather than opening a third.
  const back = rooms.joinRoom(r.code, 'Mate', { deviceId: merged.id }).participant
  assert.ok([oldSeat.id, newSeat.id].includes(back.id))
})
