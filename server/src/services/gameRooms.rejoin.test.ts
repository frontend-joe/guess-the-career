import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A guest coming back is the same guest.
//
// Rejoining has always kept your slot, but the branch that did it was gated on
// user_id — and guests do not have one, which is the whole point of joining by
// code with a name. So every guest rejoin took a brand new row, and because
// nothing deletes a participant, the abandoned one stayed on the list too: the
// same person, twice, on everybody's screen.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'rejoin-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const rooms = await import('./gameRooms.ts')

function device(token: string): number {
  return (sqlite
    .prepare("INSERT INTO push_devices (platform, token, secret) VALUES ('android', ?, ?) RETURNING id")
    .get(token, `secret-${token}`) as { id: number }).id
}

function host(email: string): number {
  return (sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get(email) as { id: number }).id
}

function room(email: string) {
  return rooms.createRoom({ id: host(email), displayName: 'Host' }, 'Test')
}

test('a guest on the same phone comes back to the seat they had', () => {
  const r = room('rejoin-1@example.com')
  const phone = device('phone-1')

  const first = rooms.joinRoom(r.code, 'Alan', { deviceId: phone, platform: 'android' }).participant
  rooms.leaveRoom(first.id)
  const second = rooms.joinRoom(r.code, 'Alan', { deviceId: phone, platform: 'android' }).participant

  assert.equal(second.id, first.id)
  assert.equal(second.slot, first.slot)
  // And back in the room, not still showing as gone.
  assert.equal(second.left_at, null)
  // One card, not two. The host is the other.
  assert.equal(rooms.participantsOf(r.id).length, 2)
})

test('a different phone is a different player, whatever they call themselves', () => {
  const r = room('rejoin-2@example.com')

  rooms.joinRoom(r.code, 'Alan', { deviceId: device('phone-2a'), platform: 'android' })
  rooms.joinRoom(r.code, 'Alan', { deviceId: device('phone-2b'), platform: 'ios' })

  // Two people in one room can share a name, so the name is never the key.
  assert.equal(rooms.participantsOf(r.id).length, 3)
})

test('a phone with no push token still gets a seat, and a new one each time', () => {
  const r = room('rejoin-3@example.com')

  rooms.joinRoom(r.code, 'Darren', { platform: 'android' })
  rooms.joinRoom(r.code, 'Darren', { platform: 'android' })

  // Notifications turned off leaves nothing to recognise them by, and
  // guessing from the display name is how two different Darrens end up
  // sharing a seat. The honest answer is a new seat.
  assert.equal(rooms.participantsOf(r.id).length, 3)
})

test('removing a guest survives their rejoining on the same phone', () => {
  const r = room('rejoin-4@example.com')
  const phone = device('phone-4')
  const host = rooms.participantsOf(r.id)[0]

  const guest = rooms.joinRoom(r.code, 'Bobby', { deviceId: phone, platform: 'android' }).participant
  rooms.removeParticipant(r.id, host, guest.id)

  assert.throws(
    () => rooms.joinRoom(r.code, 'Bobby', { deviceId: phone, platform: 'android' }),
    /removed/,
  )
})

test('a rejoin under a new name renames the card rather than adding one', () => {
  const r = room('rejoin-5@example.com')
  const phone = device('phone-5')

  const first = rooms.joinRoom(r.code, 'Dave', { deviceId: phone, platform: 'android' }).participant
  const second = rooms.joinRoom(r.code, 'David Albelda', { deviceId: phone, platform: 'android' }).participant

  assert.equal(second.id, first.id)
  assert.equal(second.display_name, 'David Albelda')
})

// A removed player is not a player who left. Leaving keeps you on the list,
// greyed, because you are still part of this game. Being thrown out takes you
// off it — and until this, it did not: the card stayed exactly where it was,
// so removing somebody looked like it had done nothing at all, which is no
// use when what the host is trying to clear is a stale seat nobody is in.
test('a removed player drops off the list, a player who left stays on it', () => {
  const r = room('removed-list@example.com')
  const host = rooms.participantsOf(r.id)[0]

  const walker = rooms.joinRoom(r.code, 'Walked Out', { deviceId: device('phone-walk') }).participant
  const ejected = rooms.joinRoom(r.code, 'Thrown Out', { deviceId: device('phone-eject') }).participant

  rooms.leaveRoom(walker.id)
  rooms.removeParticipant(r.id, host, ejected.id)

  const listed = rooms.roomState(r).participants
  assert.deepEqual(
    listed.map((p) => p.displayName),
    ['Host', 'Walked Out'],
  )
  assert.equal(listed.find((p) => p.displayName === 'Walked Out')!.present, false)

  // The row itself is still there. It is what stops the seat being handed
  // straight back at the door on the next join.
  assert.equal(rooms.participantsOf(r.id).length, 3)
})

test('a host who taps their own invite does not get a second seat', () => {
  // The push pings the host now hears — a player coming back, the last slot,
  // the round finishing — all carry a join code, and tapping one walks the
  // host into the join flow for the room they are already running. Which is
  // fine, so long as the server can tell it is them.
  //
  // It can only tell from the account. The host's participant row is written
  // by createRoom with their user_id and NO device_id, because a host arrives
  // by making the room rather than by joining it, and the device recogniser
  // is for guest seats and skips rows with a user_id anyway. So an anonymous
  // join from the host's own phone matches nothing at all.
  const userId = host('rejoin-host@example.com')
  const r = rooms.createRoom({ id: userId, displayName: 'Blessing Kaku' }, 'Test')
  const phone = device('host-phone')

  const seats = () => sqlite
    .prepare('SELECT * FROM game_participants WHERE room_id = ? ORDER BY slot')
    .all(r.id) as { id: number; slot: number; role: string; display_name: string }[]
  assert.equal(seats().length, 1)

  // Signed in, which is what the apps now send.
  const back = rooms.joinRoom(r.code, 'Blessing Kaku', {
    userId, deviceId: phone, platform: 'ios',
  }).participant

  assert.equal(seats().length, 1, 'tapping your own invite must not seat you twice')
  assert.equal(back.slot, 0)
  // Still the host. A rejoin reclaims the row as it stands rather than
  // demoting them to a player, which would take the round controls away from
  // the one person holding the game together.
  assert.equal(back.role, 'host')
})

test('without the account the host is a stranger, which is the bug', () => {
  // Pinned so the client fix cannot be quietly dropped: with no user_id the
  // server has nothing to recognise, and this is what the room looked like.
  const userId = host('rejoin-host-anon@example.com')
  const r = rooms.createRoom({ id: userId, displayName: 'Blessing Kaku' }, 'Test')
  const phone = device('host-phone-anon')

  rooms.joinRoom(r.code, 'Blessing Kaku', { deviceId: phone, platform: 'ios' })

  const names = (sqlite
    .prepare('SELECT display_name FROM game_participants WHERE room_id = ? ORDER BY slot')
    .all(r.id) as { display_name: string }[]).map((p) => p.display_name)
  assert.deepEqual(names, ['Blessing Kaku', 'Blessing Kaku'])
})
