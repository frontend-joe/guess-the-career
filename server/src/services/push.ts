import { randomBytes } from 'node:crypto'
import { sqlite } from '../db/client.ts'
import {
  apnsMissing,
  sendApnsBatch,
  type ApnsEnvironment,
  type ApnsMessage,
} from './pushApns.ts'
import { fcmMissing, sendFcmBatch, type FcmMessage } from './pushFcm.ts'

// Who gets woken up, and what they are told.
//
// The two senders either side of this file are plumbing; the decisions live
// here. There is one notification worth sending — a game has started, come and
// join — and the reason it is worth sending is that the alternative is the
// host pasting a link into a group chat and hoping somebody looks at it.
//
// It is deliberately fire-and-forget, like broadcastState in livekit.ts and
// for the same reason: the room is already created and committed by the time
// this runs. Awaiting Apple and Google would put their latency inside the
// host's "Create game" tap, and a failure would turn a created room into a
// 500 — the worst possible trade, since a notification that never arrives
// costs nothing but a link the host can still send by hand.

export interface PushDeviceRow {
  id: number
  platform: string
  token: string
  secret: string
  user_id: number | null
  display_name: string | null
  apns_env: string | null
  muted: number
  disabled_at: string | null
  last_push_at: string | null
  created_at: string | null
}

export type Platform = 'ios' | 'android'

/** Which credentials are absent, by name, for /api/health to report. */
export function pushMissing(): string[] {
  return [...apnsMissing(), ...fcmMissing()]
}

// Re-exported so the diagnostic route can report which credentials are
// absent without reaching past this file into either gateway's module.
export { apnsMissing, fcmMissing }

export function pushConfigured(): boolean {
  // Either platform on its own is a working feature. Requiring both would mean
  // one missing Firebase project silenced the iPhones too.
  return apnsMissing().length === 0 || fcmMissing().length === 0
}

// ── The registry ────────────────────────────────────────────────────────────

/**
 * Remember a phone, or update what we know about one.
 *
 * Keyed on the push token, because that is what identifies a device to Apple
 * and Google and it is the one value a reinstalled app is certain to bring
 * with it. A token that comes back after being disabled is re-enabled: the
 * app telling us its token is proof the app is installed, which is the only
 * thing `disabled_at` ever claimed.
 */
export function registerDevice(input: {
  platform: Platform
  token: string
  displayName?: string | null
  userId?: number | null
}): PushDeviceRow {
  const existing = sqlite
    .prepare('SELECT * FROM push_devices WHERE token = ?')
    .get(input.token) as PushDeviceRow | undefined

  if (existing) {
    sqlite
      .prepare(
        `UPDATE push_devices
         SET platform = ?,
             display_name = COALESCE(?, display_name),
             user_id = COALESCE(?, user_id),
             disabled_at = NULL,
             updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(input.platform, input.displayName ?? null, input.userId ?? null, existing.id)
    return sqlite.prepare('SELECT * FROM push_devices WHERE id = ?').get(existing.id) as PushDeviceRow
  }

  const secret = randomBytes(32).toString('base64url')
  const info = sqlite
    .prepare(
      `INSERT INTO push_devices (platform, token, secret, user_id, display_name)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.platform, input.token, secret, input.userId ?? null, input.displayName ?? null)
  return sqlite
    .prepare('SELECT * FROM push_devices WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as PushDeviceRow
}

export function deviceBySecret(secret: string): PushDeviceRow | null {
  return (sqlite
    .prepare('SELECT * FROM push_devices WHERE secret = ?')
    .get(secret) as PushDeviceRow | undefined) ?? null
}

/**
 * The phone's token has changed.
 *
 * iOS reissues one on a restore and Android on a reinstall, and the app finds
 * out through a callback rather than by asking. The device identifies itself
 * with the secret it was handed at registration, since at this moment it holds
 * no participant token and may have no account at all.
 *
 * If the new token already has a row — the same phone registered twice, which
 * a reinstall can produce — the rows are merged onto the one being kept rather
 * than left to collide with the UNIQUE constraint.
 */
export function rotateToken(secret: string, token: string, displayName?: string | null): PushDeviceRow | null {
  const device = deviceBySecret(secret)
  if (!device) return null
  if (device.token === token) {
    if (displayName) {
      sqlite
        .prepare("UPDATE push_devices SET display_name = ?, updated_at = datetime('now') WHERE id = ?")
        .run(displayName, device.id)
    }
    return deviceBySecret(secret)
  }
  sqlite.transaction(() => {
    sqlite.prepare('DELETE FROM push_devices WHERE token = ? AND id != ?').run(token, device.id)
    sqlite
      .prepare(
        `UPDATE push_devices
         SET token = ?, display_name = COALESCE(?, display_name),
             disabled_at = NULL, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(token, displayName ?? null, device.id)
  })()
  return deviceBySecret(secret)
}

export function setMuted(secret: string, muted: boolean): PushDeviceRow | null {
  const device = deviceBySecret(secret)
  if (!device) return null
  sqlite
    .prepare("UPDATE push_devices SET muted = ?, updated_at = datetime('now') WHERE id = ?")
    .run(muted ? 1 : 0, device.id)
  return deviceBySecret(secret)
}

function disable(id: number, reason: string): void {
  console.warn(`push: disabling device ${id} (${reason})`)
  sqlite
    .prepare("UPDATE push_devices SET disabled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .run(id)
}

/**
 * Everyone worth telling about a new game: every live phone that is not the
 * host's own.
 *
 * Excluded by `user_id`, which is set on the host's device when they create a
 * room while signed in. Guests have no account and so no `user_id`, which is
 * exactly why this cannot be "every device belonging to another user" — for
 * most players there is no user to belong to. At four friends and one
 * household's worth of phones, "everybody else" IS the guest list.
 */
export function audienceExcludingHost(hostUserId: number): PushDeviceRow[] {
  return sqlite
    .prepare(
      `SELECT * FROM push_devices
       WHERE disabled_at IS NULL AND muted = 0
         AND (user_id IS NULL OR user_id != ?)
       ORDER BY id`,
    )
    .all(hostUserId) as PushDeviceRow[]
}

// ── Sending ─────────────────────────────────────────────────────────────────

// One ping replaces the last rather than stacking beneath it. A host who taps
// Create twice has made the first game irrelevant, and a lock screen holding
// two live invites is a way to send somebody to the wrong one.
//
// Deliberately ONE key across all three pings, not one per kind. A
// ten-round session would otherwise leave ten notifications on the lock
// screen of somebody who never came, all of them saying the same thing and
// all of them pointing at the same room. The newest is the only one worth
// reading, so it takes the place of the one before it.
//
// That holds for the quiet-spell ping too, which is why it does not get a key
// of its own: "somebody is guessing in the kitchen game" and "there is a game
// in the kitchen" are the same news with the same code and the same tap, and
// the later one is the true one.
const INVITE_COLLAPSE = 'gtl-invite'

export interface Invite {
  code: string
  hostName: string
  /** The host's name for the game, when they gave it one. */
  roomName: string | null
}

export function inviteText(invite: Invite): { title: string; body: string } {
  return {
    title: invite.roomName?.trim()
      ? `${invite.hostName} started ${invite.roomName.trim()}`
      : `${invite.hostName} started a game`,
    body: `Tap to join — code ${invite.code}`,
  }
}

/**
 * The same ping, for a round beginning rather than a game being created.
 *
 * Worded as news rather than as an invitation, because most of the people it
 * reaches are already in the room — unlike a create, a round start is not
 * excluded from anybody but the host. The code rides along regardless: the
 * apps use it to decide whether this is a room to join or the room you are
 * already sitting in, and the second case is a no-op on both.
 */
export function roundText(invite: Invite): { title: string; body: string } {
  return {
    title: invite.roomName?.trim()
      ? `New round in ${invite.roomName.trim()}`
      : `${invite.hostName} started a new round`,
    body: `Tap to join — code ${invite.code}`,
  }
}

/**
 * Somebody is playing again after a long quiet spell.
 *
 * `hostName` carries whoever typed the guess, which is not necessarily the
 * host — the point of this one is that a person is at the board, and naming
 * them is what makes it worth looking at. Everything else about it is the
 * invite: the same audience, the same code, the same tap.
 */
export function resumedText(invite: Invite): { title: string; body: string } {
  return {
    title: invite.roomName?.trim()
      ? `${invite.hostName} is guessing in ${invite.roomName.trim()}`
      : `${invite.hostName} has started guessing`,
    body: `Tap to join — code ${invite.code}`,
  }
}

/**
 * The host has given something away.
 *
 * `hostName` is the host here, unlike resumedText — taking a clue is one of
 * the few things only they can do.
 *
 * One line and no second one. The other three pings spell the join code out
 * underneath, because they are addressed at somebody who might not be in the
 * game; this one is for people who are, and it is finished saying what it has
 * to say. An empty body is dropped from the payload rather than sent blank —
 * see the gateways — so both phones show the single line.
 */
export function clueText(invite: Invite): { title: string; body: string } {
  return { title: `${invite.hostName} just revealed a clue`, body: '' }
}

/**
 * One slot left on the board.
 *
 * The one ping here that is not an invitation. It is addressed to the people
 * who are not playing — a round one answer from the end is the moment it is
 * worth picking the phone up for, and the moment it stops being worth it a
 * minute later. Hence the exclamation mark, which nothing else here has
 * earned.
 *
 * No code in the body, unlike the other three. The sentence is the whole
 * message and the tap already carries the code, so spelling it out would cost
 * the line its urgency to say something the phone already knows.
 */
export function lastSlotText(roomName: string | null): { title: string; body: string } {
  return {
    title: roomName?.trim() ? `${roomName.trim()} is one away` : 'One player left to guess',
    body: 'Only 1 player to guess in this round, go help them out!',
  }
}

/**
 * Tell every other phone that a game is waiting.
 *
 * The payload carries the code and nothing else that matters, because both
 * apps already know what to do with one: the tap handler builds the same
 * /join/<CODE> link an invite message carries and hands it to the existing
 * handleInvite path, which as of the last release will move you out of a
 * stale room rather than ignoring you.
 */
export async function sendInvite(invite: Invite, hostUserId: number): Promise<void> {
  await fanOut(invite.code, hostUserId, inviteText(invite), 'invite')
}

/** A round has begun in a room that already exists. See roundText. */
export async function sendRoundStarted(invite: Invite, hostUserId: number): Promise<void> {
  await fanOut(invite.code, hostUserId, roundText(invite), 'round')
}

/**
 * The first clue of a round has just gone up. See clueText.
 *
 * Which clue, and whether it is the first, is the caller's to know. This end
 * just sends — and sends to everybody but the host, who is the one person in
 * the room who already knows.
 */
export async function sendClueTaken(invite: Invite, hostUserId: number): Promise<void> {
  await fanOut(invite.code, hostUserId, clueText(invite), 'clue')
}

/**
 * A round is one answer from the end. See lastSlotText.
 *
 * Whether this is the ninth of ten or the ninth of nine is the caller's to
 * work out — an unordered round counts to its target and a ranked one counts
 * its empty slots, and only the game knows which it is holding.
 */
export async function sendLastSlot(
  room: { code: string; name: string | null },
  hostUserId: number,
): Promise<void> {
  await fanOut(room.code, hostUserId, lastSlotText(room.name), 'last-slot')
}

/**
 * A room that had gone quiet is being played again. See resumedText.
 *
 * The decision about WHEN — how long the quiet has to have lasted, and that
 * only the guess that breaks it counts — is the caller's, because it is a
 * question about the game rather than about notifications. This end just
 * sends.
 */
export async function sendRoomResumed(invite: Invite, hostUserId: number): Promise<void> {
  await fanOut(invite.code, hostUserId, resumedText(invite), 'resumed')
}

/**
 * Both pings go to the same people and travel the same way; only the words
 * and the `kind` differ. Shared rather than duplicated because the part worth
 * getting right — the two-gateway Apple dance, the dead-token reaping — must
 * not exist twice and drift.
 */
async function fanOut(
  code: string,
  hostUserId: number,
  text: { title: string; body: string },
  kind: 'invite' | 'round' | 'resumed' | 'last-slot' | 'clue',
): Promise<void> {
  if (!pushConfigured()) return
  const devices = audienceExcludingHost(hostUserId)
  if (!devices.length) return

  const data = { code, kind }
  const android = devices.filter((d) => d.platform === 'android')
  const ios = devices.filter((d) => d.platform === 'ios')

  await Promise.all([
    sendToAndroid(android, text.title, text.body, data),
    sendToIos(ios, text.title, text.body, data),
  ])
}

async function sendToAndroid(
  devices: PushDeviceRow[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  if (!devices.length || fcmMissing().length) return
  const messages: FcmMessage[] = devices.map((d) => ({
    token: d.token,
    title,
    body,
    data,
    collapseKey: INVITE_COLLAPSE,
  }))
  const results = await sendFcmBatch(messages)
  results.forEach((result, index) => {
    const device = devices[index]
    if (result.ok) return markSent(device.id)
    if (result.dead) disable(device.id, result.reason)
    else console.warn(`push: fcm to device ${device.id} failed: ${result.reason}`)
  })
}

/**
 * iOS, which has to work out which Apple gateway each token belongs to.
 *
 * A debug build on a phone plugged into this laptop and a TestFlight build of
 * the same app get tokens valid on different hosts, and the token does not say
 * which. So devices are grouped by what we last learned, the unknown ones are
 * tried on production first, and anything answered with BadDeviceToken is
 * retried on the other gateway — which also repairs a device that moved from a
 * development build to a TestFlight one, since its old environment is simply
 * wrong now rather than missing.
 */
async function sendToIos(
  devices: PushDeviceRow[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  if (!devices.length || apnsMissing().length) return

  const attempt = async (group: PushDeviceRow[], environment: ApnsEnvironment): Promise<PushDeviceRow[]> => {
    if (!group.length) return []
    const messages: ApnsMessage[] = group.map((d) => ({
      token: d.token,
      title,
      body,
      data,
      collapseId: INVITE_COLLAPSE,
    }))
    const results = await sendApnsBatch(messages, environment)
    const retry: PushDeviceRow[] = []
    results.forEach((result, index) => {
      const device = group[index]
      if (result.ok) {
        markSent(device.id, environment)
        return
      }
      if (result.retryOtherEnvironment) {
        retry.push(device)
        return
      }
      if (result.dead) disable(device.id, result.reason)
      else console.warn(`push: apns to device ${device.id} failed: ${result.reason}`)
    })
    return retry
  }

  const development = devices.filter((d) => d.apns_env === 'development')
  const production = devices.filter((d) => d.apns_env !== 'development')

  const [retryOnDevelopment, retryOnProduction] = await Promise.all([
    attempt(production, 'production'),
    attempt(development, 'development'),
  ])

  // The second pass is where a token lands on the right gateway. Anything
  // still refused there really is gone.
  const [stillBadOnDevelopment, stillBadOnProduction] = await Promise.all([
    attempt(retryOnDevelopment, 'development'),
    attempt(retryOnProduction, 'production'),
  ])
  for (const device of [...stillBadOnDevelopment, ...stillBadOnProduction]) {
    disable(device.id, 'BadDeviceToken on both gateways')
  }
}

function markSent(id: number, apnsEnv?: ApnsEnvironment): void {
  if (apnsEnv) {
    sqlite
      .prepare("UPDATE push_devices SET last_push_at = datetime('now'), apns_env = ? WHERE id = ?")
      .run(apnsEnv, id)
  } else {
    sqlite.prepare("UPDATE push_devices SET last_push_at = datetime('now') WHERE id = ?").run(id)
  }
}

// ── Diagnostics ─────────────────────────────────────────────────────────────

// "I'm not getting notifications" has about six causes and they are
// indistinguishable from the outside: the phone never registered, it muted
// itself, we disabled it after Apple refused its token, it is the host's own
// device and so excluded by design, or the push really did go out and iOS
// dropped it. Everything below exists to tell those apart from a terminal,
// because the alternative is guessing at somebody else's lock screen.

export interface DeviceSummary {
  id: number
  platform: string
  displayName: string | null
  /** Enough to recognise a phone, not enough to push to it. */
  tokenTail: string
  userId: number | null
  apnsEnv: string | null
  muted: boolean
  disabledAt: string | null
  lastPushAt: string | null
  createdAt: string | null
}

export function deviceSummaries(): DeviceSummary[] {
  const rows = sqlite
    .prepare(
      `SELECT id, platform, display_name, token, user_id, apns_env, muted,
              disabled_at, last_push_at, created_at
         FROM push_devices ORDER BY id`,
    )
    .all() as PushDeviceRow[]
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    displayName: row.display_name,
    // A push token is not a password, but it is the one value that lets a
    // stranger put words on somebody's lock screen, so it does not leave the
    // server even for an admin.
    tokenTail: `…${row.token.slice(-6)}`,
    userId: row.user_id,
    apnsEnv: row.apns_env,
    muted: !!row.muted,
    disabledAt: row.disabled_at,
    lastPushAt: row.last_push_at,
    createdAt: row.created_at,
  }))
}

export interface TestAttempt {
  gateway: string
  ok: boolean
  /** Apple's or Google's own word for it, unchanged. */
  reason?: string
}

export interface TestResult {
  deviceId: number
  platform: string
  delivered: boolean
  attempts: TestAttempt[]
  /** Set when nothing was tried, rather than tried and refused. */
  skipped?: string
}

/**
 * Send one real notification to one device and report what the gateway said.
 *
 * Three deliberate differences from the real fan-out, all of them because a
 * diagnostic must not change the thing it is measuring:
 *
 *   - no collapse id, so this cannot silently replace a live invite on
 *     somebody's lock screen, and cannot itself be replaced by one
 *   - a muted or disabled device is still sent to, because "why is this
 *     device disabled" is the exact question being asked. The flags are
 *     reported, not obeyed.
 *   - a refusal never calls disable(). A test that reaps the token it was
 *     sent to test destroys the evidence, and would turn a momentary Apple
 *     outage into a phone that has to reinstall the app to come back.
 *
 * Both iOS gateways are tried, best guess first, because a token that works
 * on the other one is the single most common cause of this report — a phone
 * that moved from a Xcode build to TestFlight keeps its row and changes its
 * gateway.
 */
export async function sendTestPush(deviceId: number): Promise<TestResult | null> {
  const device = sqlite
    .prepare('SELECT * FROM push_devices WHERE id = ?')
    .get(deviceId) as PushDeviceRow | undefined
  if (!device) return null

  const base = { deviceId: device.id, platform: device.platform }
  const title = 'Tenable test'
  const body = 'If you can read this, push works on this phone.'
  // `kind` is read by both apps' tap handlers. 'test' is not a room, so
  // neither will try to join one when this is tapped.
  const data = { kind: 'test', code: '' }

  if (device.platform === 'android') {
    if (fcmMissing().length) {
      return { ...base, delivered: false, attempts: [], skipped: `fcm not configured: ${fcmMissing().join(', ')}` }
    }
    const [result] = await sendFcmBatch([{ token: device.token, title, body, data }])
    if (result.ok) markSent(device.id)
    return {
      ...base,
      delivered: result.ok,
      attempts: [{ gateway: 'fcm', ok: result.ok, reason: result.ok ? undefined : result.reason }],
    }
  }

  if (apnsMissing().length) {
    return { ...base, delivered: false, attempts: [], skipped: `apns not configured: ${apnsMissing().join(', ')}` }
  }

  // Whatever we last learned about this phone, then the other one.
  const order: ApnsEnvironment[] =
    device.apns_env === 'development' ? ['development', 'production'] : ['production', 'development']

  const attempts: TestAttempt[] = []
  for (const environment of order) {
    const [result] = await sendApnsBatch(
      [{ token: device.token, title, body, data }],
      environment,
    )
    attempts.push({ gateway: environment, ok: result.ok, reason: result.ok ? undefined : result.reason })
    if (result.ok) {
      markSent(device.id, environment)
      return { ...base, delivered: true, attempts }
    }
    // Only a wrong-gateway refusal is worth asking the other host about. A
    // bad JWT or a missing topic fails identically on both and the second
    // answer adds nothing but noise.
    if (!result.retryOtherEnvironment) break
  }
  return { ...base, delivered: false, attempts }
}

// ── The attempt log ─────────────────────────────────────────────────────────

// See 0113_push_registration_attempts.sql. The registry can only describe
// phones that made it in; this is how a phone that did not gets a say.

export type RegistrationOutcome = 'registered' | 'rotated' | 'refused' | 'unknown-secret'

/** Bounded on purpose. This is a tail to read, not a history to keep. */
const ATTEMPTS_KEPT = 200

export function recordRegistrationAttempt(attempt: {
  platform: string | null
  token: string | null
  outcome: RegistrationOutcome
  reason?: string | null
  deviceId?: number | null
}): void {
  sqlite
    .prepare(
      `INSERT INTO push_registration_attempts (platform, token_tail, outcome, reason, device_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      attempt.platform,
      attempt.token ? `…${attempt.token.slice(-6)}` : null,
      attempt.outcome,
      attempt.reason ?? null,
      attempt.deviceId ?? null,
    )
  sqlite
    .prepare(
      `DELETE FROM push_registration_attempts
        WHERE id <= (SELECT MAX(id) - ? FROM push_registration_attempts)`,
    )
    .run(ATTEMPTS_KEPT)
}

export interface RegistrationAttempt {
  id: number
  platform: string | null
  tokenTail: string | null
  outcome: string
  reason: string | null
  deviceId: number | null
  at: string
}

export function recentRegistrationAttempts(limit = 25): RegistrationAttempt[] {
  const rows = sqlite
    .prepare(
      `SELECT id, platform, token_tail, outcome, reason, device_id, created_at
         FROM push_registration_attempts ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as {
    id: number
    platform: string | null
    token_tail: string | null
    outcome: string
    reason: string | null
    device_id: number | null
    created_at: string
  }[]
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    tokenTail: row.token_tail,
    outcome: row.outcome,
    reason: row.reason,
    deviceId: row.device_id,
    at: row.created_at,
  }))
}
