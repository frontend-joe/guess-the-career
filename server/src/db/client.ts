import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema.ts'
import { normalizeClubAlias } from '../services/scraper.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

// DATABASE_PATH must point at a mounted volume in production. Railway's
// container filesystem is ephemeral and railway.toml cannot declare a volume
// (config-as-code doesn't support it), so this is set in the dashboard and
// nothing in the repo can enforce it. What we can do is make a wrong value
// obvious instead of silent — see reportDatabase() below.
const dbPath = process.env.DATABASE_PATH ?? './data/db.sqlite'

// Captured before the file is opened: better-sqlite3 creates it on open, so
// after this line "did it already exist?" is unanswerable.
const existedAtBoot = existsSync(dbPath)

export const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
// Explicit rather than relying on the 5s default: a long admin backfill holds
// the write lock, and every other request has to be willing to wait for it.
sqlite.pragma('busy_timeout = 5000')

export interface DatabaseInfo {
  path: string
  existedAtBoot: boolean
  sizeBytes: number
  footballers: number
}

export function databaseInfo(): DatabaseInfo {
  let footballers = 0
  try {
    footballers = (sqlite.prepare('SELECT COUNT(*) AS n FROM footballers').get() as { n: number }).n
  } catch {
    // Pre-migration or a brand-new file; 0 is the honest answer.
  }
  return {
    path: resolve(dbPath),
    existedAtBoot,
    sizeBytes: existsSync(dbPath) ? statSync(dbPath).size : 0,
    footballers,
  }
}

// Say out loud which database we are on. If a volume is ever detached or
// DATABASE_PATH is lost, the next deploy silently starts on an empty file and
// everything still "works" — this line is what makes that visible.
export function reportDatabase(): void {
  const info = databaseInfo()
  const mb = (info.sizeBytes / 1_000_000).toFixed(1)
  console.log(`Database: ${info.path} (${mb} MB, ${info.footballers} footballers)`)
  if (!info.existedAtBoot) {
    console.warn(`⚠ Database did not exist at boot and was CREATED at ${info.path}.`)
    console.warn('⚠ If this is production, DATABASE_PATH is not pointing at the volume and data is being lost.')
  }
}

const TRANSLITERATE: Record<string, string> = {
  ı: 'i', ł: 'l', ø: 'o', đ: 'd', ð: 'd',
  æ: 'a', œ: 'o', ħ: 'h', ŋ: 'n', ŧ: 't',
  þ: 'th', ß: 'ss',
}
const TRANSLIT_RE = /[ıłøđðæœħŋŧþß]/g

export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(TRANSLIT_RE, c => TRANSLITERATE[c] ?? c)
}

// Custom function for accent-insensitive search
sqlite.function('normalize', (s: unknown) => {
  if (typeof s !== 'string') return s
  return normalizeName(s)
})

// Canonicalize a club name in SQL (strips loan/→ markers and applies the club
// alias map, e.g. "Borussia Dortmund" → "Dortmund", "Internazionale" → "Inter
// Milan"). Lets raw-SQL games/rebuilds collapse the same club stored under
// different names. Mirrors normalizeClubAlias() in services/scraper.ts.
sqlite.function('normalize_club_alias', (s: unknown) => {
  if (typeof s !== 'string') return s
  return normalizeClubAlias(s)
})

export const db = drizzle(sqlite, { schema })

export function runMigrations() {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  // Seed 0001 as already-applied for existing DBs so the ALTER TABLE in 0002
  // doesn't run on a column that already exists from a prior init.
  const tablesExist = (() => {
    try { sqlite.prepare('SELECT 1 FROM footballers LIMIT 1').get(); return true } catch { return false }
  })()
  const anyMigrations = sqlite.prepare('SELECT 1 FROM _migrations LIMIT 1').get()
  if (tablesExist && !anyMigrations) {
    sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)').run('0001_init.sql')
  }

  const files = readdirSync(join(__dirname, 'migrations'))
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const name of files) {
    const already = sqlite.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(name)
    if (already) continue
    const sql = readFileSync(join(__dirname, 'migrations', name), 'utf-8')
    sqlite.transaction(() => {
      sqlite.exec(sql)
      sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name)
    })()
  }
}
