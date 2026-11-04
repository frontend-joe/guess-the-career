import { connect, constants, type ClientHttp2Session } from 'node:http2'
import { createPrivateKey, sign } from 'node:crypto'

// Apple's half of the push layer.
//
// Written against node:http2 directly rather than a library because APNs is a
// very small protocol once you have a JWT: one HTTP/2 POST per device, the
// device token in the path, the payload as the body. The alternative was a
// dependency carrying its own HTTP/2 handling onto a nixpacks container whose
// native-module story is already fragile, to save about sixty lines.
//
// Everything degrades to "not configured" when APNS_* is unset, so the server
// boots and games work on a machine with no Apple credentials — the same shape
// as livekit.ts.

// The two gateways. A token minted for a development build is only valid on
// the sandbox host and a TestFlight or App Store token only on production, and
// NOTHING in the token itself says which. Both answer the wrong one with
// BadDeviceToken, so the caller learns the environment by trying. See
// 0111_push_devices.sql.
const GATEWAY: Record<ApnsEnvironment, string> = {
  development: 'https://api.sandbox.push.apple.com',
  production: 'https://api.push.apple.com',
}

export type ApnsEnvironment = 'development' | 'production'

export interface ApnsConfig {
  keyId: string
  teamId: string
  privateKey: string
  topic: string
}

export interface ApnsMessage {
  token: string
  title: string
  body: string
  /// Travels back to the app untouched, and is what the tap handler reads to
  /// know which game to open.
  data: Record<string, string>
  /// Collapses an older notification for the same game rather than stacking a
  /// second one, so a host who taps Create twice does not buzz everyone twice.
  collapseId?: string
}

export type ApnsResult =
  | { ok: true }
  /// The token is dead — the app was deleted, or this is the wrong gateway.
  /// `retryOtherEnvironment` separates the two: a wrong-gateway token is
  /// perfectly good, just not here.
  | { ok: false; reason: string; dead: boolean; retryOtherEnvironment: boolean }

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

const REQUIRED = ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_PRIVATE_KEY'] as const

// Which credentials are missing, by name. A name is not a secret, and without
// this the failure is a silent "no notifications" that tells you nothing when
// the cause is a typo or the wrong Railway service.
export function apnsMissing(): string[] {
  return REQUIRED.filter((name) => env(name) == null)
}

export function apnsConfig(): ApnsConfig | null {
  if (apnsMissing().length) return null
  return {
    keyId: env('APNS_KEY_ID')!,
    teamId: env('APNS_TEAM_ID')!,
    // A .p8 is a PEM file, so its newlines are load-bearing. Pasting one into
    // a dashboard field often flattens them to the two characters \n, and the
    // key then fails to parse with an error about the PEM header that sends
    // you looking at the wrong thing entirely.
    privateKey: env('APNS_PRIVATE_KEY')!.replace(/\\n/g, '\n'),
    topic: env('APNS_TOPIC') ?? 'com.guessthelist.GuessTheList',
  }
}

// The provider token.
//
// APNs wants a fresh-ish ES256 JWT as a bearer credential, and explicitly
// refuses one older than an hour. It also rate-limits providers who mint a new
// one on every request, so this is cached and reissued well inside the window.
let cachedToken: { jwt: string; keyId: string; expiresAt: number } | null = null
const TOKEN_TTL_MS = 50 * 60 * 1000

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

export function providerToken(config: ApnsConfig, now = Date.now()): string {
  if (cachedToken && cachedToken.keyId === config.keyId && cachedToken.expiresAt > now) {
    return cachedToken.jwt
  }
  const header = b64url({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })
  const claims = b64url({ iss: config.teamId, iat: Math.floor(now / 1000) })
  const input = `${header}.${claims}`
  // JWT wants the two coordinates concatenated raw; Node signs ECDSA as DER
  // by default, and APNs rejects that with a bare 403 InvalidProviderToken
  // that looks exactly like a wrong key.
  const signature = sign('sha256', Buffer.from(input), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url')
  const jwt = `${input}.${signature}`
  cachedToken = { jwt, keyId: config.keyId, expiresAt: now + TOKEN_TTL_MS }
  return jwt
}

/** Only for tests, which mint tokens at fixed clock values. */
export function resetProviderToken(): void {
  cachedToken = null
}

// The JSON APNs receives. `aps` is Apple's; everything beside it is ours and
// is handed to the app verbatim.
export function apnsPayload(message: ApnsMessage): string {
  return JSON.stringify({
    aps: {
      alert: { title: message.title, body: message.body },
      sound: 'default',
      // Lets the app badge or refresh on arrival. Harmless when it does not.
      'content-available': 1,
    },
    ...message.data,
  })
}

function classify(status: number, body: string): ApnsResult {
  if (status === 200) return { ok: true }
  let reason = `HTTP ${status}`
  try {
    const parsed = JSON.parse(body) as { reason?: string }
    if (parsed.reason) reason = parsed.reason
  } catch {
    // APNs always sends JSON on an error, but a proxy in the way might not.
  }
  // 410 is Apple saying the app is gone from that device. BadDeviceToken on a
  // 400 is ambiguous and the caller resolves it by trying the other gateway.
  const wrongGateway = reason === 'BadDeviceToken'
  return {
    ok: false,
    reason,
    dead: status === 410 || reason === 'Unregistered' || wrongGateway,
    retryOtherEnvironment: wrongGateway,
  }
}

function postOne(
  session: ClientHttp2Session,
  config: ApnsConfig,
  jwt: string,
  message: ApnsMessage,
): Promise<ApnsResult> {
  return new Promise((resolve) => {
    const payload = apnsPayload(message)
    const headers: Record<string, string> = {
      [constants.HTTP2_HEADER_METHOD]: 'POST',
      [constants.HTTP2_HEADER_PATH]: `/3/device/${message.token}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': config.topic,
      // alert, because the point is that the phone is in a pocket.
      'apns-push-type': 'alert',
      'apns-priority': '10',
    }
    if (message.collapseId) headers['apns-collapse-id'] = message.collapseId

    const request = session.request(headers)
    let status = 0
    let body = ''
    request.setTimeout(10_000, () => {
      request.close()
      resolve({ ok: false, reason: 'timeout', dead: false, retryOtherEnvironment: false })
    })
    request.on('response', (responseHeaders) => {
      status = Number(responseHeaders[constants.HTTP2_HEADER_STATUS] ?? 0)
    })
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    request.on('end', () => resolve(classify(status, body)))
    request.on('error', (err: Error) => {
      resolve({ ok: false, reason: err.message, dead: false, retryOtherEnvironment: false })
    })
    request.end(payload)
  })
}

// Send a batch over one connection.
//
// One HTTP/2 session for the whole batch rather than per message, because
// these go out together — a game starting notifies everybody at once — and a
// TLS handshake each would be the slowest part of it by far. The session is
// closed at the end rather than pooled: a cached HTTP/2 session that has
// quietly died is a classic way to turn a push into a hang, and at a handful
// of notifications per game there is nothing to gain by keeping it.
export async function sendApnsBatch(
  messages: ApnsMessage[],
  environment: ApnsEnvironment,
): Promise<ApnsResult[]> {
  const config = apnsConfig()
  if (!config) {
    return messages.map(() => ({
      ok: false as const,
      reason: 'apns not configured',
      dead: false,
      retryOtherEnvironment: false,
    }))
  }
  if (!messages.length) return []

  const session = connect(GATEWAY[environment])
  const failAll = (reason: string): ApnsResult[] =>
    messages.map(() => ({ ok: false as const, reason, dead: false, retryOtherEnvironment: false }))

  try {
    await new Promise<void>((resolve, reject) => {
      session.once('connect', () => resolve())
      session.once('error', reject)
    })
  } catch (err) {
    session.destroy()
    return failAll(`apns connect failed: ${String(err)}`)
  }

  try {
    const jwt = providerToken(config)
    return await Promise.all(messages.map((message) => postOne(session, config, jwt, message)))
  } finally {
    session.close()
  }
}
