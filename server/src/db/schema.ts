import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const footballers = sqliteTable('footballers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  wikipedia_url: text('wikipedia_url').notNull().unique(),
  nationality: text('nationality'),
  position: text('position'),
  born: text('born'),
  photo_url: text('photo_url'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const career_stints = sqliteTable('career_stints', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  footballer_id: integer('footballer_id').notNull().references(() => footballers.id, { onDelete: 'cascade' }),
  sort_order: integer('sort_order').notNull(),
  years: text('years').notNull(),
  club: text('club').notNull(),
  club_wikipedia_url: text('club_wikipedia_url'),
  apps: integer('apps'),
  goals: integer('goals'),
  stint_type: text('stint_type').notNull().default('senior'),
})

export const days = sqliteTable('days', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  footballer_id: integer('footballer_id').references(() => footballers.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const managers = sqliteTable('managers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  wikipedia_url: text('wikipedia_url').notNull().unique(),
  place_of_birth: text('place_of_birth'),
  born: text('born'),
  photo_url: text('photo_url'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const manager_career_stints = sqliteTable('manager_career_stints', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  manager_id: integer('manager_id').notNull().references(() => managers.id, { onDelete: 'cascade' }),
  sort_order: integer('sort_order').notNull(),
  years: text('years').notNull(),
  club: text('club').notNull(),
  apps: integer('apps'),
  goals: integer('goals'),
  stint_type: text('stint_type').notNull().default('managerial'),
})

export const manager_days = sqliteTable('manager_days', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  manager_id: integer('manager_id').references(() => managers.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const clubs = sqliteTable('clubs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  wikipedia_url: text('wikipedia_url'),
})

export const wsm_leaderboard = sqliteTable('wsm_leaderboard', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  player_name: text('player_name').notNull(),
  time_ms: integer('time_ms').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const wpm_leaderboard = sqliteTable('wpm_leaderboard', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  player_name: text('player_name').notNull(),
  time_ms: integer('time_ms').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const xi_matches = sqliteTable('xi_matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  wikipedia_url: text('wikipedia_url').notNull().unique(),
  year: integer('year').notNull(),
  competition: text('competition').notNull(),
  home_team: text('home_team').notNull(),
  away_team: text('away_team').notNull(),
  home_team_active: integer('home_team_active', { mode: 'boolean' }).notNull().default(true),
  away_team_active: integer('away_team_active', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const xi_players = sqliteTable('xi_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  match_id: integer('match_id').notNull().references(() => xi_matches.id, { onDelete: 'cascade' }),
  team: text('team').notNull(),
  name: text('name').notNull(),
  position: text('position').notNull(),
  squad_number: integer('squad_number'),
  footballer_id: integer('footballer_id').references(() => footballers.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type XiMatch = typeof xi_matches.$inferSelect
export type NewXiMatch = typeof xi_matches.$inferInsert
export type XiPlayer = typeof xi_players.$inferSelect
export type NewXiPlayer = typeof xi_players.$inferInsert

export type Club = typeof clubs.$inferSelect
export type WsmLeaderboardEntry = typeof wsm_leaderboard.$inferSelect
export type WpmLeaderboardEntry = typeof wpm_leaderboard.$inferSelect

export type Footballer = typeof footballers.$inferSelect
export type NewFootballer = typeof footballers.$inferInsert
export type CareerStint = typeof career_stints.$inferSelect
export type NewCareerStint = typeof career_stints.$inferInsert
export type Day = typeof days.$inferSelect
export type Manager = typeof managers.$inferSelect
export type NewManager = typeof managers.$inferInsert
export type ManagerCareerStint = typeof manager_career_stints.$inferSelect
export type ManagerDay = typeof manager_days.$inferSelect
