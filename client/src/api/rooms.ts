// Multiplayer Tenable rooms.
//
// Every call here is made with `credentials: 'omit'` and an explicit bearer
// token, with one exception: creating a room, which is the only thing that
// needs a real account. That is not fussiness — it is what makes it possible
// to open four tabs in one browser and be four different people. Tabs share a
// cookie jar, so a join that sent the session cookie would hand every tab the
// host's seat.

export interface RoomParticipant {
  id: number
  displayName: string
  role: string
  slot: number
  present: boolean
}

export interface RevealedAnswer {
  /** Revealed by giving up rather than guessed. */
  missed?: boolean
  rank: number
  name: string
  value: number
  unit: string | null
  /** What the badge should read when the number cannot speak for itself. */
  display: string | null
  nationality: string | null
  photoUrl: string | null
  tMs: number
  byParticipantId: number | null
}

export interface ReplayGuess {
  raw: string
  verdict: string
  matchedRank: number | null
  tMs: number
  byParticipantId: number | null
}

export interface TakenHint {
  rank: number
  clue: Record<string, string | number | null> | null
  tMs: number
}

export interface BoardState {
  title: string
  target: number
  ordered: boolean
  /** Which game this round is; absent on a board from before categories. */
  category?: string
  metric: string
  impliedClues: string[]
  revealed: RevealedAnswer[]
  hints: TakenHint[]
  guesses: ReplayGuess[]
  ended: { reason: string; tMs: number } | null
}

export interface RoomRound {
  instanceId: number
  seq: number
  status: string
  startedAtMs: number | null
  board: BoardState
  blanks: number[]
}

// A typed message, for the player whose microphone or camera is not working.
// The display name is the one the server snapshotted when it was sent, not the
// sender's current one.
export interface ChatMessage {
  id: number
  participantId: number | null
  displayName: string
  body: string
  createdAt: string
}

export interface RoomState {
  code: string
  status: string
  stateVersion: number
  livekitRoom: string
  hostUserId: number
  /** The round picked and waiting to be started, which is not always the one
   *  the board is showing. */
  pendingInstanceId: number | null
  participants: RoomParticipant[]
  messages: ChatMessage[]
  round: RoomRound | null
}

export interface JoinedRoom extends RoomState {
  participantId: number
  participantToken: string
}

export interface GuessResult {
  verdict: 'hit' | 'near' | 'duplicate' | 'miss'
  rank: number | null
  value: number | null
  unit: string | null
  name: string | null
  replayed: boolean
  stateVersion: number
  complete: boolean
}

export interface LivekitCredentials {
  url: string
  roomName: string
  identity: string
  slot: number
  token: string
}

// A seat in a room: the code plus the token that proves which seat it is.
export interface RoomSession {
  code: string
  participantId: number
  participantToken: string
}

// Carries the status, so a caller can tell "this seat is gone" (403/404) from
// "the network is having a moment" and only give up on the first.
export class RoomApiError extends Error {
  // Written out rather than a constructor parameter property: the client
  // builds with erasableSyntaxOnly, which rules those out.
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new RoomApiError((body as { error?: string }).error ?? `Request failed (${res.status})`, res.status)
  }
  return body as T
}

function asSeat(session: RoomSession, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    credentials: 'omit',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${session.participantToken}`,
      ...init.headers,
    },
  }
}

// The one call that needs an account.
export async function createRoom(name?: string): Promise<JoinedRoom> {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return unwrap<JoinedRoom>(res)
}

export async function joinRoom(code: string, displayName: string): Promise<JoinedRoom> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, platform: 'web' }),
  })
  return unwrap<JoinedRoom>(res)
}

export async function fetchRoomState(session: RoomSession): Promise<RoomState> {
  const res = await fetch(`/api/rooms/${session.code}/state`, asSeat(session))
  return unwrap<RoomState>(res)
}

export async function freezeRound(session: RoomSession, roundId: number): Promise<{ instanceId: number }> {
  const res = await fetch(
    `/api/rooms/${session.code}/rounds`,
    asSeat(session, { method: 'POST', body: JSON.stringify({ roundId }) }),
  )
  return unwrap<{ instanceId: number }>(res)
}

export async function startRound(session: RoomSession, instanceId: number): Promise<RoomState> {
  const res = await fetch(
    `/api/rooms/${session.code}/rounds/${instanceId}/start`,
    asSeat(session, { method: 'POST' }),
  )
  return unwrap<RoomState>(res)
}

export async function submitGuess(
  session: RoomSession,
  instanceId: number,
  raw: string,
): Promise<GuessResult> {
  const res = await fetch(
    `/api/rooms/${session.code}/guess`,
    asSeat(session, {
      method: 'POST',
      // Generated here and kept with the attempt, so a retry over a flaky
      // connection is scored once.
      body: JSON.stringify({ instanceId, clientGuessId: crypto.randomUUID(), raw }),
    }),
  )
  return unwrap<GuessResult>(res)
}

export async function takeHint(
  session: RoomSession,
  instanceId: number,
  rank: number,
): Promise<TakenHint & { replayed: boolean }> {
  const res = await fetch(
    `/api/rooms/${session.code}/hint`,
    asSeat(session, { method: 'POST', body: JSON.stringify({ instanceId, rank }) }),
  )
  return unwrap<TakenHint & { replayed: boolean }>(res)
}

export async function sendChat(
  session: RoomSession,
  body: string,
): Promise<{ message: ChatMessage; stateVersion: number; replayed: boolean }> {
  const res = await fetch(
    `/api/rooms/${session.code}/chat`,
    asSeat(session, {
      method: 'POST',
      // The idempotency key is made here and travels with the attempt, so a
      // retry on a bad connection posts once.
      body: JSON.stringify({ clientMessageId: crypto.randomUUID(), body }),
    }),
  )
  return unwrap(res)
}

export async function giveUp(
  session: RoomSession,
  instanceId: number,
): Promise<{ revealed: RevealedAnswer[]; stateVersion: number }> {
  const res = await fetch(
    `/api/rooms/${session.code}/rounds/${instanceId}/give-up`,
    asSeat(session, { method: 'POST' }),
  )
  return unwrap(res)
}

export async function leaveRoom(session: RoomSession): Promise<void> {
  await fetch(`/api/rooms/${session.code}/leave`, asSeat(session, { method: 'POST' }))
}

export async function endRoom(session: RoomSession): Promise<void> {
  await fetch(`/api/rooms/${session.code}/end`, asSeat(session, { method: 'POST' }))
}

export async function livekitCredentials(session: RoomSession): Promise<LivekitCredentials> {
  const res = await fetch(`/api/rooms/${session.code}/livekit-token`, asSeat(session))
  return unwrap<LivekitCredentials>(res)
}
