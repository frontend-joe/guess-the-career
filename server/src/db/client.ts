import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const dbPath = process.env.DATABASE_PATH ?? './data/db.sqlite'
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

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
