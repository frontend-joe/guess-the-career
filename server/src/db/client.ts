import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readFileSync } from 'node:fs'
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
  const sql = readFileSync(join(__dirname, 'migrations/0001_init.sql'), 'utf-8')
  sqlite.exec(sql)
}
