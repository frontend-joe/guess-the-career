import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { users, auth_refresh_tokens } from '../db/schema.ts'

const COOKIE_NAME = 'gtl_session'
const THIRTY_DAYS = 60 * 60 * 24 * 30
// Native clients hold a short-lived bearer token and refresh it. Keep it short:
// revoking a refresh token should take effect in about an hour, not a month.
const ACCESS_TOKEN_TTL = 60 * 60

function authSecret(): string {
  return process.env.AUTH_SECRET ?? 'dev-insecure-secret-change-me'
}

// ── Password hashing (Node scrypt, no native deps) ──────────────────────────
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuf = Buffer.from(hash, 'hex')
  const testBuf = scryptSync(password, salt, 64)
  return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf)
}

// ── Session cookie (JWT) ────────────────────────────────────────────────────
export interface SessionPayload {
  uid: number
  is_admin: boolean
  exp: number
}

// Served over HTTPS in prod (Railway sets x-forwarded-proto). A non-Secure
// cookie over HTTPS is dropped by iOS Safari on reload, so derive Secure from
// the real request protocol — true in prod, false on local http.
function isHttps(c: Context): boolean {
  const proto = (c.req.header('x-forwarded-proto') ?? '').split(',')[0].trim()
  return proto === 'https' || process.env.NODE_ENV === 'production'
}

export async function setSessionCookie(c: Context, user: { id: number; is_admin: boolean }) {
  const exp = Math.floor(Date.now() / 1000) + THIRTY_DAYS
  const token = await sign({ uid: user.id, is_admin: user.is_admin, exp }, authSecret())
  const https = isHttps(c)
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    // Prod (HTTPS): SameSite=None + Secure so the cookie survives the
    // Netlify→Railway proxy round-trip and iOS Safari keeps it on reload.
    // Local (http): None needs Secure, so fall back to Lax.
    sameSite: https ? 'None' : 'Lax',
    secure: https,
    path: '/',
    maxAge: THIRTY_DAYS,
  })
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}

export interface AuthUser {
  id: number
  email: string
  is_admin: boolean
  display_name: string | null
  avatar_url: string | null
}

// Native clients send `Authorization: Bearer <jwt>`; the web client sends the
// cookie. Both carry the same signed SessionPayload, so everything downstream
// is unchanged — this is the whole native-auth integration.
function bearerToken(c: Context): string | null {
  const header = c.req.header('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null
}

// Resolve the current user from a bearer token or the session cookie, or null.
export async function getCurrentUser(c: Context): Promise<AuthUser | null> {
  const token = bearerToken(c) ?? getCookie(c, COOKIE_NAME)
  if (!token) return null
  let payload: SessionPayload
  try {
    payload = (await verify(token, authSecret(), 'HS256')) as unknown as SessionPayload
  } catch {
    return null
  }
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      is_admin: users.is_admin,
      display_name: users.display_name,
      avatar_url: users.avatar_url,
    })
    .from(users)
    .where(eq(users.id, payload.uid))
    .limit(1)
  return row ?? null
}

// Middleware: require a logged-in admin (used for /api/admin routes).
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = await getCurrentUser(c)
  if (!user || !user.is_admin) return c.json({ error: 'Unauthorized' }, 401)
  await next()
}

// Middleware: require any logged-in user. Multiplayer rooms are the first
// feature where every endpoint is authenticated — the older game routers are
// all public, and nothing in /api/rooms should follow that precedent.
export const requireUser: MiddlewareHandler = async (c, next) => {
  const user = await getCurrentUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  c.set('user', user)
  await next()
}

// ── Bearer tokens for native clients ────────────────────────────────────────

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

export async function signAccessToken(user: { id: number; is_admin: boolean }): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL
  return sign({ uid: user.id, is_admin: user.is_admin, exp }, authSecret())
}

export async function issueTokenPair(
  user: { id: number; is_admin: boolean },
  device: { deviceLabel?: string | null; platform?: string | null } = {},
): Promise<TokenPair> {
  const refreshToken = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + THIRTY_DAYS * 1000).toISOString()
  await db.insert(auth_refresh_tokens).values({
    user_id: user.id,
    token_hash: sha256(refreshToken),
    device_label: device.deviceLabel ?? null,
    platform: device.platform ?? null,
    expires_at: expiresAt,
  })
  return { accessToken: await signAccessToken(user), refreshToken, expiresIn: ACCESS_TOKEN_TTL }
}

// Rotate: the presented token is spent, a new one takes its place. Presenting
// an already-revoked token means it leaked, so every session for that user is
// torn down rather than just refusing this one request.
export async function rotateRefreshToken(presented: string): Promise<TokenPair | null> {
  const hash = sha256(presented)
  const [row] = await db
    .select()
    .from(auth_refresh_tokens)
    .where(eq(auth_refresh_tokens.token_hash, hash))
    .limit(1)
  if (!row) return null

  const now = new Date()
  if (row.revoked_at) {
    await db
      .update(auth_refresh_tokens)
      .set({ revoked_at: now.toISOString() })
      .where(and(eq(auth_refresh_tokens.user_id, row.user_id), isNull(auth_refresh_tokens.revoked_at)))
    return null
  }
  if (new Date(row.expires_at) < now) return null

  const [user] = await db
    .select({ id: users.id, is_admin: users.is_admin })
    .from(users)
    .where(eq(users.id, row.user_id))
    .limit(1)
  if (!user) return null

  await db
    .update(auth_refresh_tokens)
    .set({ revoked_at: now.toISOString(), last_used_at: now.toISOString() })
    .where(eq(auth_refresh_tokens.id, row.id))

  return issueTokenPair(user, { deviceLabel: row.device_label, platform: row.platform })
}

// ── Room-scoped tokens for guests ───────────────────────────────────────────
// A guest joins with a code and a name and never creates an account, so they
// need an identity that is real enough to act with and narrow enough to be
// harmless: this authorises exactly one seat in exactly one room.
//
// It carries no `uid`, so getCurrentUser() returns null for it and a guest can
// never reach a user- or admin-gated route with one.

const PARTICIPANT_TTL = 60 * 60 * 24

export interface ParticipantPayload {
  rid: number
  pid: number
  typ: 'participant'
  exp: number
}

export async function signParticipantToken(roomId: number, participantId: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + PARTICIPANT_TTL
  return sign({ rid: roomId, pid: participantId, typ: 'participant', exp }, authSecret())
}

export async function verifyParticipantToken(token: string): Promise<ParticipantPayload | null> {
  try {
    const payload = (await verify(token, authSecret(), 'HS256')) as unknown as ParticipantPayload
    return payload.typ === 'participant' ? payload : null
  } catch {
    return null
  }
}

export function requestBearer(c: Context): string | null {
  return bearerToken(c)
}

export async function revokeRefreshToken(presented: string): Promise<void> {
  await db
    .update(auth_refresh_tokens)
    .set({ revoked_at: new Date().toISOString() })
    .where(eq(auth_refresh_tokens.token_hash, sha256(presented)))
}

// On startup, create an admin user from env if it doesn't exist yet.
export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) return
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) return
  await db.insert(users).values({ email, password_hash: hashPassword(password), is_admin: true })
  console.log(`Bootstrapped admin user: ${email}`)
}
