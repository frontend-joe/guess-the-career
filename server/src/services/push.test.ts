import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateKeyPairSync } from 'node:crypto'

// A throwaway database, chosen BEFORE db/client is imported — it reads
// DATABASE_PATH once, at import. Same trick as tenable.recordTransfers.test.ts.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'push-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const {
  registerDevice,
  rotateToken,
  setMuted,
  deviceBySecret,
  audienceExcludingHost,
  inviteText,
  roundText,
} = await import('./push.ts')

const { apnsPayload, providerToken, resetProviderToken } = await import('./pushApns.ts')
const { fcmBody } = await import('./pushFcm.ts')

const HOST_ID = Number(
  sqlite.prepare("INSERT INTO users (email) VALUES ('host@example.com')").run().lastInsertRowid,
)

// ── The registry ────────────────────────────────────────────────────────────

test('a device is remembered once, however many times it registers', () => {
  const first = registerDevice({ platform: 'ios', token: 'tok-stable', displayName: 'Dan' })
  const again = registerDevice({ platform: 'ios', token: 'tok-stable', displayName: 'Dan' })
  assert.equal(again.id, first.id)
  // The secret must survive, or the app's stored credential stops working the
  // second time it launches.
  assert.equal(again.secret, first.secret)
  const rows = sqlite
    .prepare("SELECT COUNT(*) AS n FROM push_devices WHERE token = 'tok-stable'")
    .get() as { n: number }
  assert.equal(rows.n, 1)
})

test('re-registering revives a device we had given up on', () => {
  const device = registerDevice({ platform: 'android', token: 'tok-revive', displayName: 'Sam' })
  sqlite.prepare("UPDATE push_devices SET disabled_at = datetime('now') WHERE id = ?").run(device.id)
  const back = registerDevice({ platform: 'android', token: 'tok-revive' })
  // The app telling us its token is proof the app is installed, which is the
  // only thing disabled_at ever claimed.
  assert.equal(back.disabled_at, null)
  // A name already known is not erased by a call that omits one.
  assert.equal(back.display_name, 'Sam')
})

test('a rotated token moves to the row that already had the secret', () => {
  const device = registerDevice({ platform: 'ios', token: 'tok-old', displayName: 'Ali' })
  const rotated = rotateToken(device.secret, 'tok-new')
  assert.equal(rotated?.id, device.id)
  assert.equal(rotated?.token, 'tok-new')
  assert.equal(deviceBySecret(device.secret)?.token, 'tok-new')
})

// The case a reinstall actually produces: the phone registered again as a
// stranger, and then its original row tries to rotate onto the token the new
// row is holding. Without the merge this is a UNIQUE violation thrown at an
// app that is doing nothing wrong.
test('rotating onto a token another row already holds merges rather than collides', () => {
  const original = registerDevice({ platform: 'ios', token: 'tok-a', displayName: 'Jo' })
  const duplicate = registerDevice({ platform: 'ios', token: 'tok-b', displayName: 'Jo' })
  const rotated = rotateToken(original.secret, 'tok-b')
  assert.equal(rotated?.id, original.id)
  assert.equal(rotated?.token, 'tok-b')
  assert.equal(deviceBySecret(duplicate.secret), null)
})

test('an unknown secret is refused rather than creating a device', () => {
  const before = sqlite.prepare('SELECT COUNT(*) AS n FROM push_devices').get() as { n: number }
  assert.equal(rotateToken('not-a-secret', 'tok-nope'), null)
  assert.equal(setMuted('not-a-secret', true), null)
  const after = sqlite.prepare('SELECT COUNT(*) AS n FROM push_devices').get() as { n: number }
  assert.equal(after.n, before.n)
})

// ── The audience ────────────────────────────────────────────────────────────

test('an invite goes to everyone but the host, the muted and the dead', () => {
  sqlite.prepare('DELETE FROM push_devices').run()

  registerDevice({ platform: 'ios', token: 'aud-guest', displayName: 'Guest' })
  const hostPhone = registerDevice({
    platform: 'ios',
    token: 'aud-host',
    displayName: 'Host',
    userId: HOST_ID,
  })
  const muted = registerDevice({ platform: 'android', token: 'aud-muted', displayName: 'Muted' })
  setMuted(muted.secret, true)
  const dead = registerDevice({ platform: 'android', token: 'aud-dead', displayName: 'Dead' })
  sqlite.prepare("UPDATE push_devices SET disabled_at = datetime('now') WHERE id = ?").run(dead.id)

  const tokens = audienceExcludingHost(HOST_ID).map((d) => d.token)
  assert.deepEqual(tokens, ['aud-guest'])
  // Stated explicitly: buzzing the host's own pocket when they press Create is
  // the single most obvious way for this feature to feel broken.
  assert.ok(!tokens.includes(hostPhone.token))
})

test('another host’s game still reaches this host’s phone', () => {
  const otherHost = Number(
    sqlite.prepare("INSERT INTO users (email) VALUES ('other@example.com')").run().lastInsertRowid,
  )
  const tokens = audienceExcludingHost(otherHost).map((d) => d.token)
  assert.ok(tokens.includes('aud-host'))
})

// ── What it says ────────────────────────────────────────────────────────────

test('the invite names the game when it has a name, and the host when it does not', () => {
  assert.deepEqual(inviteText({ code: 'ABC123', hostName: 'Joe', roomName: null }), {
    title: 'Joe started a game',
    body: 'Tap to join — code ABC123',
  })
  assert.equal(
    inviteText({ code: 'ABC123', hostName: 'Joe', roomName: 'Friday night' }).title,
    'Joe started Friday night',
  )
  // A name that is only whitespace is not a name.
  assert.equal(
    inviteText({ code: 'ABC123', hostName: 'Joe', roomName: '   ' }).title,
    'Joe started a game',
  )
})

test('a round start reads as news, and still carries the code', () => {
  assert.deepEqual(roundText({ code: 'ABC123', hostName: 'Joe', roomName: null }), {
    title: 'Joe started a new round',
    body: 'Tap to join — code ABC123',
  })
  // Named rooms lead with the room, because most of the people reading this
  // are already in one and the name is what tells them whether it is theirs.
  assert.equal(
    roundText({ code: 'ABC123', hostName: 'Joe', roomName: 'Friday night' }).title,
    'New round in Friday night',
  )
  assert.equal(
    roundText({ code: 'ABC123', hostName: 'Joe', roomName: '   ' }).title,
    'Joe started a new round',
  )
})

// ── The wire format ─────────────────────────────────────────────────────────

test('the apns payload carries the code beside aps, not inside it', () => {
  const payload = JSON.parse(
    apnsPayload({ token: 't', title: 'T', body: 'B', data: { code: 'ABC123', kind: 'invite' } }),
  )
  assert.equal(payload.aps.alert.title, 'T')
  // The app reads this to know which game to open; nested under aps it would
  // be Apple's to interpret and would not arrive.
  assert.equal(payload.code, 'ABC123')
  assert.equal(payload.kind, 'invite')
})

test('the fcm body sends both a notification and the matching data', () => {
  const body = fcmBody({
    token: 't',
    title: 'T',
    body: 'B',
    data: { code: 'ABC123', kind: 'invite' },
    collapseKey: 'k',
  }) as { message: Record<string, any> }
  // The notification block is what the Android system draws while the app is
  // not running, which is the entire reason for pushing at all.
  assert.equal(body.message.notification.title, 'T')
  assert.equal(body.message.data.code, 'ABC123')
  assert.equal(body.message.android.priority, 'HIGH')
  assert.equal(body.message.android.collapse_key, 'k')
})

// The subtle one. A JWT's ECDSA signature is the two coordinates concatenated
// raw, 64 bytes for P-256; Node emits DER by default, which APNs rejects with
// a bare 403 InvalidProviderToken that looks exactly like the wrong key.
test('the apns provider token is signed as raw coordinates, not DER', () => {
  resetProviderToken()
  const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }) as unknown as { privateKey: string }

  const jwt = providerToken({
    keyId: 'KEY123',
    teamId: 'TEAM123',
    privateKey,
    topic: 'com.example.app',
  })
  const [header, claims, signature] = jwt.split('.')
  assert.equal(Buffer.from(signature, 'base64url').length, 64)
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), {
    alg: 'ES256',
    kid: 'KEY123',
    typ: 'JWT',
  })
  assert.equal(JSON.parse(Buffer.from(claims, 'base64url').toString()).iss, 'TEAM123')
})

test('the provider token is reused rather than minted per notification', () => {
  resetProviderToken()
  const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }) as unknown as { privateKey: string }
  const config = { keyId: 'K', teamId: 'T', privateKey, topic: 'com.example.app' }
  // Apple rate-limits providers that mint a fresh token on every request.
  assert.equal(providerToken(config), providerToken(config))
})
