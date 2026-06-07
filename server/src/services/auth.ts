import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { users } from '../db/schema.ts'

const COOKIE_NAME = 'gtl_session'
const THIRTY_DAYS = 60 * 60 * 24 * 30

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

export async function setSessionCookie(c: Context, user: { id: number; is_admin: boolean }) {
  const exp = Math.floor(Date.now() / 1000) + THIRTY_DAYS
  const token = await sign({ uid: user.id, is_admin: user.is_admin, exp }, authSecret())
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
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
}

// Resolve the current user from the session cookie, or null.
export async function getCurrentUser(c: Context): Promise<AuthUser | null> {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return null
  let payload: SessionPayload
  try {
    payload = (await verify(token, authSecret(), 'HS256')) as unknown as SessionPayload
  } catch {
    return null
  }
  const [row] = await db
    .select({ id: users.id, email: users.email, is_admin: users.is_admin })
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
