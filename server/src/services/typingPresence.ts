// Who is mid-guess, in a game with no video call.
//
// Typing is peer-to-peer over LiveKit's data channel, which is right: it is
// the one piece of state in the game that is worthless a second later, it
// must never reach the event log, and nothing about it should survive into
// the recording. But a room created with the video toggle off never dials
// LiveKit at all — no token, no WebRTC — so the dots simply never appeared,
// silently, because both apps return early when there is no room to publish
// to. Everything else in such a game works because polling takes over; this
// was the one feature with no second route.
//
// So it gets one, and the route is the poll that is already happening. A
// client that is typing says so on its next state request, which in a
// video-less room comes round every 1.5 seconds — the same cadence the
// LiveKit ping used, for no extra traffic at all.
//
// THIS IS THE ONE THING IN THE GAME THAT IS NOT IN SQLITE, and deliberately.
// Everything else lives in the database precisely so a deploy cannot lose
// it; a typing dot is the case where losing it on restart is correct. It
// does not bump state_version, it is not broadcast, and it is not in
// roomState — only the state ROUTE adds it — so there is no path by which it
// can reach a recording.

/** Long enough to cover a thinking pause, short enough to clear itself. */
const TTL_MS = 5_000

const until = new Map<string, number>()

const key = (roomId: number, participantId: number) => `${roomId}:${participantId}`

/** They are typing now. Called from the state poll, not from a write. */
export function noteTyping(roomId: number, participantId: number): void {
  until.set(key(roomId, participantId), Date.now() + TTL_MS)
}

/** They have stopped, or sent. Said explicitly so the dots go at once. */
export function clearTyping(roomId: number, participantId: number): void {
  until.delete(key(roomId, participantId))
}

/**
 * Who is typing in this room, apart from the asker — nobody needs to be told
 * about their own keyboard.
 *
 * Expired entries are dropped as they are found, which is the whole of the
 * cleanup this needs: the map only ever holds one entry per seated player.
 */
export function typingIn(roomId: number, except: number): number[] {
  const now = Date.now()
  const out: number[] = []
  for (const [k, expires] of until) {
    if (expires <= now) {
      until.delete(k)
      continue
    }
    const [room, participant] = k.split(':').map(Number)
    if (room === roomId && participant !== except) out.push(participant)
  }
  return out.sort((a, b) => a - b)
}
