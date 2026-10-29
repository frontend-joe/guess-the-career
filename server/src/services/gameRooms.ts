import { randomBytes } from 'node:crypto'
import { sqlite } from '../db/client.ts'
import {
  answersForRound,
  categoryOf,
  cluesForFootballers,
  transferCluesForWindow,
  impliedCluesFor,
  isOrdered,
  titleFor,
  ROUND_SIZE,
  type Metric,
} from './tenable.ts'
import { isPlaceExactly, matchesName, matchesPlace, norm, surnameOf } from './nameMatch.ts'
import { parseAliases } from './general.ts'
import { reduceEvents, type BoardState, type ReplayEvent } from './boardReplay.ts'
import { resolveOrCreateFootballer } from './playerImport.ts'
import { moderateMessage } from './moderation.ts'

// Private multiplayer rooms. See migrations 0087-0089 for the data model and
// the invariants; this file enforces them.
//
// Writes that change the game go through sqlite.transaction() and bump
// state_version in the same transaction, so a client can always tell whether
// it has missed something. Raw SQL rather than Drizzle inside those blocks:
// better-sqlite3 transactions are synchronous and Drizzle's API is not.

// How far past the board we freeze, so a wrong answer can still be told where
// it placed — "57th, 112 goals" — without running a query mid-round.
//
// 200 rather than 50 because at 50 most wrong answers were real players who
// simply fell outside it, and the game had nothing to say about them. These
// are ORDER BY ... LIMIT queries; 200 costs what 50 costs, and 200 rows per
// round instance is nothing.
//
// Deepening this cannot cost anybody a hit. The matcher reads the snapshot
// ORDER BY rank and takes the lowest-ranked unfound match, so a new row at
// rank 150 can only ever win when no lower-ranked answer matched at all.
const SNAPSHOT_DEPTH = 200

// No vowels (so a code can never spell something unfortunate) and no 0/O/1/I,
// because these get read aloud over a video call and typed by someone else.
const CODE_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 6

export type Verdict = 'hit' | 'near' | 'duplicate' | 'miss'

export interface GuessResult {
  verdict: Verdict
  /// On a miss: the player the DATABASE knows by that name, if any.
  ///
  /// "wrong" and "never heard of them" are different answers, and a miss
  /// alone cannot tell them apart. A name the database knows but which is not
  /// in this round's frozen answers either does not qualify for the round, or
  /// was added after it kicked off — and a player added mid-round can never
  /// appear on a board that was settled at the freeze.
  known: string | null
  /// A miss whose name has just been queued for a Wikipedia lookup, which
  /// can still land on THIS board and score.
  ///
  /// Without this the only honest answer the client could give was a flat
  /// "no player called Steele" — and then Jason Steele would appear on the
  /// board as a correct answer a few seconds later, having been learned and
  /// placed by the background resolver. The guess was not wrong; the answer
  /// was premature.
  checking: boolean
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
            `INSERT INTO game_rooms (code, livekit_room, host_user_id, name, max_players)
             VALUES (?, ?, ?, ?, 0)`,
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
  /// 1 when the host removed them, which is a different thing from leaving:
  /// it survives a rejoin attempt. See 0093_participant_removed.sql.
  removed: number
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
      // Removed means removed. Without this the host's only sanction lasts
      // exactly as long as it takes the removed player to tap Join again.
      if (existing?.removed) throw new RoomError('You were removed from that game', 403)
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
    // Lowest free index, with no ceiling unless the room asks for one.
    // max_players of 0 means unlimited, which is every room — the column is
    // kept for a host-set cap that does not exist yet.
    let slot = 0
    while (taken.has(slot)) slot++
    if (room.max_players > 0 && slot >= room.max_players) {
      throw new RoomError('That game is full', 409)
    }

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

// Remove someone from a room, host's orders.
//
// Returns the row so the caller can cut their call too — the LiveKit identity
// is derived from it. Throws rather than returning quietly, because every
// refusal here is something the host should be told: you cannot remove
// yourself (that is Leave), and you cannot remove the host (that is End game).
export function removeParticipant(roomId: number, actor: ParticipantRow, targetId: number): ParticipantRow {
  if (actor.role !== 'host') throw new RoomError('Only the host can remove a player', 403)
  if (actor.id === targetId) throw new RoomError('Use Leave to leave your own game', 400)

  const target = sqlite
    .prepare('SELECT * FROM game_participants WHERE id = ? AND room_id = ?')
    .get(targetId, roomId) as ParticipantRow | undefined
  if (!target) throw new RoomError('No such player in this game', 404)
  if (target.role === 'host') throw new RoomError('The host cannot be removed', 400)

  // Same revocation as leaving — the seat is what authorises everything, a
  // guess, a poll, a fresh LiveKit token — plus the flag that stops it being
  // handed straight back at the door.
  sqlite.transaction(() => {
    sqlite
      .prepare("UPDATE game_participants SET left_at = datetime('now'), removed = 1 WHERE id = ?")
      .run(target.id)
    bumpVersion(roomId)
  })()
  return target
}

/// File a report against another player. Nothing is enforced automatically:
/// the row exists to be read, and the host still has mute and remove for the
/// moment itself.
export function reportParticipant(
  roomId: number,
  reporter: ParticipantRow,
  targetId: number,
  reason: string,
  note: string | null,
): void {
  if (reporter.id === targetId) throw new RoomError('You cannot report yourself', 400)
  const target = sqlite
    .prepare('SELECT id FROM game_participants WHERE id = ? AND room_id = ?')
    .get(targetId, roomId) as { id: number } | undefined
  if (!target) throw new RoomError('No such player in this game', 404)

  // The most recent message from the reported player, if there is one. A
  // report about something said is far more use with the thing said attached.
  const lastMessage = sqlite
    .prepare('SELECT id FROM game_messages WHERE room_id = ? AND participant_id = ? ORDER BY id DESC LIMIT 1')
    .get(roomId, targetId) as { id: number } | undefined

  sqlite
    .prepare(
      `INSERT INTO game_reports (room_id, reporter_participant_id, target_participant_id, message_id, reason, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(roomId, reporter.id, targetId, lastMessage?.id ?? null, reason, note)
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
  const ordered = isOrdered(round.type, params)
  const answers = answersForRound(round.type, params, metric, SNAPSHOT_DEPTH)
  if (answers.length < ROUND_SIZE) {
    throw new RoomError(`That round only has ${answers.length} answers right now`, 409)
  }

  const ids = answers.slice(0, ROUND_SIZE).map((a) => a.footballer_id).filter((x): x is number => x != null)
  const clues = cluesForFootballers(ids)
  // A transfer round is asking about a MOVE, so its clues describe the move —
  // fee, from, to — not the player's career. Keyed by name, because a
  // transfer row can name somebody with no footballer record at all.
  const transferClues = round.type === 'transfer-window' && params.windowId
    ? transferCluesForWindow(parseInt(params.windowId, 10))
    : null

  const clueFor = (a: { footballer_id: number | null }, normalized: string): string | null => {
    const transfer = transferClues?.get(normalized)
    if (transfer) return JSON.stringify(transfer)
    if (a.footballer_id != null && clues.has(a.footballer_id)) {
      return JSON.stringify(clues.get(a.footballer_id))
    }
    return null
  }

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
          nationality, photo_url, value, unit, display, aliases, clue_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    answers.forEach((a, i) => {
      const rank = i + 1
      const normalized = norm(a.name)
      insert.run(
        // On an UNORDERED round — "name any ten of this squad" — every answer
        // is on the board. The rank is only the order they happen to be
        // listed in, and ranking the first ten of a squad list meant the
        // other thirteen players were told they were near misses.
        id, rank, ordered ? (rank <= ROUND_SIZE ? 1 : 0) : 1,
        a.footballer_id, a.name, normalized, surnameOf(normalized),
        a.nationality, a.photo_url, a.value, a.unit ?? null,
        // An authored round says how its badge should read; a derived one
        // leaves it to the client, which has only ever had the number.
        a.display ?? null,
        a.aliases?.length ? JSON.stringify(a.aliases) : null,
        clueFor(a, normalized),
      )
    })

    // Picking a different round before starting replaces the last pick rather
    // than stacking up behind it. Without this every unstarted choice stayed
    // pending for the rest of the game.
    sqlite
      .prepare("UPDATE game_round_instances SET status = 'abandoned' WHERE room_id = ? AND status = 'pending' AND id != ?")
      .run(roomId, id)

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
    // Starting settles it: no other pick is waiting any more. Without this a
    // round frozen and never started — including ones left behind by older
    // builds, which could be frozen DURING a live round and so carry a higher
    // seq — outranks the round you just finished and takes the board the
    // moment it ends. That is what made Give up jump to another round.
    sqlite
      .prepare("UPDATE game_round_instances SET status = 'abandoned' WHERE room_id = ? AND status = 'pending' AND id != ?")
      .run(inst.room_id, instanceId)
    sqlite.prepare("UPDATE game_rooms SET status = 'live' WHERE id = ? AND status = 'lobby'").run(inst.room_id)
    appendEvent(instanceId, 0, 'round_start', null, {
      title: inst.title,
      target: inst.target,
      ordered: !!inst.ordered,
      category: categoryOf(inst.type),
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
  /// Null for an answer with no footballer record — a transfer row can name
  /// somebody the footballers table has never heard of, and an authored answer
  /// is often not a person at all.
  footballer_id: number | null
  display: string | null
  aliases: string | null
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
function pickAnswer(raw: string, answers: AnswerRow[], category: string): AnswerRow | null {
  const prefer = (rows: AnswerRow[]) => rows.find((a) => a.found_at_ms == null) ?? rows[0]

  const g = norm(raw)
  const exact = answers.filter((a) => a.name_norm === g)
  if (exact.length) return prefer(exact)

  // Places are matched whole, with their authored aliases; people are matched
  // by the surname rules. See matchesPlace for why the two cannot be the same
  // function — "York" is not New York.
  if (category !== 'football') {
    // An exact alias before any fuzzy name, or the latitude that forgives a
    // typo lets one answer be credited to another: "The Gambia" is one edit
    // from Zambia and both are on the same board.
    const alias = answers.filter((a) => isPlaceExactly(raw, a.name, parseAliases(a.aliases)))
    if (alias.length) return prefer(alias)
    const close = answers.filter((a) => matchesPlace(raw, a.name, parseAliases(a.aliases)))
    return close.length ? prefer(close) : null
  }

  const fuzzy = answers.filter((a) => matchesName(raw, a.name))
  return fuzzy.length ? prefer(fuzzy) : null
}

// Anyone in the room may guess. It started host-only — everyone else shouts,
// one person types — but that made the game unplayable for whoever's
// microphone had failed, and the same fix that gave them chat should give
// them the keyboard.
//
// What stays host-only is everything that changes the shape of the game:
// freezing, starting, ending and taking a clue. Those are the host's calls.
// Guessing is just playing.
//
// Attribution is unaffected: found_by_participant_id has always recorded the
// participant who guessed, so the event log and the recording already know
// who got it.
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
      // A replay answers exactly as the first attempt did, so the same
      // lookup rather than a null — the retry is the same guess, not a
      // different one that happens to know less.
      known: hit ? null : knownPlayerNamed(raw)?.name ?? null,
      // A replay never queues a second lookup — the first attempt already
      // did, and the name is in the skip list by now.
      checking: false,
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

  // Which game this round is. Everything in this function that reaches for the
  // footballer database — parking an unknown name for review, looking it up,
  // putting a late-arriving player on the board — is football's and only
  // football's. An authored round's answers are the round, so a name that is
  // not among them is simply wrong, and there is nothing to go and find out.
  const category = categoryOf(inst.type)
  const match = pickAnswer(raw, answers, category)
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
        display: match.display,
        nationality: match.nationality,
        photoUrl: match.photo_url,
        footballerId: match.footballer_id,
      })

      // Ordered: done when every slot is filled. Unordered: done when enough
      // have been named — there are twenty-three in a squad and only ten
      // slots, so waiting for them all would never end.
      const done = inst.ordered
        ? (sqlite
            .prepare('SELECT COUNT(*) AS n FROM game_round_answers WHERE instance_id = ? AND on_board = 1 AND found_at_ms IS NULL')
            .get(instanceId) as { n: number }).n === 0
        : (sqlite
            .prepare('SELECT COUNT(*) AS n FROM game_round_answers WHERE instance_id = ? AND found_at_ms IS NOT NULL')
            .get(instanceId) as { n: number }).n >= inst.target
      if (done) {
        sqlite
          .prepare("UPDATE game_round_instances SET status = 'complete', ended_at_ms = ? WHERE id = ?")
          .run(tMs, instanceId)
        appendEvent(instanceId, tMs, 'round_end', null, { reason: 'complete', found: inst.target, target: inst.target })
      }
    }

    // An unrecognised name is parked for review, and looked up in the
    // background once the answer has already gone back — see
    // learnUnknownName, which is fired after this transaction commits.
    if (verdict === 'miss' && category === 'football') {
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

  const known = match || category !== 'football' ? null : knownPlayerNamed(raw)
  let checking = false

  if (verdict === 'miss' && category === 'football') {
    if (known == null) {
      // Nobody has heard of them. Look them up on its own, in the background,
      // after this answer has gone back — nothing waits on Wikipedia.
      checking = learnUnknownName(raw)
    } else {
      // The database DOES know them, and they are not on this board. If they
      // belong on it, put them there now and answer the guess as the hit it
      // always was.
      //
      // This used to run only for names that were newly LEARNED, which meant
      // the fix worked exactly once per player: the first person to say a
      // missing name got the board corrected, and everybody who said it
      // afterwards — in any later round frozen before the data caught up —
      // was told they were wrong.
      //
      // Synchronous, unlike the scrape, because it is only SQL: a re-derivation
      // and a rewrite, no network. Worth the few hundred milliseconds to
      // answer the guess correctly rather than a beat later.
      const placed = reshuffleForPlayer(instanceId, known.id, norm(raw))
      if (placed) {
        sqlite
          .prepare("UPDATE game_guesses SET verdict = 'hit', matched_rank = ? WHERE instance_id = ? AND client_guess_id = ?")
          .run(placed.rank, instanceId, clientGuessId)
        return {
          verdict: 'hit',
          known: null,
          checking: false,
          rank: placed.rank,
          value: placed.value,
          unit: placed.unit,
          name: placed.name,
          replayed: false,
          stateVersion: roomByCode(room.code)?.state_version ?? stateVersion,
          complete: (sqlite.prepare('SELECT status FROM game_round_instances WHERE id = ?')
            .get(instanceId) as { status: string }).status === 'complete',
        }
      }
    }
  }

  return {
    verdict,
    known: known?.name ?? null,
    checking,
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

// ── Hints ───────────────────────────────────────────────────────────────────

export interface HintResult {
  rank: number
  clue: Record<string, string | number | null> | null
  stateVersion: number
  replayed: boolean
}

// Take a clue on a slot that is still blank.
//
// The clue comes out of the frozen snapshot, not from the footballer tables,
// so it describes the player who was the answer when the round started even if
// the database has moved on since.
//
// It is appended to the event log rather than just returned, because the board
// track of the recording has to show the clue appearing when it was asked for.
// A hint that existed only in the host's browser would be invisible in the
// video, and the round would make no sense to watch.
// The host decides when to spend a clue — it is a shared resource, and four
// people all tapping for one is not a decision anybody made. But the CLUE
// itself is not the host's: the moment it is taken it goes in the event log,
// every client sees it on the next state, and every client opens it. Nobody
// has to read it out.
export function takeHint(instanceId: number, participant: ParticipantRow, rank: number): HintResult {
  const inst = sqlite
    .prepare('SELECT * FROM game_round_instances WHERE id = ?')
    .get(instanceId) as InstanceRow | undefined
  if (!inst) throw new RoomError('Unknown round instance', 404)
  if (inst.room_id !== participant.room_id) throw new RoomError('Wrong room', 403)
  if (participant.role !== 'host') throw new RoomError('Only the host can take a clue', 403)
  if (inst.status !== 'live') throw new RoomError(`That round is ${inst.status}`, 409)

  // On an unordered round the slot you held is not an answer — the board
  // fills from the top as people are named — so the clue is about whoever is
  // still missing rather than about rank N of a squad list.
  const answer = (inst.ordered
    ? sqlite
        .prepare('SELECT rank, on_board, clue_json, found_at_ms FROM game_round_answers WHERE instance_id = ? AND rank = ?')
        .get(instanceId, rank)
    : sqlite
        .prepare(
          `SELECT rank, on_board, clue_json, found_at_ms FROM game_round_answers
           WHERE instance_id = ? AND on_board = 1 AND found_at_ms IS NULL ORDER BY rank LIMIT 1`,
        )
        .get(instanceId)) as { rank: number; on_board: number; clue_json: string | null; found_at_ms: number | null } | undefined
  if (!answer || !answer.on_board) throw new RoomError('No such slot on this board', 404)
  if (answer.found_at_ms != null) throw new RoomError('That one is already found', 409)

  const room = sqlite.prepare('SELECT * FROM game_rooms WHERE id = ?').get(inst.room_id) as RoomRow
  const clue = answer.clue_json
    ? (JSON.parse(answer.clue_json) as Record<string, string | number | null>)
    : null

  // The clue belongs to the ANSWER, which on an unordered round is not the
  // slot that was held. Recording it against the slot would let one squad
  // member's clue be asked for ten times over, once per row.
  const clued = answer.rank

  // Asking twice is not a second clue, and must not move the version — the
  // board already shows it, and a recording should not blink.
  const existing = sqlite
    .prepare("SELECT 1 FROM game_events WHERE instance_id = ? AND type = 'hint' AND json_extract(payload, '$.rank') = ?")
    .get(instanceId, clued)
  if (existing) return { rank: clued, clue, stateVersion: room.state_version, replayed: true }

  const stateVersion = sqlite.transaction(() => {
    appendEvent(instanceId, Date.now() - (inst.started_at_ms ?? Date.now()), 'hint', participant.id, { rank: clued, clue })
    return bumpVersion(inst.room_id)
  })()

  return { rank: clued, clue, stateVersion, replayed: false }
}

// Does the database know anybody by this name, whatever the round thinks?
//
// Matched on the whole name or on the surname as a WHOLE WORD — `LIKE '%egan'`
// would have answered "Kevin Keegan" to "Egan", which is precisely the
// confusion this is meant to clear up.
function knownPlayerNamed(raw: string): { id: number; name: string } | null {
  const row = sqlite
    .prepare(
      // Any WHOLE word of the name, padded so the LIKE cannot match a
      // fragment: ' raul ' is in ' raul gonzalez ' but 'egan' being in
      // 'keegan' is exactly the false positive this padding prevents.
      `SELECT id, name FROM footballers
       WHERE normalize(name) = normalize(?)
          OR (' ' || normalize(name) || ' ') LIKE '% ' || normalize(?) || ' %'
       LIMIT 1`,
    )
    .get(raw, raw) as { id: number; name: string } | undefined
  return row ?? null
}

// ── Unknown names ───────────────────────────────────────────────────────────

// Look a name up in the background, once ever, and never make anyone wait.
//
// This fires AFTER the guess has been answered, so nothing in the round waits
// on Wikipedia — the thing the plan rightly forbids is BLOCKING on a scrape
// mid-round, not learning from one. It cannot disturb the game either: the
// round's answers were frozen at kickoff, so a player added now can only ever
// show up in the NEXT round.
//
// Deduped across the whole database by normalised name, so a name is attempted
// once and never again — including the ones that turn out not to be players.
// Otherwise every repetition of a nonsense guess is another Wikipedia search.
/// Returns whether a lookup was actually queued, so the guess that triggered
/// it can say "checking" rather than "never heard of them" — a name that is
/// about to be looked up may yet turn out to belong on the board.
export function learnUnknownName(raw: string): boolean {
  const normalized = norm(raw)
  // Not worth a network round trip: a couple of characters cannot identify
  // anybody, and the resolver would only guess.
  if (normalized.length < 4) return false

  // Skip a name we have already resolved, and a name we failed on RECENTLY.
  //
  // Not failed-ever: the first version blacklisted on any failure, so a
  // lookup that died halfway — a crash, a deploy, Wikipedia having a moment —
  // poisoned that name permanently and no amount of guessing it again would
  // ever try once more. An hour is long enough that repeating a nonsense
  // guess costs nothing and short enough that a real player is not lost.
  const skip = sqlite
    .prepare(
      `SELECT 1 FROM game_guess_reviews
       WHERE raw_norm = ?
         AND (status = 'resolved'
              OR (status = 'unresolved' AND created_at > datetime('now', '-1 hour')))
       LIMIT 1`,
    )
    .get(normalized)
  if (skip) return false

  // Queued, not fired. Four people guessing wildly used to start four
  // scrapes at once, each one a run of Wikipedia fetches and a parse, on a
  // container that is also running the game.
  learnQueue.push({ raw, normalized })
  void drainLearnQueue()
  return true
}

const learnQueue: { raw: string; normalized: string }[] = []
let learning = false

async function drainLearnQueue(): Promise<void> {
  if (learning) return
  learning = true
  try {
    while (learnQueue.length > 0) {
      const next = learnQueue.shift()!
      // EVERYTHING in here is inside a catch. This runs detached from any
      // request, so an escaping rejection is an unhandled rejection, and an
      // unhandled rejection takes the whole server down — which is what a
      // guess answering 502 looks like from a phone.
      try {
        let id: number | null = null
        try {
          ;({ id } = await resolveOrCreateFootballer(next.raw, ''))
        } catch (err) {
          console.warn(`[reviews] could not resolve "${next.raw}":`, err)
          id = null
        }
        // Mark every pending row for this name, in whatever room it was said,
        // so the next attempt is skipped whether it worked or not.
        sqlite
          .prepare(
            `UPDATE game_guess_reviews
             SET status = ?, resolved_footballer_id = ?
             WHERE raw_norm = ? AND status = 'pending'`,
          )
          .run(id == null ? 'unresolved' : 'resolved', id, next.normalized)
        if (id != null) {
          console.log(`[reviews] learned "${next.raw}" -> footballer ${id}`)
          // If they belong on a board being played right now, put them there.
          const live = sqlite
            .prepare(
              `SELECT DISTINCT r.instance_id FROM game_guess_reviews r
               JOIN game_round_instances i ON i.id = r.instance_id
               WHERE r.raw_norm = ? AND i.status = 'live'`,
            )
            .all(next.normalized) as { instance_id: number }[]
          for (const row of live) {
            try {
              reshuffleForPlayer(row.instance_id, id, next.normalized)
            } catch (err) {
              console.error(`[reviews] reshuffle failed for instance ${row.instance_id}:`, err)
            }
          }
        }
      } catch (err) {
        console.error(`[reviews] background lookup failed for "${next.raw}":`, err)
      }
    }
  } finally {
    learning = false
  }
}

export interface ReviewResolution {
  added: string[]
  alreadyKnown: string[]
  failed: string[]
}

// Turn the names the game did not recognise into players it does.
//
// Every unrecognised guess has been recorded in game_guess_reviews since the
// room code was written, and nothing has ever read it. This is what it was
// for: a guess the database has never heard of is not a bug report, it is a
// gap, and the person who found it has just told us exactly which one.
//
// AFTER the round, never during it. Resolving means fetching Wikipedia, which
// is unbounded, and the round's answers are frozen anyway — a player added
// mid-round could not appear on a board that was settled at kickoff. What it
// buys is the NEXT time somebody says that name.
//
// Bounded per call, because each name is a handful of network round trips and
// this runs inside a request.
const REVIEW_BATCH = 8

export async function resolvePendingReviews(roomId: number): Promise<ReviewResolution> {
  const pending = sqlite
    .prepare(
      `SELECT r.id, r.raw FROM game_guess_reviews r
       JOIN game_round_instances i ON i.id = r.instance_id
       WHERE i.room_id = ? AND r.status = 'pending'
       ORDER BY r.id LIMIT ?`,
    )
    .all(roomId, REVIEW_BATCH) as { id: number; raw: string }[]

  const out: ReviewResolution = { added: [], alreadyKnown: [], failed: [] }

  for (const review of pending) {
    let id: number | null = null
    let created = false
    try {
      // No club hint: the guess was a bare name, which is the whole reason it
      // did not match anything.
      ;({ id, created } = await resolveOrCreateFootballer(review.raw, ''))
    } catch {
      // A scrape that throws is a name we could not resolve, not a reason to
      // abandon the rest of the batch.
      id = null
    }

    if (id == null) {
      out.failed.push(review.raw)
      sqlite.prepare("UPDATE game_guess_reviews SET status = 'unresolved' WHERE id = ?").run(review.id)
      continue
    }

    ;(created ? out.added : out.alreadyKnown).push(review.raw)
    sqlite
      .prepare("UPDATE game_guess_reviews SET status = 'resolved', resolved_footballer_id = ? WHERE id = ?")
      .run(id, review.id)
  }

  return out
}

// A player the database had never heard of turns out to belong on the board.
//
// The frozen snapshot exists so answers cannot move under people mid-round,
// and that still holds for everything the round knew at kickoff. This is the
// one case it was never protecting against: the board was wrong, somebody
// said so out loud, and the database has now caught up. Leaving it wrong to
// protect a snapshot of a wrong board helps nobody.
//
// It is ONE event carrying the whole revealed set at its new ranks, so the
// fold stays a fold and the recording reproduces exactly what players saw.
function reshuffleForPlayer(
  instanceId: number,
  footballerId: number,
  rawNorm: string,
): { rank: number; name: string; value: number; unit: string | null } | null {
  const inst = sqlite
    .prepare('SELECT * FROM game_round_instances WHERE id = ?')
    .get(instanceId) as InstanceRow | undefined
  if (!inst || inst.status !== 'live') return null
  // Nothing to reshuffle on an unordered round: the answers are a squad list,
  // not a ranking, and a new player cannot displace anybody from it.
  if (!inst.ordered) return null

  const params = JSON.parse(inst.params_json) as Record<string, string>
  const fresh = answersForRound(inst.type, params, inst.metric as Metric, SNAPSHOT_DEPTH)

  const newIndex = fresh.findIndex((a) => a.footballer_id === footballerId)
  // Not on the board after all — they qualify for the round but not the top
  // ten. Nothing to reshuffle; the near-miss feedback already covers it.
  if (newIndex < 0 || newIndex >= ROUND_SIZE) return null

  const current = sqlite
    .prepare('SELECT footballer_id, found_at_ms, found_by_participant_id FROM game_round_answers WHERE instance_id = ? AND found_at_ms IS NOT NULL')
    .all(instanceId) as { footballer_id: number | null; found_at_ms: number; found_by_participant_id: number | null }[]

  // Never take a find away. If anybody already on the board would be pushed
  // off by this, leave the board alone — a correction that deletes somebody's
  // answer is worse than the board being one name short.
  const onBoardNow = new Set(
    fresh.slice(0, ROUND_SIZE).map((a) => a.footballer_id).filter((x): x is number => x != null),
  )
  if (current.some((c) => c.footballer_id != null && !onBoardNow.has(c.footballer_id))) return null

  // Whoever said the name gets the credit for it. They did guess correctly;
  // the database was the one that was wrong.
  const guesser = sqlite
    .prepare('SELECT participant_id FROM game_guesses WHERE instance_id = ? AND raw_norm = ? ORDER BY id DESC LIMIT 1')
    .get(instanceId, rawNorm) as { participant_id: number } | undefined

  const foundBefore = new Map(current.map((c) => [c.footballer_id, c]))
  const ids = fresh.slice(0, ROUND_SIZE).map((a) => a.footballer_id).filter((x): x is number => x != null)
  const clues = cluesForFootballers(ids)
  const tMs = Date.now() - (inst.started_at_ms ?? Date.now())

  sqlite.transaction(() => {
    sqlite.prepare('DELETE FROM game_round_answers WHERE instance_id = ?').run(instanceId)
    const insert = sqlite.prepare(
      `INSERT INTO game_round_answers
         (instance_id, rank, on_board, footballer_id, name, name_norm, surname_norm,
          nationality, photo_url, value, unit, display, aliases, clue_json,
          found_at_ms, found_by_participant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )

    const revealed: Record<string, unknown>[] = []
    fresh.forEach((a, i) => {
      const rank = i + 1
      const normalized = norm(a.name)
      const prior = a.footballer_id != null ? foundBefore.get(a.footballer_id) : undefined
      const isTheNewOne = a.footballer_id === footballerId
      const foundAt = prior?.found_at_ms ?? (isTheNewOne ? tMs : null)
      const foundBy = prior?.found_by_participant_id ?? (isTheNewOne ? guesser?.participant_id ?? null : null)

      insert.run(
        instanceId, rank, rank <= ROUND_SIZE ? 1 : 0, a.footballer_id, a.name, normalized,
        surnameOf(normalized), a.nationality, a.photo_url, a.value, a.unit ?? null,
        a.display ?? null, a.aliases?.length ? JSON.stringify(a.aliases) : null,
        a.footballer_id != null && clues.has(a.footballer_id) ? JSON.stringify(clues.get(a.footballer_id)) : null,
        foundAt, foundBy,
      )

      if (rank <= ROUND_SIZE && foundAt != null) {
        revealed.push({
          rank, name: a.name, value: a.value, unit: a.unit ?? null, display: a.display ?? null,
          nationality: a.nationality, photoUrl: a.photo_url,
          footballerId: a.footballer_id, byParticipantId: foundBy,
        })
      }
    })

    appendEvent(instanceId, tMs, 'board_reshuffle', guesser?.participant_id ?? null, {
      name: fresh[newIndex].name,
      rank: newIndex + 1,
      revealed,
    })

    const remaining = sqlite
      .prepare('SELECT COUNT(*) AS n FROM game_round_answers WHERE instance_id = ? AND on_board = 1 AND found_at_ms IS NULL')
      .get(instanceId) as { n: number }
    if (remaining.n === 0) {
      sqlite.prepare("UPDATE game_round_instances SET status = 'complete', ended_at_ms = ? WHERE id = ?").run(tMs, instanceId)
      appendEvent(instanceId, tMs, 'round_end', null, { reason: 'complete', found: inst.target, target: inst.target })
    }

    bumpVersion(inst.room_id)
  })()

  console.log(`[reviews] reshuffled instance ${instanceId}: ${fresh[newIndex].name} is ${newIndex + 1}`)
  roomChanged?.(inst.room_id, 'board_reshuffle')

  const placed = fresh[newIndex]
  return { rank: newIndex + 1, name: placed.name, value: placed.value, unit: placed.unit ?? null }
}

// Set by the router at boot, so this service can tell the room something
// changed without importing the transport.
let roomChanged: ((roomId: number, kind: string) => void) | null = null
export function onRoomChanged(fn: (roomId: number, kind: string) => void): void {
  roomChanged = fn
}

// ── Giving up ───────────────────────────────────────────────────────────────

export interface GiveUpResult {
  revealed: { rank: number; name: string; value: number; unit: string | null }[]
  stateVersion: number
}

// Show everyone what they missed and end the round.
//
// This is ONE event carrying every remaining answer, not one reveal event
// each. That is deliberate: giving up is a single moment, and the recording
// should show the board filling in at a stroke rather than ten answers
// arriving in a row as though someone had guessed them very quickly.
//
// The answers are marked `missed` so every client can draw them differently.
// Scoring reads found_at_ms, which stays null here, so giving up cannot be
// mistaken for finding them.
export interface AllowResult {
  rank: number
  name: string
  stateVersion: number
  complete: boolean
}

/**
 * The host's final say: count an answer the list did not have.
 *
 * Some rounds are judgement, not fact. "Excuses for being late to work" has no
 * authority to appeal to — the list is a dozen good ones, not every one that
 * exists — and the first time somebody says "my phone updated overnight" the
 * game either has a way to agree with them or it spends the next minute
 * arguing with a database. On camera, that minute is the whole episode.
 *
 * So this adds the answer in the player's own words and gives it the next free
 * slot. Unordered rounds only: a ranked board's slots mean something, and there
 * is no honest rank to give "the tenth longest river" that isn't one.
 *
 * It is a reveal like any other, so the fold and the recording need to know
 * nothing new — but it carries `allowed`, because a board that was judged and a
 * board that was answered are different things, and the difference should
 * survive to whoever watches it back.
 */
export function allowGuess(
  instanceId: number,
  participant: ParticipantRow,
  raw: string,
): AllowResult {
  const inst = sqlite
    .prepare('SELECT * FROM game_round_instances WHERE id = ?')
    .get(instanceId) as InstanceRow | undefined
  if (!inst) throw new RoomError('Unknown round instance', 404)
  if (inst.room_id !== participant.room_id) throw new RoomError('Wrong room', 403)
  if (participant.role !== 'host') throw new RoomError('Only the host can count an answer', 403)
  if (inst.status !== 'live') throw new RoomError(`That round is ${inst.status}`, 409)
  if (inst.ordered) {
    throw new RoomError('A ranked round has no spare slot to put it in', 409)
  }

  const name = raw.trim()
  if (!name) throw new RoomError('Nothing to count', 400)

  const onBoard = (sqlite
    .prepare('SELECT COUNT(*) AS n FROM game_round_answers WHERE instance_id = ? AND found_at_ms IS NOT NULL')
    .get(instanceId) as { n: number }).n
  if (onBoard >= inst.target) throw new RoomError('The board is already full', 409)

  const normalized = norm(name)
  const already = sqlite
    .prepare('SELECT found_at_ms FROM game_round_answers WHERE instance_id = ? AND name_norm = ?')
    .get(instanceId, normalized) as { found_at_ms: number | null } | undefined
  if (already?.found_at_ms != null) throw new RoomError('That one is already up there', 409)

  // Whoever said it gets the credit, the same as any other answer. They were
  // right; the list was short.
  const guesser = sqlite
    .prepare('SELECT participant_id FROM game_guesses WHERE instance_id = ? AND raw_norm = ? ORDER BY id DESC LIMIT 1')
    .get(instanceId, normalized) as { participant_id: number } | undefined

  const tMs = Date.now() - (inst.started_at_ms ?? Date.now())
  const byParticipantId = guesser?.participant_id ?? participant.id

  const { rank, stateVersion, complete } = sqlite.transaction(() => {
    const { next } = sqlite
      .prepare('SELECT COALESCE(MAX(rank), 0) + 1 AS next FROM game_round_answers WHERE instance_id = ?')
      .get(instanceId) as { next: number }

    sqlite
      .prepare(
        `INSERT INTO game_round_answers
           (instance_id, rank, on_board, footballer_id, name, name_norm, surname_norm,
            nationality, photo_url, value, unit, display, aliases, clue_json,
            found_at_ms, found_by_participant_id)
         VALUES (?, ?, 1, NULL, ?, ?, ?, NULL, NULL, 0, NULL, NULL, NULL, NULL, ?, ?)`,
      )
      .run(instanceId, next, name, normalized, surnameOf(normalized), tMs, byParticipantId)

    appendEvent(instanceId, tMs, 'reveal', byParticipantId, {
      rank: next,
      name,
      value: 0,
      unit: null,
      display: null,
      nationality: null,
      photoUrl: null,
      footballerId: null,
      allowed: true,
    })

    const found = (sqlite
      .prepare('SELECT COUNT(*) AS n FROM game_round_answers WHERE instance_id = ? AND found_at_ms IS NOT NULL')
      .get(instanceId) as { n: number }).n
    const done = found >= inst.target
    if (done) {
      sqlite
        .prepare("UPDATE game_round_instances SET status = 'complete', ended_at_ms = ? WHERE id = ?")
        .run(tMs, instanceId)
      appendEvent(instanceId, tMs, 'round_end', null, { reason: 'complete', found, target: inst.target })
    }
    return { rank: next, stateVersion: bumpVersion(inst.room_id), complete: done }
  })()

  return { rank, name, stateVersion, complete }
}

export function giveUp(instanceId: number, participant: ParticipantRow): GiveUpResult {
  const inst = sqlite
    .prepare('SELECT * FROM game_round_instances WHERE id = ?')
    .get(instanceId) as InstanceRow | undefined
  if (!inst) throw new RoomError('Unknown round instance', 404)
  if (inst.room_id !== participant.room_id) throw new RoomError('Wrong room', 403)
  if (participant.role !== 'host') throw new RoomError('Only the host can give up', 403)
  if (inst.status !== 'live') throw new RoomError(`That round is ${inst.status}`, 409)

  // On an unordered round only enough to fill the board: a squad has
  // twenty-three players and the board has ten slots, so revealing every
  // unfound answer would hand back more rows than there is board.
  const alreadyFound = (sqlite
    .prepare('SELECT COUNT(*) AS n FROM game_round_answers WHERE instance_id = ? AND found_at_ms IS NOT NULL')
    .get(instanceId) as { n: number }).n
  const stillToFill = inst.ordered ? inst.target : Math.max(0, inst.target - alreadyFound)

  const missed = sqlite
    .prepare(
      `SELECT rank, name, value, unit, display, nationality, photo_url, footballer_id FROM game_round_answers
       WHERE instance_id = ? AND on_board = 1 AND found_at_ms IS NULL ORDER BY rank LIMIT ?`,
    )
    .all(instanceId, stillToFill) as {
      rank: number
      name: string
      value: number
      unit: string | null
      display: string | null
      nationality: string | null
      photo_url: string | null
      footballer_id: number | null
    }[]

  const stateVersion = sqlite.transaction(() => {
    const tMs = Date.now() - (inst.started_at_ms ?? Date.now())
    appendEvent(instanceId, tMs, 'give_up', participant.id, {
      answers: missed.map((a) => ({
        rank: a.rank,
        name: a.name,
        value: a.value,
        unit: a.unit,
        display: a.display,
        nationality: a.nationality,
        photoUrl: a.photo_url,
        footballerId: a.footballer_id,
      })),
    })
    sqlite
      .prepare("UPDATE game_round_instances SET status = 'complete', ended_at_ms = ? WHERE id = ?")
      .run(tMs, instanceId)
    appendEvent(instanceId, tMs, 'round_end', null, {
      reason: 'gave_up',
      found: inst.target - missed.length,
      target: inst.target,
    })
    return bumpVersion(inst.room_id)
  })()

  return {
    revealed: missed.map((a) => ({ rank: a.rank, name: a.name, value: a.value, unit: a.unit })),
    stateVersion,
  }
}

// ── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: number
  participantId: number | null
  displayName: string
  body: string
  createdAt: string
}

// The last of the room's chat. Capped because the whole log ships inside every
// /state response, and /state is fetched on every version bump — an uncapped
// history would make a long game's resync grow without bound.
const CHAT_WINDOW = 100

export function messagesOf(roomId: number): ChatMessage[] {
  const rows = sqlite
    .prepare(
      `SELECT id, participant_id, display_name, body, created_at FROM game_messages
       WHERE room_id = ? ORDER BY id DESC LIMIT ?`,
    )
    .all(roomId, CHAT_WINDOW) as {
      id: number
      participant_id: number | null
      display_name: string
      body: string
      created_at: string
    }[]
  return rows.reverse().map((r) => ({
    id: r.id,
    participantId: r.participant_id,
    displayName: r.display_name,
    body: r.body,
    createdAt: r.created_at,
  }))
}

export interface PostMessageResult {
  message: ChatMessage
  stateVersion: number
  replayed: boolean
}

// Anyone in the room may chat — unlike guessing, which is the host's alone.
// The whole point is the player whose microphone or camera has failed, and a
// mute button that also gagged them would defeat it.
export function postMessage(
  room: RoomRow,
  participant: ParticipantRow,
  clientMessageId: string,
  body: string,
): PostMessageResult {
  const typed = body.trim()
  if (!typed) throw new RoomError('An empty message is not a message', 400)

  // Moderated before it is stored, so what is broadcast and what is kept are
  // the same text. The original is kept beside it — a filter whose decisions
  // cannot be inspected cannot be corrected.
  const { body: text, moderated } = moderateMessage(typed)

  const existing = sqlite
    .prepare('SELECT id, participant_id, display_name, body, created_at FROM game_messages WHERE room_id = ? AND client_message_id = ?')
    .get(room.id, clientMessageId) as {
      id: number
      participant_id: number | null
      display_name: string
      body: string
      created_at: string
    } | undefined
  if (existing) {
    return {
      message: {
        id: existing.id,
        participantId: existing.participant_id,
        displayName: existing.display_name,
        body: existing.body,
        createdAt: existing.created_at,
      },
      stateVersion: room.state_version,
      replayed: true,
    }
  }

  const { id, stateVersion } = sqlite.transaction(() => {
    const info = sqlite
      .prepare(
        `INSERT INTO game_messages (room_id, participant_id, display_name, client_message_id, body, moderated, original_body)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        room.id,
        participant.id,
        participant.display_name,
        clientMessageId,
        text,
        moderated ? 1 : 0,
        moderated ? typed : null,
      )
    return { id: Number(info.lastInsertRowid), stateVersion: bumpVersion(room.id) }
  })()

  const row = sqlite
    .prepare('SELECT created_at FROM game_messages WHERE id = ?')
    .get(id) as { created_at: string }

  return {
    message: {
      id,
      participantId: participant.id,
      displayName: participant.display_name,
      body: text,
      createdAt: row.created_at,
    },
    stateVersion,
    replayed: false,
  }
}

// ── State ───────────────────────────────────────────────────────────────────

export interface RoomState {
  code: string
  status: string
  stateVersion: number
  livekitRoom: string
  hostUserId: number
  /// The round picked and waiting to be started, if any. Separate from
  /// `round`, which is what the board is showing.
  pendingInstanceId: number | null
  participants: { id: number; displayName: string; role: string; slot: number; present: boolean }[]
  messages: ChatMessage[]
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
      // What the board shows, in order of claim:
      //
      //   live     — a round being played always wins. Picking the next one
      //              must never yank the board out from under it.
      //   complete — a round that has been PLAYED outranks one merely picked.
      //              This is the whole fix: a pending round used to take the
      //              board the instant a round ended, so Give up replaced the
      //              answers you had just asked to see with another round's
      //              blank pyramid. The answers now stay up until the host
      //              actually starts the next round.
      //   pending   — only when nothing has been played yet, which is the
      //              first round of a game, where a preview is what you want.
      `SELECT * FROM game_round_instances WHERE room_id = ?
       ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'complete' THEN 1 ELSE 2 END, seq DESC LIMIT 1`,
    )
    .get(room.id) as InstanceRow | undefined

  let round: RoomState['round'] = null
  if (inst) {
    const events = sqlite
      .prepare('SELECT seq, t_ms, type, actor_participant_id, payload FROM game_events WHERE instance_id = ? ORDER BY t_ms, seq')
      .all(inst.id) as ReplayEvent[]
    const board = reduceEvents(events, Number.POSITIVE_INFINITY, {
      title: inst.title,
      target: inst.target,
      ordered: !!inst.ordered,
      category: categoryOf(inst.type),
      metric: inst.metric,
      impliedClues: JSON.parse(inst.implied_clues),
    })
    const found = new Set(board.revealed.map((r) => r.rank))
    round = {
      instanceId: inst.id,
      seq: inst.seq,
      status: inst.status,
      startedAtMs: inst.started_at_ms,
      board,
      // Which rows are still blank, so a client never has to infer it (and so
      // the unfound answers are never sent to anyone).
      //
      // On an unordered round a rank is not a slot — the found players fill
      // the board from the top in whatever order they are shown — so the
      // blanks are simply however much of the ten is left.
      blanks: inst.ordered
        ? Array.from({ length: inst.target }, (_, i) => i + 1).filter((r) => !found.has(r))
        : Array.from(
            { length: Math.max(0, inst.target - board.revealed.length) },
            (_, i) => board.revealed.length + i + 1,
          ),
    }
  }

  // The round waiting to be started, which is NOT always the one on the board
  // any more: after a round finishes the board keeps showing its answers while
  // the host lines the next one up. Start needs to know which that is.
  const pending = sqlite
    .prepare("SELECT id FROM game_round_instances WHERE room_id = ? AND status = 'pending' ORDER BY seq DESC LIMIT 1")
    .get(room.id) as { id: number } | undefined

  return {
    code: room.code,
    status: room.status,
    pendingInstanceId: pending?.id ?? null,
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
    messages: messagesOf(room.id),
    round,
  }
}
