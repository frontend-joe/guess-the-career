// The board at a point in time, folded from the event log.
//
// THE RULE: the board at time T is a pure fold over all events with
// t_ms <= T, ordered by (t_ms, seq). No clock reads, no queries, no
// randomness, no I/O. Given the same events this must return the same board
// forever.
//
// That matters because two very different things call it. The live game
// renders the current board from it, and the podcast renderer replays the same
// log afterwards to draw the board track of the video. If those could diverge,
// the recording would show something the players never saw — and nobody would
// notice for days, by which point the rounds cannot be re-recorded.
//
// Keep this file free of imports that touch the database or the clock.

export interface ReplayEvent {
  seq: number
  t_ms: number
  type: string
  actor_participant_id: number | null
  payload: string
}

export interface RevealedAnswer {
  rank: number
  name: string
  value: number
  unit: string | null
  nationality: string | null
  photoUrl: string | null
  /// Which footballer this row is, so a client can open their career card.
  /// Null on rows from before this was logged, and on the answers that have
  /// no footballer record at all — a transfer row can name somebody the
  /// footballers table has never heard of.
  footballerId: number | null
  tMs: number
  byParticipantId: number | null
  /// Revealed by giving up rather than guessed. Every client draws these
  /// differently, and scoring ignores them.
  missed: boolean
}

export interface ReplayGuess {
  raw: string
  verdict: string
  matchedRank: number | null
  tMs: number
  byParticipantId: number | null
}

// A clue taken on a slot that is still blank. It lives in the log like
// everything else, because the video has to show the clue appearing at the
// moment it was asked for — not as something the board always had.
export interface TakenHint {
  rank: number
  clue: Record<string, string | number | null> | null
  tMs: number
}

export interface BoardState {
  title: string
  target: number
  ordered: boolean
  metric: string
  impliedClues: string[]
  revealed: RevealedAnswer[]
  hints: TakenHint[]
  guesses: ReplayGuess[]
  ended: { reason: string; tMs: number } | null
}

function parse(payload: string): Record<string, unknown> {
  try {
    const v = JSON.parse(payload)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback)
const nullableStr = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const nullableNum = (v: unknown): number | null => (typeof v === 'number' ? v : null)

// `seed` carries the frozen round metadata from game_round_instances. Without
// it a round that has been frozen but not started folds to an empty title,
// because the only event carrying the title is round_start. Seeding cannot
// make the live and replayed boards disagree: round_start copies those same
// columns, so for a started round the fold overwrites the seed with equal
// values.
export function reduceEvents(
  events: ReplayEvent[],
  untilMs = Number.POSITIVE_INFINITY,
  seed: Partial<BoardState> = {},
): BoardState {
  const state: BoardState = {
    title: '',
    target: 10,
    ordered: true,
    metric: '',
    impliedClues: [],
    revealed: [],
    hints: [],
    guesses: [],
    ended: null,
    ...seed,
  }

  const ordered = [...events]
    .filter((e) => e.t_ms <= untilMs)
    .sort((a, b) => a.t_ms - b.t_ms || a.seq - b.seq)

  for (const e of ordered) {
    const p = parse(e.payload)
    switch (e.type) {
      case 'round_start':
        state.title = str(p.title)
        state.target = num(p.target, 10)
        state.ordered = p.ordered !== false
        state.metric = str(p.metric)
        state.impliedClues = Array.isArray(p.impliedClues) ? p.impliedClues.filter((x): x is string => typeof x === 'string') : []
        break
      case 'reveal':
        state.revealed.push({
          rank: num(p.rank),
          name: str(p.name),
          value: num(p.value),
          unit: nullableStr(p.unit),
          nationality: nullableStr(p.nationality),
          photoUrl: nullableStr(p.photoUrl),
          footballerId: nullableNum(p.footballerId),
          tMs: e.t_ms,
          byParticipantId: e.actor_participant_id,
          missed: false,
        })
        break
      // The board changed shape mid-round because a player the database had
      // never heard of turned out to belong on it. The event carries the
      // whole revealed set at its NEW ranks rather than a diff, so the fold
      // stays a fold: replaying it reproduces the board exactly, and the
      // recording cannot drift from what the players saw.
      case 'board_reshuffle': {
        const revealed = Array.isArray(p.revealed) ? p.revealed : []
        state.revealed = []
        for (const raw of revealed) {
          if (!raw || typeof raw !== 'object') continue
          const a = raw as Record<string, unknown>
          state.revealed.push({
            rank: num(a.rank),
            name: str(a.name),
            value: num(a.value),
            unit: nullableStr(a.unit),
            nationality: nullableStr(a.nationality),
            photoUrl: nullableStr(a.photoUrl),
            footballerId: nullableNum(a.footballerId),
            tMs: e.t_ms,
            byParticipantId: nullableNum(a.byParticipantId),
            missed: false,
          })
        }
        break
      }
      // Giving up arrives as ONE event carrying every remaining answer, so
      // the board fills in at a stroke — which is what giving up looks like —
      // rather than as a run of reveals indistinguishable from fast guessing.
      case 'give_up': {
        const answers = Array.isArray(p.answers) ? p.answers : []
        for (const raw of answers) {
          if (!raw || typeof raw !== 'object') continue
          const a = raw as Record<string, unknown>
          state.revealed.push({
            rank: num(a.rank),
            name: str(a.name),
            value: num(a.value),
            unit: nullableStr(a.unit),
            nationality: nullableStr(a.nationality),
            photoUrl: nullableStr(a.photoUrl),
            footballerId: nullableNum(a.footballerId),
            tMs: e.t_ms,
            byParticipantId: null,
            missed: true,
          })
        }
        break
      }
      case 'hint':
        state.hints.push({
          rank: num(p.rank),
          clue: p.clue && typeof p.clue === 'object'
            ? (p.clue as Record<string, string | number | null>)
            : null,
          tMs: e.t_ms,
        })
        break
      case 'guess':
        state.guesses.push({
          raw: str(p.raw),
          verdict: str(p.verdict),
          matchedRank: nullableNum(p.matchedRank),
          tMs: e.t_ms,
          byParticipantId: e.actor_participant_id,
        })
        break
      case 'round_end':
        state.ended = { reason: str(p.reason, 'complete'), tMs: e.t_ms }
        break
      default:
        // participant_join/leave, recording_*, sync_marker and anything added
        // later are not board-visible. Ignoring them is correct, not a gap.
        break
    }
  }

  state.revealed.sort((a, b) => a.rank - b.rank)
  state.hints.sort((a, b) => a.rank - b.rank)
  return state
}
