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
  audienceExcluding,
  hostActor,
  inviteText,
  roundText,
  clueText,
  initialsText,
  completeText,
  resumedText,
  returnedText,
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

  const tokens = audienceExcluding(hostActor(HOST_ID)).map((d) => d.token)
  assert.deepEqual(tokens, ['aud-guest'])
  // Stated explicitly: buzzing the host's own pocket when they press Create is
  // the single most obvious way for this feature to feel broken.
  assert.ok(!tokens.includes(hostPhone.token))
})

test('another host’s game still reaches this host’s phone', () => {
  const otherHost = Number(
    sqlite.prepare("INSERT INTO users (email) VALUES ('other@example.com')").run().lastInsertRowid,
  )
  const tokens = audienceExcluding(hostActor(otherHost)).map((d) => d.token)
  assert.ok(tokens.includes('aud-host'))
})

// The change that made the host hear the three pings they do not cause: a
// guest's guess, a guest's return and a board one away are addressed at
// everybody but the guest. See audienceExcluding.
test('a ping somebody else caused reaches the host', () => {
  sqlite.prepare('DELETE FROM push_devices').run()
  const host = registerDevice({
    platform: 'ios',
    token: 'act-host',
    displayName: 'Host',
    userId: HOST_ID,
  })
  const guest = registerDevice({ platform: 'ios', token: 'act-guest', displayName: 'Guest' })
  const other = registerDevice({ platform: 'android', token: 'act-other', displayName: 'Other' })

  // A guest did it. The host hears about it, which under the old rule they
  // never did, and the guest does not hear their own doing.
  const audience = audienceExcluding({ userId: null, deviceId: guest.id }).map((d) => d.token)
  assert.deepEqual(audience, [host.token, other.token])

  // And the host doing it still spares the host, by their account rather than
  // their device — a host's seat carries no device_id at all.
  const hostDid = audienceExcluding({ userId: HOST_ID, deviceId: null }).map((d) => d.token)
  assert.deepEqual(hostDid, [guest.token, other.token])
})

test('an actor nothing is known about excludes nobody', () => {
  // A web client with no phone and no account. Everyone hears it; the
  // alternative — a NULL that matches every row — silently sends nothing.
  const tokens = audienceExcluding({ userId: null, deviceId: null }).map((d) => d.token)
  assert.deepEqual(tokens, ['act-host', 'act-guest', 'act-other'])
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

// ── Diagnostics ─────────────────────────────────────────────────────────────

const { deviceSummaries, sendTestPush } = await import('./push.ts')

test('the registry readout identifies a phone without handing over its token', () => {
  sqlite.prepare('DELETE FROM push_devices').run()
  registerDevice({ platform: 'ios', token: 'tok-abcdef123456', displayName: 'Ali' })

  const [summary] = deviceSummaries()
  assert.equal(summary.displayName, 'Ali')
  // Enough to tell two phones apart over the phone; not enough to push to one.
  assert.equal(summary.tokenTail, '…123456')
  assert.ok(!JSON.stringify(summary).includes('tok-abcdef'))
})

test('the readout reports the flags that silence a phone', () => {
  sqlite.prepare('DELETE FROM push_devices').run()
  const quiet = registerDevice({ platform: 'ios', token: 'tok-quiet', displayName: 'Quiet' })
  setMuted(quiet.secret, true)
  const gone = registerDevice({ platform: 'ios', token: 'tok-gone', displayName: 'Gone' })
  sqlite.prepare("UPDATE push_devices SET disabled_at = datetime('now') WHERE id = ?").run(gone.id)

  const byName = new Map(deviceSummaries().map((d) => [d.displayName, d]))
  assert.equal(byName.get('Quiet')?.muted, true)
  assert.ok(byName.get('Gone')?.disabledAt)
  // Both are still listed. A device that vanishes from the readout when we
  // give up on it hides the exact thing being investigated.
  assert.equal(byName.size, 2)
})

test('a test send never reaps the token it was sent to test', async () => {
  const device = registerDevice({ platform: 'ios', token: 'tok-under-test', displayName: 'Test' })
  // No APNS_* in the test environment, so this reports "not configured"
  // rather than reaching Apple — which is itself the assertion that matters
  // for a suite that must not touch the network.
  const result = await sendTestPush(device.id)
  assert.equal(result?.delivered, false)
  assert.match(result?.skipped ?? '', /apns not configured/)

  const after = sqlite
    .prepare('SELECT disabled_at FROM push_devices WHERE id = ?')
    .get(device.id) as { disabled_at: string | null }
  assert.equal(after.disabled_at, null)
})

test('a test send on an unknown device is a 404, not a silent no-op', async () => {
  assert.equal(await sendTestPush(999_999), null)
})

// ── The attempt log ─────────────────────────────────────────────────────────

const { recordRegistrationAttempt, recentRegistrationAttempts } = await import('./push.ts')

test('a refused attempt is recorded, which is the row worth having', () => {
  sqlite.prepare('DELETE FROM push_registration_attempts').run()
  recordRegistrationAttempt({
    platform: 'ios',
    token: 'tok-refused-abc123',
    outcome: 'refused',
    reason: 'no participant token sent',
  })
  const [attempt] = recentRegistrationAttempts()
  assert.equal(attempt.outcome, 'refused')
  assert.equal(attempt.reason, 'no participant token sent')
  // The whole point: a phone that was turned away can be told apart from one
  // that never called, and neither leaves a device row behind.
  assert.equal(attempt.deviceId, null)
  assert.equal(attempt.tokenTail, '…abc123')
})

test('the log keeps the token out of itself', () => {
  sqlite.prepare('DELETE FROM push_registration_attempts').run()
  recordRegistrationAttempt({ platform: 'ios', token: 'tok-secret-value', outcome: 'registered' })
  assert.ok(!JSON.stringify(recentRegistrationAttempts()).includes('tok-secret'))
})

test('the log is a tail, not a history', () => {
  sqlite.prepare('DELETE FROM push_registration_attempts').run()
  for (let i = 0; i < 230; i++) {
    recordRegistrationAttempt({ platform: 'ios', token: `tok-${i}`, outcome: 'registered' })
  }
  const { n } = sqlite
    .prepare('SELECT COUNT(*) AS n FROM push_registration_attempts')
    .get() as { n: number }
  // Trimmed on insert. A diagnostic that grows without bound is a slow leak
  // in a database that holds a game.
  assert.ok(n <= 200, `kept ${n}`)
  // Newest first, and the newest is the one just written.
  assert.equal(recentRegistrationAttempts(1)[0].tokenTail, '…ok-229')
})

test('the most recent attempt comes first', () => {
  sqlite.prepare('DELETE FROM push_registration_attempts').run()
  recordRegistrationAttempt({ platform: 'ios', token: 'tok-older', outcome: 'refused' })
  recordRegistrationAttempt({ platform: 'ios', token: 'tok-newer', outcome: 'registered' })
  assert.deepEqual(
    recentRegistrationAttempts().map((a) => a.outcome),
    ['registered', 'refused'],
  )
})

test('a message with nothing to add sends one line, not a blank second one', () => {
  const payload = JSON.parse(
    apnsPayload({ token: 't', title: 'Joe just revealed a clue', body: '', data: { kind: 'clue' } }),
  )
  assert.equal(payload.aps.alert.title, 'Joe just revealed a clue')
  assert.equal('body' in payload.aps.alert, false)

  const android = fcmBody({
    token: 't', title: 'Joe just revealed a clue', body: '', data: { kind: 'clue' },
  }) as { message: Record<string, any> }
  assert.equal('body' in android.message.notification, false)
})

test('the clue ping is the one line and nothing else', () => {
  assert.deepEqual(
    clueText({ code: 'ABC123', hostName: 'Joe', roomName: 'Thursday night' }),
    { title: 'Joe just revealed a clue', body: '' },
  )
})

test('the initials ping says which kind of clue it was', () => {
  assert.deepEqual(
    initialsText({ code: 'ABC123', hostName: 'Joe', roomName: 'Thursday night' }),
    // Its own words, not clueText's: somebody who ignored the first ping may
    // well want this one, and "a clue" twice would read as a repeat.
    { title: 'Joe just revealed an initials clue', body: '' },
  )
})

test('a return is worded as an arrival, and a resumption as a guess', () => {
  // Two pings a minute apart in the good case, and the words are the only
  // thing that tells them apart on a lock screen.
  assert.equal(
    returnedText({ code: 'ABC123', hostName: 'Rob', roomName: 'Friday night' }).title,
    'Rob is back in Friday night',
  )
  assert.equal(returnedText({ code: 'ABC123', hostName: 'Rob', roomName: null }).title, 'Rob is back')
  // The code rides along, because some of the people it reaches have not
  // opened the app since Tuesday.
  assert.equal(
    returnedText({ code: 'ABC123', hostName: 'Rob', roomName: null }).body,
    'Tap to join — code ABC123',
  )
  assert.equal(
    resumedText({ code: 'ABC123', hostName: 'Rob', roomName: null }).title,
    'Rob has started guessing',
  )
})

test('a finished round names whoever finished it and carries the code', () => {
  // Named rather than impersonal, because the name is the news: "Rob finished
  // the round" tells the people who were not playing both what happened and
  // who to blame for it.
  assert.equal(
    completeText({ code: 'ABC123', hostName: 'Rob', roomName: 'Friday night' }).title,
    'Rob finished the round in Friday night',
  )
  assert.equal(
    completeText({ code: 'ABC123', hostName: 'Rob', roomName: null }).title,
    'Rob finished the round',
  )
  // Unlike the last-slot ping, which is urgent and bodyless: a finished round
  // is the moment the next one starts, so this one is addressed at people who
  // may need the code to get in.
  assert.equal(
    completeText({ code: 'ABC123', hostName: 'Rob', roomName: null }).body,
    'Tap to see the board — code ABC123',
  )
})

// ── Why a phone is silent ───────────────────────────────────────────────────
//
// The failure that took three weeks to find: four iPhones that had
// registered cleanly, were not muted, were not disabled and had never
// received anything, with the reason in a log the diagnostic could not read.

test('a refusal that is nobody’s fault is written onto the device', async () => {
  const device = registerDevice({ platform: 'ios', token: 'err-device', displayName: 'Quiet' })
  // No credentials in this test process, so the send reports "not configured"
  // for every message rather than reaching Apple — which is itself exactly
  // the class of failure this column exists to surface.
  await sendTestPush(device.id)
  const row = deviceBySecret(device.secret)!
  // Not disabled: a missing key refuses every phone identically and says
  // nothing about this one.
  assert.equal(row.disabled_at, null)
})

test('a device that comes back with the same token is re-enabled', () => {
  // registerDevice has always promised this. rotateToken's "token unchanged"
  // path did not do it, so one refusal disabled a phone for ever and
  // reopening the app — which is this exact call — could not undo it.
  const device = registerDevice({ platform: 'ios', token: 'revive-same', displayName: 'Pat' })
  sqlite.prepare("UPDATE push_devices SET disabled_at = datetime('now') WHERE id = ?").run(device.id)
  const back = rotateToken(device.secret, 'revive-same')
  assert.equal(back?.disabled_at, null)
  assert.equal(back?.display_name, 'Pat')
})

test('a key that is set and is not a key is reported as such', async () => {
  const { apnsKeyError } = await import('./pushApns.ts')
  const before = process.env.APNS_PRIVATE_KEY
  try {
    process.env.APNS_KEY_ID = 'KEYID12345'
    process.env.APNS_TEAM_ID = 'TEAMID1234'
    // What a dashboard field does to a .p8 when it eats the line breaks.
    process.env.APNS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY----- MIGtotallynotakey -----END PRIVATE KEY-----'
    const error = apnsKeyError()
    assert.ok(error, 'a flattened PEM must not read as healthy')
  } finally {
    if (before == null) delete process.env.APNS_PRIVATE_KEY
    else process.env.APNS_PRIVATE_KEY = before
    delete process.env.APNS_KEY_ID
    delete process.env.APNS_TEAM_ID
  }
})

test('an unusable key fails the batch instead of throwing through it', async () => {
  const { sendApnsBatch, resetProviderToken: reset } = await import('./pushApns.ts')
  const before = process.env.APNS_PRIVATE_KEY
  try {
    process.env.APNS_KEY_ID = 'KEYID12345'
    process.env.APNS_TEAM_ID = 'TEAMID1234'
    process.env.APNS_PRIVATE_KEY = 'not a pem at all'
    reset()
    // The whole point: a result per message, so the caller can record one.
    // This used to reject and take the entire fan-out with it, leaving no
    // trace on any device in the batch.
    const results = await sendApnsBatch(
      [{ token: 'a'.repeat(64), title: 'x', body: '', data: {} }],
      'production',
    )
    assert.equal(results.length, 1)
    assert.equal(results[0].ok, false)
    assert.ok(!results[0].ok && results[0].reason.includes('apns key'))
    // And not reaped: the phone did nothing wrong.
    assert.ok(!results[0].ok && results[0].dead === false)
  } finally {
    if (before == null) delete process.env.APNS_PRIVATE_KEY
    else process.env.APNS_PRIVATE_KEY = before
    delete process.env.APNS_KEY_ID
    delete process.env.APNS_TEAM_ID
    reset()
  }
})
