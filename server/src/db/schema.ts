import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const footballers = sqliteTable('footballers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  wikipedia_url: text('wikipedia_url').notNull().unique(),
  nationality: text('nationality'),
  position: text('position'),
  all_positions: text('all_positions'),
  custom_position: text('custom_position'),
  style_of_play: text('style_of_play'),
  born: text('born'),
  birthplace: text('birthplace'),
  full_name: text('full_name'),
  height_cm: integer('height_cm'),
  photo_url: text('photo_url'),
  honors_champions_league: integer('honors_champions_league').notNull().default(0),
  honors_fa_cup:           integer('honors_fa_cup').notNull().default(0),
  honors_league_cup:       integer('honors_league_cup').notNull().default(0),
  honors_club_world_cup:   integer('honors_club_world_cup').notNull().default(0),
  honors_world_cup:        integer('honors_world_cup').notNull().default(0),
  honors_euros:            integer('honors_euros').notNull().default(0),
  honors_copa_america:     integer('honors_copa_america').notNull().default(0),
  honors_ballon_dor:       integer('honors_ballon_dor').notNull().default(0),
  honors_world_player:     integer('honors_world_player').notNull().default(0),
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
  home_body: text('home_body'),
  home_leftarm: text('home_leftarm'),
  home_rightarm: text('home_rightarm'),
  home_shorts: text('home_shorts'),
  home_socks: text('home_socks'),
  home_pattern: text('home_pattern'),  // 'stripes' | 'hoops' | 'halves' | 'sash' | null (solid)
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
  club_at_time: text('club_at_time'),
  number_colour: text('number_colour'),  // hex override for squad number colour in the kit game
  available_in_kits: integer('available_in_kits', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const xi_schedule = sqliteTable('xi_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  match_id: integer('match_id').references(() => xi_matches.id, { onDelete: 'set null' }),
  team: text('team'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const xi_leaderboard = sqliteTable('xi_leaderboard', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  player_name: text('player_name').notNull(),
  score: integer('score').notNull(),
  total: integer('total').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// Users for guessthelist.xyz — public players and admins (is_admin flag).
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash'),
  google_id: text('google_id').unique(),
  is_admin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// Transfer History game (transfermarkt-scraped league-season transfers).
// A window = one league-season; transfer_window_players = the selected transfers.
export const transfer_windows = sqliteTable('transfer_windows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  league: text('league').notNull(),
  league_code: text('league_code').notNull(),
  season_id: integer('season_id').notNull(),
  season_label: text('season_label').notNull(),
  source_url: text('source_url').notNull().unique(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const transfer_window_players = sqliteTable('transfer_window_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  window_id: integer('window_id').notNull().references(() => transfer_windows.id, { onDelete: 'cascade' }),
  footballer_id: integer('footballer_id').references(() => footballers.id, { onDelete: 'set null' }),
  player_name: text('player_name').notNull(),
  nationality: text('nationality'),
  position: text('position'),
  from_club: text('from_club').notNull(),
  from_club_wikipedia_url: text('from_club_wikipedia_url'),
  to_club: text('to_club').notNull(),
  to_club_wikipedia_url: text('to_club_wikipedia_url'),
  fee_text: text('fee_text'),
  fee_value: integer('fee_value'),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const transfer_history_schedule = sqliteTable('transfer_history_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  window_id: integer('window_id').references(() => transfer_windows.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const competitions = sqliteTable('competitions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  wikipedia_url: text('wikipedia_url').notNull().unique(),
  player_of_season_id: integer('player_of_season_id').references(() => footballers.id, { onDelete: 'set null' }),
  manager_of_season_id: integer('manager_of_season_id').references(() => managers.id, { onDelete: 'set null' }),
  pfa_toty_match_id: integer('pfa_toty_match_id').references(() => xi_matches.id, { onDelete: 'set null' }),
  image_url: text('image_url'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const competition_top_scorers = sqliteTable('competition_top_scorers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  competition_id: integer('competition_id').notNull().references(() => competitions.id, { onDelete: 'cascade' }),
  footballer_id: integer('footballer_id').references(() => footballers.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  club: text('club').notNull(),
  goals: integer('goals').notNull(),
  rank: integer('rank').notNull(),
})

export const competition_hat_tricks = sqliteTable('competition_hat_tricks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  competition_id: integer('competition_id').notNull().references(() => competitions.id, { onDelete: 'cascade' }),
  footballer_id: integer('footballer_id').references(() => footballers.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  for_club: text('for_club').notNull(),
  against_club: text('against_club').notNull(),
})

export const competition_top_assists = sqliteTable('competition_top_assists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  competition_id: integer('competition_id').notNull().references(() => competitions.id, { onDelete: 'cascade' }),
  footballer_id: integer('footballer_id').references(() => footballers.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  club: text('club').notNull(),
  assists: integer('assists').notNull(),
  rank: integer('rank').notNull(),
})

export const top_scorers_schedule = sqliteTable('top_scorers_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  competition_id: integer('competition_id').references(() => competitions.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const top_scorers_leaderboard = sqliteTable('top_scorers_leaderboard', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  player_name: text('player_name').notNull(),
  score: integer('score').notNull(),
  total: integer('total').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type XiScheduleEntry = typeof xi_schedule.$inferSelect
export type XiLeaderboardEntry = typeof xi_leaderboard.$inferSelect

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

export const sop_schedule = sqliteTable('sop_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  footballer_id: integer('footballer_id').references(() => footballers.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const sop_leaderboard = sqliteTable('sop_leaderboard', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  player_name: text('player_name').notNull(),
  score: integer('score').notNull(),
  total: integer('total').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const two_clubs_schedule = sqliteTable('two_clubs_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  club_a: text('club_a').notNull(),
  club_b: text('club_b').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const two_clubs_enabled_pairs = sqliteTable('two_clubs_enabled_pairs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  club_a: text('club_a').notNull(),
  club_b: text('club_b').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type TopScorersScheduleEntry = typeof top_scorers_schedule.$inferSelect
export type TopScorersLeaderboardEntry = typeof top_scorers_leaderboard.$inferSelect
export type SopScheduleEntry = typeof sop_schedule.$inferSelect
export type SopLeaderboardEntry = typeof sop_leaderboard.$inferSelect
export type TwoClubsEnabledPair = typeof two_clubs_enabled_pairs.$inferSelect
export type TwoClubsScheduleEntry = typeof two_clubs_schedule.$inferSelect

export const three_clubs_schedule = sqliteTable('three_clubs_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  club_a: text('club_a').notNull(),
  club_b: text('club_b').notNull(),
  club_c: text('club_c').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const three_clubs_enabled_trios = sqliteTable('three_clubs_enabled_trios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  club_a: text('club_a').notNull(),
  club_b: text('club_b').notNull(),
  club_c: text('club_c').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type ThreeClubsEnabledTrio = typeof three_clubs_enabled_trios.$inferSelect
export type ThreeClubsScheduleEntry = typeof three_clubs_schedule.$inferSelect

export type Competition = typeof competitions.$inferSelect
export type NewCompetition = typeof competitions.$inferInsert
export type CompetitionTopScorer = typeof competition_top_scorers.$inferSelect
export type CompetitionHatTrick = typeof competition_hat_tricks.$inferSelect
export type CompetitionTopAssist = typeof competition_top_assists.$inferSelect

export const ballon_dors = sqliteTable('ballon_dors', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  year:          integer('year').notNull().unique(),
  wikipedia_url: text('wikipedia_url').notNull().unique(),
  created_at:    text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const ballon_dor_players = sqliteTable('ballon_dor_players', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  ballon_dor_id: integer('ballon_dor_id').notNull().references(() => ballon_dors.id, { onDelete: 'cascade' }),
  footballer_id: integer('footballer_id').references(() => footballers.id, { onDelete: 'set null' }),
  name:          text('name').notNull(),
  nationality:   text('nationality'),
  club:          text('club').notNull(),
  points:        integer('points'),
  rank:          integer('rank').notNull(),
  wikipedia_url: text('wikipedia_url'),
})

export const ballon_dor_schedule = sqliteTable('ballon_dor_schedule', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  date:          text('date').notNull().unique(),
  ballon_dor_id: integer('ballon_dor_id').references(() => ballon_dors.id, { onDelete: 'set null' }),
  created_at:    text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type BallonDor = typeof ballon_dors.$inferSelect
export type BallonDorPlayer = typeof ballon_dor_players.$inferSelect
export type BallonDorScheduleEntry = typeof ballon_dor_schedule.$inferSelect

export const world_cup_squads = sqliteTable('world_cup_squads', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  year:          integer('year').notNull(),
  team:          text('team').notNull(),
  wikipedia_url: text('wikipedia_url').notNull(),
  created_at:    text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const world_cup_squad_players = sqliteTable('world_cup_squad_players', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  squad_id:      integer('squad_id').notNull().references(() => world_cup_squads.id, { onDelete: 'cascade' }),
  footballer_id: integer('footballer_id').references(() => footballers.id, { onDelete: 'set null' }),
  shirt_number:  integer('shirt_number'),
  position:      text('position'),
  name:          text('name').notNull(),
  club:          text('club').notNull(),
  nationality:   text('nationality'),
  wikipedia_url: text('wikipedia_url'),
})

export const world_cup_schedule = sqliteTable('world_cup_schedule', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  date:       text('date').notNull().unique(),
  squad_id:   integer('squad_id').references(() => world_cup_squads.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type WorldCupSquad = typeof world_cup_squads.$inferSelect
export type WorldCupSquadPlayer = typeof world_cup_squad_players.$inferSelect
export type WorldCupScheduleEntry = typeof world_cup_schedule.$inferSelect

export const nationals_enabled_combos = sqliteTable('nationals_enabled_combos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nationality: text('nationality').notNull(),
  club: text('club').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const nationals_schedule = sqliteTable('nationals_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  nationality: text('nationality').notNull(),
  club: text('club').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type NationalsEnabledCombo = typeof nationals_enabled_combos.$inferSelect
export type NationalsScheduleEntry = typeof nationals_schedule.$inferSelect

export const club_legends_enabled_clubs = sqliteTable('club_legends_enabled_clubs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  club: text('club').notNull().unique(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const club_legends_schedule = sqliteTable('club_legends_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  club: text('club').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type ClubLegendsEnabledClub = typeof club_legends_enabled_clubs.$inferSelect
export type ClubLegendsScheduleEntry = typeof club_legends_schedule.$inferSelect

export const club_marksman_enabled_clubs = sqliteTable('club_marksman_enabled_clubs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  club: text('club').notNull().unique(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const club_marksman_schedule = sqliteTable('club_marksman_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  club: text('club').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type ClubMarksmanEnabledClub = typeof club_marksman_enabled_clubs.$inferSelect
export type ClubMarksmanScheduleEntry = typeof club_marksman_schedule.$inferSelect

// Foreigners In England game.
export const foreigners_enabled_countries = sqliteTable('foreigners_enabled_countries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nationality: text('nationality').notNull().unique(),
  round_size: integer('round_size').notNull().default(5),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const foreigners_schedule = sqliteTable('foreigners_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  nationality: text('nationality').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const transfers_enabled_pairs = sqliteTable('transfers_enabled_pairs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  from_club: text('from_club').notNull(),
  to_club: text('to_club').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const transfers_schedule = sqliteTable('transfers_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  from_club: text('from_club').notNull(),
  to_club: text('to_club').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type TransfersEnabledPair = typeof transfers_enabled_pairs.$inferSelect
export type TransfersScheduleEntry = typeof transfers_schedule.$inferSelect
