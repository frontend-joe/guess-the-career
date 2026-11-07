import { createPrivateKey, sign } from 'node:crypto'

// Google's half of the push layer.
//
// FCM's HTTP v1 API is ordinary HTTPS with an OAuth2 bearer token, so this
// needs no SDK: a service-account JWT is exchanged for an access token, and
// the access token sends messages. The legacy server-key API would have been
// one header and no JWT, and is switched off.
//
// Degrades to "not configured" without FCM_SERVICE_ACCOUNT, same as apns.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

export interface FcmConfig {
  projectId: string
  clientEmail: string
  privateKey: string
}

export interface FcmMessage {
  token: string
  title: string
  body: string
  data: Record<string, string>
  /// Replaces an older notification about the same game instead of stacking.
  collapseKey?: string
}

export type FcmResult =
  | { ok: true }
  | { ok: false; reason: string; dead: boolean }

export function fcmMissing(): string[] {
  return process.env.FCM_SERVICE_ACCOUNT?.trim() ? [] : ['FCM_SERVICE_ACCOUNT']
}

export function fcmConfig(): FcmConfig | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT?.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as {
      project_id?: string
      client_email?: string
      private_key?: string
    }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      console.warn('fcm: service account JSON is missing project_id, client_email or private_key')
      return null
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      // Same flattened-newline trap as the Apple key, and more common here
      // because this value is a JSON document that already escapes them once.
      privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    }
  } catch (err) {
    console.warn('fcm: FCM_SERVICE_ACCOUNT is not valid JSON:', err)
    return null
  }
}

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

// Google signs its assertions RS256, where Node's default DER encoding is the
// correct one — unlike Apple's ES256 next door, which needs raw coordinates.
function assertion(config: FcmConfig, now: number): string {
  const iat = Math.floor(now / 1000)
  const header = b64url({ alg: 'RS256', typ: 'JWT' })
  const claims = b64url({
    iss: config.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat,
    exp: iat + 3600,
  })
  const input = `${header}.${claims}`
  const signature = sign('sha256', Buffer.from(input), createPrivateKey(config.privateKey))
  return `${input}.${signature.toString('base64url')}`
}

// Access tokens last an hour; this refreshes a minute early so a token cannot
// expire between being read and being used.
let cachedAccess: { token: string; clientEmail: string; expiresAt: number } | null = null

export async function accessToken(config: FcmConfig, now = Date.now()): Promise<string | null> {
  if (cachedAccess && cachedAccess.clientEmail === config.clientEmail && cachedAccess.expiresAt > now) {
    return cachedAccess.token
  }
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: assertion(config, now),
  })
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const text = await response.text()
    if (!response.ok) {
      console.warn(`fcm: token exchange failed (${response.status}): ${text}`)
      return null
    }
    const parsed = JSON.parse(text) as { access_token?: string; expires_in?: number }
    if (!parsed.access_token) {
      console.warn('fcm: token exchange returned no access_token')
      return null
    }
    cachedAccess = {
      token: parsed.access_token,
      clientEmail: config.clientEmail,
      expiresAt: now + ((parsed.expires_in ?? 3600) - 60) * 1000,
    }
    return parsed.access_token
  } catch (err) {
    console.warn('fcm: token exchange failed:', err)
    return null
  }
}

/** Only for tests. */
export function resetAccessToken(): void {
  cachedAccess = null
}

// The v1 message body.
//
// `notification` is what Android draws when the app is not running — the
// system builds that one, not us, which is the whole point of pushing rather
// than polling. `data` is also present so a running app can act on the same
// message without parsing a display string.
export function fcmBody(message: FcmMessage): object {
  return {
    message: {
      token: message.token,
      // An empty body is left out rather than sent blank, so a one-line
      // message shows one line. See apnsPayload.
      notification: message.body
        ? { title: message.title, body: message.body }
        : { title: message.title },
      data: message.data,
      android: {
        // Delivered even in Doze. A game invite is worth nothing an hour late.
        priority: 'HIGH',
        ...(message.collapseKey ? { collapse_key: message.collapseKey } : {}),
        notification: {
          // Tapping must open the app rather than only dismiss, and the click
          // action is what MainActivity's intent filter answers.
          click_action: 'android.intent.action.MAIN',
          channel_id: 'games',
        },
      },
    },
  }
}

// A token Google has never heard of, or has stopped believing in. Worth
// separating from a transport failure: one means delete the row, the other
// means try again later.
const DEAD_CODES = new Set(['UNREGISTERED', 'INVALID_ARGUMENT', 'SENDER_ID_MISMATCH'])

function classify(status: number, text: string): FcmResult {
  if (status >= 200 && status < 300) return { ok: true }
  let reason = `HTTP ${status}`
  try {
    const parsed = JSON.parse(text) as {
      error?: { status?: string; message?: string; details?: { errorCode?: string }[] }
    }
    const code =
      parsed.error?.details?.find((d) => d.errorCode)?.errorCode ?? parsed.error?.status
    if (code) reason = code
    else if (parsed.error?.message) reason = parsed.error.message
  } catch {
    // Non-JSON means something other than FCM answered.
  }
  return { ok: false, reason, dead: DEAD_CODES.has(reason) || status === 404 }
}

export async function sendFcmBatch(messages: FcmMessage[]): Promise<FcmResult[]> {
  const config = fcmConfig()
  if (!config) {
    return messages.map(() => ({ ok: false as const, reason: 'fcm not configured', dead: false }))
  }
  if (!messages.length) return []
  const token = await accessToken(config)
  if (!token) {
    return messages.map(() => ({ ok: false as const, reason: 'fcm auth failed', dead: false }))
  }
  const url = `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`
  return Promise.all(
    messages.map(async (message): Promise<FcmResult> => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(fcmBody(message)),
          signal: AbortSignal.timeout(10_000),
        })
        return classify(response.status, await response.text())
      } catch (err) {
        return { ok: false, reason: String(err), dead: false }
      }
    }),
  )
}
