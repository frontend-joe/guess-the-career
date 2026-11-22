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

function room(email: string) {
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get(email) as { id: number }
  return rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
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
