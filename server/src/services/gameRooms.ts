import { randomBytes } from 'node:crypto'
import { sqlite } from '../db/client.ts'
import {
  answersForRound,
  cluesForFootballers,
  impliedCluesFor,
  isOrdered,
  titleFor,
  ROUND_SIZE,
  type Metric,
} from './tenable.ts'
import { matchesName, norm, surnameOf } from './nameMatch.ts'
import { reduceEvents, type BoardState, type ReplayEvent } from './boardReplay.ts'

// Private multiplayer rooms. See migrations 0087-0089 for the data model and
// the invariants; this file enforces them.
//
// Writes that change the game go through sqlite.transaction() and bump
// state_version in the same transaction, so a client can always tell whether
// it has missed something. Raw SQL rather than Drizzle inside those blocks:
// better-sqlite3 transactions are synchronous and Drizzle's API is not.

// How far past the board we freeze, to keep near-miss feedback ("16th, 54
// goals") available without running a query mid-round.
const SNAPSHOT_DEPTH = 50

// No vowels (so a code can never spell something unfortunate) and no 0/O/1/I,
// because these get read aloud over a video call and typed by someone else.
const CODE_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 6

export type Verdict = 'hit' | 'near' | 'duplicate' | 'miss'

export interface GuessResult {
  verdict: Verdict
  rank: number | null
  value: number | null
  unit: string | null
  name: string | null
  replayed: boolean
  stateVersion: number
  complete: boolean
}

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return out
}

// ── Events ──────────────────────────────────────────────────────────────────
// Only ever called from inside a transaction: seq is MAX(seq)+1, which is safe
// because SQLite serialises writers, and the event has to land atomically with
// the change it describes.
function appendEvent(
  instanceId: number,
  tMs: number,
  type: string,
  actorParticipantId: number | null,
  payload: Record<string, unknown>,
): void {
  const { next } = sqlite
    .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM game_events WHERE instance_id = ?')
    .get(instanceId) as { next: number }
  sqlite
    .prepare(
      `INSERT INTO game_events (instance_id, seq, t_ms, type, actor_participant_id, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(instanceId, next, tMs, type, actorParticipantId, JSON.stringify(payload))
}

function bumpVersion(roomId: number): number {
  sqlite.prepare('UPDATE game_rooms SET state_version = state_version + 1 WHERE id = ?').run(roomId)
  const { state_version } = sqlite
    .prepare('SELECT state_version FROM game_rooms WHERE id = ?')
    .get(roomId) as { state_version: number }
  return state_version
}

// ── Rooms ───────────────────────────────────────────────────────────────────

export interface RoomRow {
  id: number
  code: string
  livekit_room: string
  host_user_id: number
  name: string | null
  status: string
  max_players: number
  state_version: number
}

export function roomByCode(code: string): RoomRow | null {
  return (sqlite
    .prepare('SELECT * FROM game_rooms WHERE code = ?')
    .get(code.toUpperCase()) as RoomRow | undefined) ?? null
}

export function createRoom(host: { id: number; displayName: string }, name?: string): RoomRow {
  // Retry on the astronomically unlikely code collision rather than pretending
  // it cannot happen; 28^6 is large but the UNIQUE constraint is the authority.
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode()
    try {
      const created = sqlite.transaction(() => {
        const info = sqlite
          .prepare(
            `INSERT INTO game_rooms (code, livekit_room, host_user_id, name)
             VALUES (?, ?, ?, ?)`,
          )
          .run(code, `gtl-${code}-${randomBytes(4).toString('hex')}`, host.id, name ?? null)
        const roomId = Number(info.lastInsertRowid)
        sqlite
          .prepare(
            `INSERT INTO game_participants (room_id, user_id, display_name, role, slot)
             VALUES (?, ?, ?, 'host', 0)`,
          )
          .run(roomId, host.id, host.displayName)
        return roomId
      })()
      return sqlite.prepare('SELECT * FROM game_rooms WHERE id = ?').get(created) as RoomRow
    } catch (err) {
      if (String(err).includes('UNIQUE') && attempt < 9) continue
      throw err
    }
  }
  throw new Error('Could not allocate a room code')
}

export interface ParticipantRow {
  id: number
  room_id: number
  user_id: number | null
  display_name: string
  role: string
  slot: number
  left_at: string | null
}

export function participantsOf(roomId: number): ParticipantRow[] {
  return sqlite
    .prepare('SELECT * FROM game_participants WHERE room_id = ? ORDER BY slot')
    .all(roomId) as ParticipantRow[]
}

export class RoomError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409) {
    super(message)
  }
}

// Join by code with a display name. userId is optional on purpose: guests are
// the point of this feature, and requiring a signup from the friend you are
// already on a call with is how you end up playing on your own.
export function joinRoom(
  code: string,
  displayName: string,
  opts: { userId?: number | null; platform?: string | null } = {},
): { room: RoomRow; participant: ParticipantRow } {
  const room = roomByCode(code)
  if (!room) throw new RoomError('No such room', 404)
  if (room.status === 'ended') throw new RoomError('That game has finished', 409)

  const participant = sqlite.transaction(() => {
    if (opts.userId != null) {
      const existing = sqlite
        .prepare('SELECT * FROM game_participants WHERE room_id = ? AND user_id = ?')
        .get(room.id, opts.userId) as ParticipantRow | undefined
      // Rejoining is not a new seat — it keeps the slot, so tile order in a
      // recording survives someone's phone dying.
      if (existing) {
        sqlite.prepare('UPDATE game_participants SET left_at = NULL WHERE id = ?').run(existing.id)
        bumpVersion(room.id)
        return sqlite.prepare('SELECT * FROM game_participants WHERE id = ?').get(existing.id) as ParticipantRow
      }
    }

    const taken = new Set(
      (sqlite.prepare('SELECT slot FROM game_participants WHERE room_id = ?').all(room.id) as { slot: number }[])
        .map((r) => r.slot),
    )
    let slot = -1
    for (let i = 0; i < room.max_players; i++) {
      if (!taken.has(i)) { slot = i; break }
    }
    if (slot < 0) throw new RoomError('That game is full', 409)

    const info = sqlite
      .prepare(
        `INSERT INTO game_participants (room_id, user_id, display_name, role, slot, platform)
         VALUES (?, ?, ?, 'player', ?, ?)`,
      )
      .run(room.id, opts.userId ?? null, displayName, slot, opts.platform ?? null)
    // The lobby is part of the state everyone watches, so arriving and leaving
    // bump the version like any other change.
    bumpVersion(room.id)
    return sqlite
      .prepare('SELECT * FROM game_participants WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as ParticipantRow
  })()

  return { room: roomByCode(code)!, participant }
}

export function leaveRoom(participantId: number): void {
  sqlite.transaction(() => {
    const info = sqlite
      .prepare("UPDATE game_participants SET left_at = datetime('now') WHERE id = ? AND left_at IS NULL")
      .run(participantId)
    if (info.changes === 0) return
    const row = sqlite
      .prepare('SELECT room_id FROM game_participants WHERE id = ?')
      .get(participantId) as { room_id: number } | undefined
    if (row) bumpVersion(row.room_id)
  })()
}

export function endRoom(roomId: number): void {
  sqlite.transaction(() => {
    sqlite.prepare("UPDATE game_rooms SET status = 'ended', ended_at = datetime('now') WHERE id = ?").run(roomId)
    sqlite
      .prepare("UPDATE game_round_instances SET status = 'abandoned' WHERE room_id = ? AND status IN ('pending','live')")
      .run(roomId)
    bumpVersion(roomId)
  })()
}

// ── Freezing a round ────────────────────────────────────────────────────────

export interface InstanceRow {
  id: number
  room_id: number
  round_id: number
  seq: number
  type: string
  params_json: string
  metric: string
  title: string
  ordered: number
  target: number
  implied_clues: string
  status: string
  started_at_ms: number | null
  ended_at_ms: number | null
}

// Freeze the board. After this returns, answersForRound() has no further say
// over this instance — see the comment at the top of migration 0088.
//
// Deliberately separate from startRound(): the derivation SQL is a heavy
// aggregate for several round types, and started_at_ms is the zero point every
// recording will be aligned against, so it must not be stamped after a
// multi-second query.
export function freezeRound(roomId: number, roundId: number): InstanceRow {
  const round = sqlite
    .prepare('SELECT id, type, params, metric, title FROM tenable_rounds WHERE id = ?')
    .get(roundId) as { id: number; type: string; params: string; metric: string; title: string } | undefined
  if (!round) throw new RoomError('Unknown round', 404)

  const params = JSON.parse(round.params) as Record<string, string>
  const metric = round.metric as Metric
  const ordered = isOrdered(round.type)
  const answers = answersForRound(round.type, params, metric, SNAPSHOT_DEPTH)
  if (answers.length < ROUND_SIZE) {
    throw new RoomError(`That round only has ${answers.length} answers right now`, 409)
  }

  const ids = answers.slice(0, ROUND_SIZE).map((a) => a.footballer_id).filter((x): x is number => x != null)
  const clues = cluesForFootballers(ids)

  const instanceId = sqlite.transaction(() => {
    const { next } = sqlite
      .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM game_round_instances WHERE room_id = ?')
      .get(roomId) as { next: number }

    const info = sqlite
      .prepare(
        `INSERT INTO game_round_instances
           (room_id, round_id, seq, type, params_json, metric, title, ordered, target, implied_clues)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        roomId, roundId, next, round.type, round.params, metric,
        titleFor(round.type, params, metric, round.title),
        ordered ? 1 : 0, ROUND_SIZE, JSON.stringify(impliedCluesFor(round.type)),
      )
    const id = Number(info.lastInsertRowid)

    const insert = sqlite.prepare(
      `INSERT INTO game_round_answers
         (instance_id, rank, on_board, footballer_id, name, name_norm, surname_norm,
          nationality, photo_url, value, unit, clue_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    answers.forEach((a, i) => {
      const rank = i + 1
      const normalized = norm(a.name)
      insert.run(
        id, rank, rank <= ROUND_SIZE ? 1 : 0, a.footballer_id, a.name, normalized, surnameOf(normalized),
        a.nationality, a.photo_url, a.value, a.unit ?? null,
        a.footballer_id != null && clues.has(a.footballer_id) ? JSON.stringify(clues.get(a.footballer_id)) : null,
      )
    })

    bumpVersion(roomId)
    return id
  })()

  return sqlite.prepare('SELECT * FROM game_round_instances WHERE id = ?').get(instanceId) as InstanceRow
}

// roomId is required rather than checked afterwards by the caller: starting a
// round is what stamps started_at_ms, and a host of one room must not be able
// to stamp T0 on another room's instance even if the response is then thrown
// away.
export function startRound(roomId: number, instanceId: number): InstanceRow {
  const inst = sqlite
    .prepare('SELECT * FROM game_round_instances WHERE id = ?')
    .get(instanceId) as InstanceRow | undefined
  if (!inst) throw new RoomError('Unknown round instance', 404)
  if (inst.room_id !== roomId) throw new RoomError('That round belongs to another room', 403)
  if (inst.status !== 'pending') throw new RoomError(`That round is already ${inst.status}`, 409)

  sqlite.transaction(() => {
    const startedAtMs = Date.now()
    sqlite
      .prepare("UPDATE game_round_instances SET status = 'live', started_at_ms = ? WHERE id = ?")
      .run(startedAtMs, instanceId)
    sqlite.prepare("UPDATE game_rooms SET status = 'live' WHERE id = ? AND status = 'lobby'").run(inst.room_id)
    appendEvent(instanceId, 0, 'round_start', null, {
      title: inst.title,
      target: inst.target,
      ordered: !!inst.ordered,
      metric: inst.metric,
      impliedClues: JSON.parse(inst.implied_clues),
    })
    bumpVersion(inst.room_id)
  })()

  return sqlite.prepare('SELECT * FROM game_round_instances WHERE id = ?').get(instanceId) as InstanceRow
}

// ── Guessing ────────────────────────────────────────────────────────────────

interface AnswerRow {
  id: number
  rank: number
  on_board: number
  name: string
  name_norm: string
  surname_norm: string
  value: number
  unit: string | null
  nationality: string | null
  photo_url: string | null
  found_at_ms: number | null
}

// Choose which answer a guess refers to.
//
// Taking the first fuzzy match is wrong, and a real board proves it: Serie A
// surnames starting Z contains BOTH Javier Zanetti (1st) and Cristiano Zanetti
// (8th). matchesName accepts a bare surname, so "Cristiano Zanetti" was being
// credited to Javier and rank 8 became unreachable — the same bug that showed
// up in the web game crediting every Taylor to Ian Taylor.
//
// So: an exact full-name match is unambiguous and always wins. Failing that,
// prefer someone not yet found, so repeating an ambiguous surname moves on to
// the next player it fits rather than endlessly re-hitting the first.
function pickAnswer(raw: string, answers: AnswerRow[]): AnswerRow | null {
  const g = norm(raw)
  const exact = answers.filter((a) => a.name_norm === g)
  if (exact.length) return exact.find((a) => a.found_at_ms == null) ?? exact[0]
  const fuzzy = answers.filter((a) => matchesName(raw, a.name))
  if (!fuzzy.length) return null
  return fuzzy.find((a) => a.found_at_ms == null) ?? fuzzy[0]
}

// The host guesses; everyone else shouts. Enforced here rather than in the UI,
// because a participant with the API would otherwise just guess anyway.
export function submitGuess(
  instanceId: number,
  participant: ParticipantRow,
  clientGuessId: string,
  raw: string,
): GuessResult {
  const inst = sqlite
    .prepare('SELECT * FROM game_round_instances WHERE id = ?')
    .get(instanceId) as InstanceRow | undefined
  if (!inst) throw new RoomError('Unknown round instance', 404)
  if (inst.room_id !== participant.room_id) throw new RoomError('Wrong room', 403)
  if (participant.role !== 'host') throw new RoomError('Only the host can enter guesses', 403)
  if (inst.status !== 'live') throw new RoomError(`That round is ${inst.status}`, 409)

  const room = sqlite.prepare('SELECT * FROM game_rooms WHERE id = ?').get(inst.room_id) as RoomRow

  // Replay a duplicate submission rather than scoring it twice. A phone on a
  // bad connection will send the same guess more than once.
  const prior = sqlite
    .prepare('SELECT * FROM game_guesses WHERE instance_id = ? AND client_guess_id = ?')
    .get(instanceId, clientGuessId) as { verdict: string; matched_rank: number | null } | undefined
  if (prior) {
    const hit = prior.matched_rank
      ? (sqlite.prepare('SELECT * FROM game_round_answers WHERE instance_id = ? AND rank = ?')
          .get(instanceId, prior.matched_rank) as AnswerRow | undefined)
      : undefined
    return {
      verdict: prior.verdict as Verdict,
      rank: prior.matched_rank,
      value: hit?.value ?? null,
      unit: hit?.unit ?? null,
      name: hit?.name ?? null,
      replayed: true,
      stateVersion: room.state_version,
      complete: inst.status !== 'live',
    }
  }

  // Server clock, always. Four phones disagreeing about the time must never
  // reach the board track that the recording is rendered from.
  const tMs = Date.now() - (inst.started_at_ms ?? Date.now())

  const answers = sqlite
    .prepare('SELECT * FROM game_round_answers WHERE instance_id = ? ORDER BY rank')
    .all(instanceId) as AnswerRow[]

  const match = pickAnswer(raw, answers)
  let verdict: Verdict
  if (!match) verdict = 'miss'
  else if (!match.on_board) verdict = 'near'
  else if (match.found_at_ms != null) verdict = 'duplicate'
  else verdict = 'hit'

  const stateVersion = sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO game_guesses
           (instance_id, participant_id, client_guess_id, raw, raw_norm, verdict, matched_rank, t_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(instanceId, participant.id, clientGuessId, raw, norm(raw), verdict, match?.rank ?? null, tMs)

    appendEvent(instanceId, tMs, 'guess', participant.id, {
      raw,
      verdict,
      matchedRank: match?.rank ?? null,
    })

    if (verdict === 'hit' && match) {
      sqlite
        .prepare('UPDATE game_round_answers SET found_at_ms = ?, found_by_participant_id = ? WHERE id = ?')
        .run(tMs, participant.id, match.id)
      appendEvent(instanceId, tMs, 'reveal', participant.id, {
        rank: match.rank,
        name: match.name,
        value: match.value,
        unit: match.unit,
        nationality: match.nationality,
        photoUrl: match.photo_url,
      })

      const { remaining } = sqlite
        .prepare('SELECT COUNT(*) AS remaining FROM game_round_answers WHERE instance_id = ? AND on_board = 1 AND found_at_ms IS NULL')
        .get(instanceId) as { remaining: number }
      if (remaining === 0) {
        sqlite
          .prepare("UPDATE game_round_instances SET status = 'complete', ended_at_ms = ? WHERE id = ?")
          .run(tMs, instanceId)
        appendEvent(instanceId, tMs, 'round_end', null, { reason: 'complete', found: inst.target, target: inst.target })
      }
    }

    // An unrecognised name is parked for review, never scraped mid-round.
    if (verdict === 'miss') {
      sqlite
        .prepare(
          `INSERT INTO game_guess_reviews (instance_id, raw, raw_norm) VALUES (?, ?, ?)
           ON CONFLICT (instance_id, raw_norm) DO NOTHING`,
        )
        .run(instanceId, raw, norm(raw))
    }

    return bumpVersion(inst.room_id)
  })()

  const after = sqlite
    .prepare('SELECT status FROM game_round_instances WHERE id = ?')
    .get(instanceId) as { status: string }

  return {
    verdict,
    rank: match?.rank ?? null,
    value: match?.value ?? null,
    unit: match?.unit ?? null,
    // Named on a near miss too: the host already said it, and confirming who
    // the server thinks they meant is the useful half of "16th, 54 goals".
    name: match?.name ?? null,
    replayed: false,
    stateVersion,
    complete: after.status === 'complete',
  }
}

// ── State ───────────────────────────────────────────────────────────────────

export interface RoomState {
  code: string
  status: string
  stateVersion: number
  livekitRoom: string
  hostUserId: number
  participants: { id: number; displayName: string; role: string; slot: number; present: boolean }[]
  round: {
    instanceId: number
    seq: number
    status: string
    startedAtMs: number | null
    board: BoardState
    blanks: number[]
  } | null
}

// The whole authoritative snapshot, rebuilt from SQLite on every call. This is
// the only recovery mechanism clients need: the server keeps no game state in
// memory, so a process that has just restarted answers this correctly.
export function roomState(room: RoomRow): RoomState {
  const inst = sqlite
    .prepare(
      `SELECT * FROM game_round_instances WHERE room_id = ?
       ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, seq DESC LIMIT 1`,
    )
    .get(room.id) as InstanceRow | undefined

  let round: RoomState['round'] = null
  if (inst) {
    const events = sqlite
      .prepare('SELECT seq, t_ms, type, actor_participant_id, payload FROM game_events WHERE instance_id = ? ORDER BY t_ms, seq')
      .all(inst.id) as ReplayEvent[]
    const board = reduceEvents(events)
    const found = new Set(board.revealed.map((r) => r.rank))
    round = {
      instanceId: inst.id,
      seq: inst.seq,
      status: inst.status,
      startedAtMs: inst.started_at_ms,
      board,
      // Which rows are still blank, so a client never has to infer it (and so
      // the unfound answers are never sent to anyone).
      blanks: Array.from({ length: inst.target }, (_, i) => i + 1).filter((r) => !found.has(r)),
    }
  }

  return {
    code: room.code,
    status: room.status,
    stateVersion: room.state_version,
    livekitRoom: room.livekit_room,
    hostUserId: room.host_user_id,
    participants: participantsOf(room.id).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      role: p.role,
      slot: p.slot,
      present: p.left_at == null,
    })),
    round,
  }
}
