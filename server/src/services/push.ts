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
}

export type Platform = 'ios' | 'android'

/** Which credentials are absent, by name, for /api/health to report. */
export function pushMissing(): string[] {
  return [...apnsMissing(), ...fcmMissing()]
}

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
// Deliberately ONE key across invites and round starts, not one per kind. A
// ten-round session would otherwise leave ten notifications on the lock
// screen of somebody who never came, all of them saying the same thing and
// all of them pointing at the same room. The newest is the only one worth
// reading, so it takes the place of the one before it.
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
 * Tell every other phone that a game is waiting.
 *
 * The payload carries the code and nothing else that matters, because both
 * apps already know what to do with one: the tap handler builds the same
 * /join/<CODE> link an invite message carries and hands it to the existing
 * handleInvite path, which as of the last release will move you out of a
 * stale room rather than ignoring you.
 */
export async function sendInvite(invite: Invite, hostUserId: number): Promise<void> {
  await fanOut(invite, hostUserId, inviteText(invite), 'invite')
}

/** A round has begun in a room that already exists. See roundText. */
export async function sendRoundStarted(invite: Invite, hostUserId: number): Promise<void> {
  await fanOut(invite, hostUserId, roundText(invite), 'round')
}

/**
 * Both pings go to the same people and travel the same way; only the words
 * and the `kind` differ. Shared rather than duplicated because the part worth
 * getting right — the two-gateway Apple dance, the dead-token reaping — must
 * not exist twice and drift.
 */
async function fanOut(
  invite: Invite,
  hostUserId: number,
  text: { title: string; body: string },
  kind: 'invite' | 'round',
): Promise<void> {
  if (!pushConfigured()) return
  const devices = audienceExcludingHost(hostUserId)
  if (!devices.length) return

  const data = { code: invite.code, kind }
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
