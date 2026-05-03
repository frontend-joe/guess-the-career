import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const footballers = sqliteTable('footballers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  wikipedia_url: text('wikipedia_url').notNull().unique(),
  nationality: text('nationality'),
  position: text('position'),
  born: text('born'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const career_stints = sqliteTable('career_stints', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  footballer_id: integer('footballer_id').notNull().references(() => footballers.id, { onDelete: 'cascade' }),
  sort_order: integer('sort_order').notNull(),
  years: text('years').notNull(),
  club: text('club').notNull(),
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

export type Footballer = typeof footballers.$inferSelect
export type NewFootballer = typeof footballers.$inferInsert
export type CareerStint = typeof career_stints.$inferSelect
export type NewCareerStint = typeof career_stints.$inferInsert
export type Day = typeof days.$inferSelect
