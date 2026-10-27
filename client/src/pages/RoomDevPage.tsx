import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import type { LocalAudioTrack, LocalVideoTrack, RemoteAudioTrack, RemoteVideoTrack, Room } from 'livekit-client'
import {
  createRoom,
  endRoom,
  fetchRoomState,
  freezeRound,
  joinRoom,
  leaveRoom,
  livekitCredentials,
  startRound,
  giveUp,
  sendChat,
  submitGuess,
  takeHint,
  RoomApiError,
  type GuessResult,
  type JoinedRoom,
  type RoomSession,
  type RoomState,
} from '@/api/rooms'
import { getTenablePlayRounds, type TenablePlayRound } from '@/api/tenable'

// A development harness for multiplayer Tenable, not a product surface.
//
// It exists so the game can be played four-up in four browser tabs — with real
// video, real tokens and the real server — before a line of Swift is written.
// Every hour spent finding a state bug here is three hours not spent finding
// it across two native platforms. The layout deliberately mirrors the podcast
// composition (board on top, faces across the bottom third) so that the shape
// of the recorded video gets tested from the very first round rather than in
// Phase 7, when it is expensive to change.
//
// livekit-client is pinned and loaded with a dynamic import. Pinned because
// 2.23 pulls a transitive dependency requiring Node 22.22, and both builds run
// on Node 20 (see netlify.toml); dynamically imported so a ~400KB WebRTC
// client stays out of the bundle every other page pays for.

type AnyVideoTrack = LocalVideoTrack | RemoteVideoTrack
type AnyAudioTrack = LocalAudioTrack | RemoteAudioTrack

interface Tile {
  identity: string
  name: string
  isLocal: boolean
  speaking: boolean
  video: AnyVideoTrack | null
  audio: AnyAudioTrack | null
}

// The clue, minus whatever the question already gave away — asking for a hint
// on "Birmingham City's overseas players" and being told "club: Birmingham
// City" is not a hint.
function clueLines(
  clue: Record<string, string | number | null> | null,
  impliedClues: string[],
): string[] {
  if (!clue) return ['No clue recorded for this one']
  const fields: [string, string][] = [
    ['nationality', 'Nationality'],
    ['position', 'Position'],
    ['years', 'Years'],
    ['club', 'Club'],
    ['squadNumber', 'Shirt'],
    ['born', 'Born'],
  ]
  const lines = fields
    .filter(([key]) => !impliedClues.includes(key) && clue[key] != null && clue[key] !== '')
    .map(([key, label]) => `${label}: ${clue[key]}`)
  return lines.length ? lines : ['Nothing to give away on this one']
}

const VERDICT_STYLE: Record<string, string> = {
  hit: 'text-emerald-400',
  near: 'text-amber-400',
  duplicate: 'text-sky-400',
  miss: 'text-rose-400',
}

function VideoTile({ tile }: { tile: Tile }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el || !tile.video) return
    tile.video.attach(el)
    return () => { tile.video?.detach(el) }
  }, [tile.video])

  useEffect(() => {
    const el = audioRef.current
    // Never attach your own microphone — that is a feedback loop, on camera.
    if (!el || !tile.audio || tile.isLocal) return
    tile.audio.attach(el)
    return () => { tile.audio?.detach(el) }
  }, [tile.audio, tile.isLocal])

  return (
    <div
      className={`relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg bg-slate-900 ring-2 ${
        tile.speaking ? 'ring-emerald-400' : 'ring-transparent'
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={tile.isLocal}
        className="h-full w-full object-cover"
      />
      {!tile.isLocal && <audio ref={audioRef} autoPlay />}
      {!tile.video && (
        <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">camera off</div>
      )}
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {tile.name}{tile.isLocal ? ' (you)' : ''}
      </span>
    </div>
  )
}

// sessionStorage, not localStorage, and that is the whole point: it is scoped
// to one tab. Four tabs are four different people here, and a seat shared
// across them would have them all fighting over one participant.
const SEAT_KEY = 'gtl-room-seat'

function storedSeat(): RoomSession | null {
  try {
    const raw = sessionStorage.getItem(SEAT_KEY)
    return raw ? (JSON.parse(raw) as RoomSession) : null
  } catch {
    return null
  }
}

export function RoomDevPage() {
  const [session, setSession] = useState<RoomSession | null>(storedSeat)
  const [state, setState] = useState<RoomState | null>(null)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [rounds, setRounds] = useState<TenablePlayRound[]>([])
  const [error, setError] = useState<string | null>(null)
  const [videoNote, setVideoNote] = useState<string | null>(null)
  const [lastGuess, setLastGuess] = useState<GuessResult | null>(null)

  // Prefilled from a shared link, so the other three only have to type a name.
  const [joinCode, setJoinCode] = useState(
    () => new URLSearchParams(window.location.search).get('code')?.toUpperCase() ?? '',
  )
  // Whether we got here from a share link rather than by typing a code.
  const [invited] = useState(() => new URLSearchParams(window.location.search).has('code'))
  const [shared, setShared] = useState(false)
  // Mirrors the LiveKit track state rather than being the source of truth, so
  // a track that fails to enable does not leave the button lying.
  const [micOn, setMicOn] = useState(false)
  const [camOn, setCamOn] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [roundId, setRoundId] = useState<number | ''>('')
  const [roundQuery, setRoundQuery] = useState('')
  const [guess, setGuess] = useState('')
  const [tab, setTab] = useState<'video' | 'chat'>('video')
  const [chatDraft, setChatDraft] = useState('')
  // The newest message id already seen, so the Chat tab can say how many
  // arrived while you were watching faces.
  const [seenMessageId, setSeenMessageId] = useState(0)

  const roomRef = useRef<Room | null>(null)
  // The version we have already rendered. A broadcast carrying anything higher
  // means we are behind; anything lower is an out-of-order message to ignore.
  const versionRef = useRef(0)
  const sessionRef = useRef<RoomSession | null>(null)
  sessionRef.current = session

  const enterRoom = useCallback((joined: JoinedRoom) => {
    const seat: RoomSession = {
      code: joined.code,
      participantId: joined.participantId,
      participantToken: joined.participantToken,
    }
    try { sessionStorage.setItem(SEAT_KEY, JSON.stringify(seat)) } catch { /* private mode */ }
    versionRef.current = joined.stateVersion
    setState(joined)
    setSession(seat)
  }, [])

  const exitRoom = useCallback(() => {
    try { sessionStorage.removeItem(SEAT_KEY) } catch { /* private mode */ }
    versionRef.current = 0
    setSession(null)
    setState(null)
  }, [])

  const refresh = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    try {
      const next = await fetchRoomState(current)
      if (next.stateVersion < versionRef.current) return
      versionRef.current = next.stateVersion
      setState(next)
      // The host ended it. Everyone finds out here, on the next poll or the
      // next broadcast, rather than staying in a room that no longer exists.
      if (next.status === 'ended') {
        exitRoom()
        setError('The host ended the game.')
      }
    } catch (err) {
      // A seat that no longer exists — the room ended, or the token expired —
      // is permanent, so drop back to the lobby. Anything else is probably the
      // network, and the next poll can have another go.
      if (err instanceof RoomApiError && (err.status === 403 || err.status === 404)) {
        exitRoom()
        setError('That room is no longer available.')
        return
      }
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [exitRoom])

  useEffect(() => { getTenablePlayRounds().then(setRounds).catch(() => {}) }, [])

  // Connect to the call, and listen for the server's state broadcasts on the
  // same connection. The broadcast never carries the change itself — only the
  // version — so the board on screen always came from GET /state, the same
  // fold the recorded video will be rendered from.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    let room: Room | null = null

    ;(async () => {
      let credentials
      try {
        credentials = await livekitCredentials(session)
      } catch (err) {
        setVideoNote(`No video: ${err instanceof Error ? err.message : String(err)}`)
        return
      }

      const { Room: LKRoom, RoomEvent, Track } = await import('livekit-client')
      if (cancelled) return
      room = new LKRoom({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      const snapshot = () => {
        if (!room) return
        setMicOn(room.localParticipant.isMicrophoneEnabled)
        setCamOn(room.localParticipant.isCameraEnabled)
        const everyone = [room.localParticipant, ...room.remoteParticipants.values()]
        setTiles(everyone.map((p) => ({
          identity: p.identity,
          name: p.name || p.identity,
          isLocal: p.isLocal,
          speaking: p.isSpeaking,
          video: p.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null,
          audio: p.getTrackPublication(Track.Source.Microphone)?.audioTrack ?? null,
        })))
      }

      room
        .on(RoomEvent.DataReceived, (payload: Uint8Array, _p, _kind, topic?: string) => {
          if (topic !== 'gtl-state') return
          try {
            const message = JSON.parse(new TextDecoder().decode(payload)) as { stateVersion?: number }
            if ((message.stateVersion ?? 0) > versionRef.current) void refresh()
          } catch {
            // A malformed broadcast is not worth a crash; the poll will catch up.
          }
        })
        .on(RoomEvent.ParticipantConnected, snapshot)
        .on(RoomEvent.ParticipantDisconnected, snapshot)
        .on(RoomEvent.TrackSubscribed, snapshot)
        .on(RoomEvent.TrackUnsubscribed, snapshot)
        .on(RoomEvent.LocalTrackPublished, snapshot)
        .on(RoomEvent.LocalTrackUnpublished, snapshot)
        .on(RoomEvent.ActiveSpeakersChanged, snapshot)
        .on(RoomEvent.TrackMuted, snapshot)
        .on(RoomEvent.TrackUnmuted, snapshot)

      try {
        await room.connect(credentials.url, credentials.token)
        // You arrive muted with your camera off, and turn them on when you are
        // ready. Joining a call already broadcasting is how people end up on
        // camera before they meant to be.
        snapshot()
        setVideoNote(null)
      } catch (err) {
        setVideoNote(`Video failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    })()

    return () => {
      cancelled = true
      void room?.disconnect()
      roomRef.current = null
      setTiles([])
    }
  }, [session, refresh])

  // The backstop. If a broadcast is lost — or LiveKit is not configured at all
  // — the game still advances, just a few seconds late.
  useEffect(() => {
    if (!session) return
    void refresh()
    const timer = setInterval(() => { void refresh() }, 10_000)
    return () => clearInterval(timer)
  }, [session, refresh])

  // Toggling asks LiveKit first and only then updates the button, so a device
  // that refuses to start leaves the control showing the truth.
  const setMedia = async (kind: 'mic' | 'cam', on: boolean) => {
    const room = roomRef.current
    if (!room) return
    try {
      if (kind === 'mic') {
        await room.localParticipant.setMicrophoneEnabled(on)
        setMicOn(room.localParticipant.isMicrophoneEnabled)
      } else {
        await room.localParticipant.setCameraEnabled(on)
        setCamOn(room.localParticipant.isCameraEnabled)
      }
    } catch (err) {
      setVideoNote(err instanceof Error ? err.message : String(err))
    }
  }

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // Chat rides the same /state refresh as everything else: posting bumps the
  // room version, refresh() brings the message back. Nothing is appended
  // locally, so there is one path from the server's state to the screen.
  const messages = state?.messages ?? []
  const unreadCount = messages.filter((m) => m.id > seenMessageId).length

  const postChat = async () => {
    const body = chatDraft.trim()
    if (!session || !body) return
    setChatDraft('')
    await run(() => sendChat(session, body))
  }

  // Reading the tab is what marks it read, whether you switched to it or a
  // message landed while you were already there.
  const lastMessageId = messages.length ? messages[messages.length - 1].id : 0
  useEffect(() => {
    if (tab === 'chat') setSeenMessageId((seen) => Math.max(seen, lastMessageId))
  }, [tab, lastMessageId])

  // Follow the conversation, the way every chat does.
  const chatScroll = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (tab !== 'chat') return
    const el = chatScroll.current
    if (el) el.scrollTop = el.scrollHeight
  }, [tab, lastMessageId])

  // There are a couple of thousand rounds, so the picker needs a filter to be
  // usable at all. Capped because a select with everything in it is slow to
  // open on a phone, and the count tells you when to type more.
  const ROUND_OPTIONS = 200
  const roundMatches = roundQuery.trim()
    ? rounds.filter((r) => `${r.date} ${r.title}`.toLowerCase().includes(roundQuery.trim().toLowerCase()))
    : rounds
  const shownRounds = roundMatches.slice(0, ROUND_OPTIONS)

  // Freeze and Start are separate on purpose — freezing runs the derivation
  // SQL, so starting can be the cheap, precise instant every recorded
  // timestamp is measured from. Nothing about that is guessable from two
  // buttons, so say which one is next.
  const hostHint = (status: string | undefined): string => {
    if (status === 'pending') return 'Answers locked. Start when everyone is ready — that starts the clock.'
    if (status === 'live') return 'Live. Type what they shout.'
    if (status === 'complete') return 'Round finished. Pick another and freeze it.'
    return 'Pick a round, then Freeze to lock its answers to this room.'
  }

  const me = state?.participants.find((p) => p.id === session?.participantId) ?? null
  const isHost = me?.role === 'host'
  const round = state?.round ?? null

  if (!session) {
    return (
      // The in-room view sets its own dark background; this one needs it too,
      // or it inherits the site's white and the whole form goes pale-on-pale.
      <div className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-white">Tenable rooms — dev harness</h1>
          <p className="mt-1 text-sm text-slate-300">
            Open this page in four tabs: create a room in one, join it by code in the others.
          </p>
        </header>

        <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-medium text-white">Host a room</h2>
          <p className="text-sm text-slate-300">Needs a signed-in account.</p>
          <button
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            onClick={() => run(async () => {
              enterRoom(await createRoom())
            })}
          >
            Create room
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-medium text-white">Join a room</h2>
          <div className="flex gap-2">
            <input
              className="w-32 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm uppercase tracking-widest text-white placeholder:text-slate-500"
              placeholder="CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            {/* Arriving from an invite link, the code is already filled in and
                a name is the only thing left to do. Point at it. */}
            <input
              className={`flex-1 rounded border bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 ${
                invited && !displayName.trim()
                  ? 'border-rose-500 ring-1 ring-rose-500'
                  : 'border-slate-600'
              }`}
              placeholder="Your name"
              autoFocus={invited}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          {invited && !displayName.trim() && (
            <p className="text-xs text-rose-400">You've been invited to {joinCode} — add a name to join.</p>
          )}
          <button
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            disabled={!joinCode.trim() || !displayName.trim()}
            onClick={() => run(async () => {
              enterRoom(await joinRoom(joinCode.trim(), displayName.trim()))
            })}
          >
            Join
          </button>
        </section>

        {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-950 text-slate-200">
      {/* Side by side on a desktop, where it is actually worked on, and
          stacked on a narrow window — which is also the podcast composition,
          board over faces, so that shape stays checkable by resizing. */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Board. */}
      <div className="flex min-h-0 min-w-0 flex-[2] flex-col gap-3 overflow-y-auto p-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <span className="font-mono text-lg tracking-widest text-emerald-400">{state?.code}</span>
          <button
            className="rounded border border-slate-600 px-2 py-0.5 text-xs hover:border-slate-400"
            onClick={async () => {
              const link = `${window.location.origin}/dev/room?code=${state?.code ?? ''}`
              // The share sheet on a phone, the clipboard everywhere else.
              // Both can be refused, so fall through rather than assume.
              try {
                if (navigator.share) await navigator.share({ title: 'Join my Tenable game', url: link })
                else await navigator.clipboard.writeText(link)
                setShared(true)
                setTimeout(() => setShared(false), 2000)
              } catch {
                // Cancelled the share sheet, or no clipboard permission.
              }
            }}
          >
            {shared ? 'Copied' : 'Share link'}
          </button>
          <span className="text-slate-400">
            {me?.displayName} · {isHost ? 'host' : 'player'} · v{state?.stateVersion ?? 0}
          </span>
          {videoNote && <span className="text-amber-400">{videoNote}</span>}
          {error && <span className="text-rose-400">{error}</span>}
        </div>

        {!round && <p className="text-slate-400">No round yet{isHost ? ' — pick one below.' : '.'}</p>}

        {round && (
          <>
            <h2 className="text-xl font-semibold">{round.board.title || 'Round ready'}</h2>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {round.status} · {round.board.revealed.length}/{round.board.target}
            </p>
            <ol className="space-y-1">
              {Array.from({ length: round.board.target }, (_, i) => i + 1).map((rank) => {
                const found = round.board.revealed.find((r) => r.rank === rank)
                const hint = round.board.hints.find((h) => h.rank === rank)
                return (
                  <li
                    key={rank}
                    // A missed answer is shown, but colourless: the board
                    // should read at a glance as what you got and what you
                    // didn't, and a second bright colour would make a missed
                    // answer look like a prize.
                    className={`rounded px-3 py-1.5 transition-colors ${
                      !found ? 'bg-slate-900' : found.missed ? 'bg-slate-700/50' : 'bg-emerald-900/40'
                    }`}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="w-6 text-right text-sm text-slate-500">{rank}</span>
                      <span className={`flex-1 ${found?.missed ? 'text-slate-400' : ''}`}>
                        {found ? found.name : '— — —'}
                      </span>
                      <span className="text-sm text-slate-400">
                        {found ? `${found.value}${found.unit ? ` ${found.unit}` : ''}` : ''}
                      </span>
                      {/* Anyone, while there is something to clue.
                          The clue goes into the event log, so every tab sees it
                          and the recording will show it appearing. */}
                      {!found && !hint && round.status === 'live' && (
                        <button
                          className="text-slate-500 hover:text-slate-200"
                          title="Take a clue on this one"
                          onClick={() => run(() => takeHint(session, round.instanceId, rank))}
                        >
                          <Eye size={15} />
                        </button>
                      )}
                    </div>
                    {hint && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-9 text-xs text-amber-300/90">
                        {clueLines(hint.clue, round.board.impliedClues).map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>

            <div className="text-xs text-slate-500">
              {round.board.guesses.slice(-8).reverse().map((g, i) => (
                <div key={`${g.tMs}-${i}`}>
                  <span className={VERDICT_STYLE[g.verdict] ?? ''}>{g.verdict}</span> — {g.raw}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Host controls. The server enforces all of this; hiding it here is
            only so the other tabs are not confusing to use. */}
        {isHost && round?.status === 'live' && (
          <div className="mt-auto space-y-2 border-t border-slate-800 pt-3">
            <button
              className="rounded bg-slate-800 px-3 py-1.5 text-sm text-rose-300 hover:bg-slate-700"
              onClick={() => {
                // Irreversible and it ends the round for everybody, which is
                // the one case that earns a confirmation.
                if (!session || !round) return
                if (!window.confirm('Give up and show the answers?')) return
                void run(() => giveUp(session, round.instanceId))
              }}
            >
              Give up
            </button>
          </div>
        )}

        {isHost && round?.status !== 'live' && (
          <div className="mt-auto space-y-2 border-t border-slate-800 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="w-44 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
                placeholder="Filter rounds…"
                value={roundQuery}
                onChange={(e) => setRoundQuery(e.target.value)}
              />
              <select
                className="max-w-xs rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
                value={roundId}
                onChange={(e) => setRoundId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">
                  {roundMatches.length === 0 ? 'Nothing matches' : `Choose a round… (${roundMatches.length})`}
                </option>
                {shownRounds.map((r) => (
                  <option key={r.roundId} value={r.roundId}>{r.date} — {r.title}</option>
                ))}
              </select>
              {roundMatches.length > ROUND_OPTIONS && (
                <span className="text-xs text-slate-500">
                  showing {ROUND_OPTIONS} of {roundMatches.length} — keep typing
                </span>
              )}
              <button
                className={`rounded px-3 py-1.5 text-sm disabled:opacity-40 ${
                  round?.status === 'pending'
                    ? 'bg-slate-700 hover:bg-slate-600'
                    : 'bg-sky-600 hover:bg-sky-500'
                }`}
                disabled={roundId === ''}
                title="Locks this round's answers to this room, so they cannot change mid-game"
                onClick={() => run(() => freezeRound(session, Number(roundId)))}
              >
                Freeze
              </button>
              <button
                className="rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500 disabled:opacity-40"
                disabled={round?.status !== 'pending'}
                title={round?.status === 'pending' ? 'Starts the clock' : 'Freeze a round first'}
                onClick={() => run(() => startRound(session, round!.instanceId))}
              >
                Start
              </button>
              <button
                className="ml-auto rounded bg-rose-900 px-3 py-1.5 text-sm hover:bg-rose-800"
                onClick={() => run(async () => { await endRoom(session); exitRoom() })}
              >
                End game
              </button>
            </div>

            <p className="text-xs text-slate-400">{hostHint(round?.status)}</p>
          </div>
        )}

        {/* Everyone guesses. You can still shout, and mostly will, but a
            player whose microphone has failed can now play rather than
            watch. Choosing, starting and ending a round stay the host's. */}
        {session && (
          <div className={`space-y-2 border-t border-slate-800 pt-3 ${isHost ? '' : 'mt-auto'}`}>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const raw = guess.trim()
                if (!raw || !round) return
                setGuess('')
                void run(async () => { setLastGuess(await submitGuess(session, round.instanceId, raw)) })
              }}
            >
              <input
                className="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-2"
                placeholder={round?.status === 'live' ? 'Your guess…' : 'Waiting for a round to start'}
                disabled={round?.status !== 'live'}
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
              />
              {lastGuess && (
                <span className={`self-center text-sm ${VERDICT_STYLE[lastGuess.verdict] ?? ''}`}>
                  {lastGuess.verdict}
                  {lastGuess.rank ? ` · ${lastGuess.rank}${lastGuess.name ? ` ${lastGuess.name}` : ''}` : ''}
                </span>
              )}
            </form>
          </div>
        )}
      </div>

      {/* Faces and chat — a third of the space either way: a column down the
          right on a desktop, a band across the bottom when stacked. They share
          it rather than splitting it, because chat is for the player whose
          camera or microphone has failed, which is exactly when their tile is
          worth nothing.
          min-h-0/min-w-0 are load-bearing: a flex item defaults to
          min-height:auto, so without them the <video> elements' intrinsic size
          wins over the one-third share and this grows over the board and the
          controls, which is exactly what it did the first time. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-slate-800 bg-black lg:border-l lg:border-t-0">
        <div className="flex shrink-0 gap-1 border-b border-slate-800 p-1 text-xs">
          {(['video', 'chat'] as const).map((name) => (
            <button
              key={name}
              className={`flex-1 rounded px-2 py-1 capitalize ${
                tab === name ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setTab(name)}
            >
              {name === 'chat' && unreadCount > 0 ? `chat (${unreadCount})` : name}
            </button>
          ))}
        </div>

        {tab === 'video' ? (
          <div className="flex min-h-0 min-w-0 flex-1 gap-2 p-2 lg:flex-col">
            {tiles.length === 0 && (
              <div className="grid flex-1 place-items-center text-sm text-slate-600">
                {videoNote ?? 'connecting…'}
              </div>
            )}
            {tiles.map((tile) => <VideoTile key={tile.identity} tile={tile} />)}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={chatScroll} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {messages.length === 0 && (
                <p className="text-xs text-slate-600">
                  No messages yet. Type here if your mic or camera isn't working.
                </p>
              )}
              {messages.map((message) => {
                const mine = message.participantId === session?.participantId
                return (
                  <div key={message.id} className={mine ? 'text-right' : 'text-left'}>
                    <div className="text-[10px] font-semibold text-slate-500">{message.displayName}</div>
                    <div
                      className={`inline-block max-w-[85%] rounded-xl px-2.5 py-1.5 text-sm text-slate-100 ${
                        mine ? 'bg-violet-900/60' : 'bg-slate-800'
                      }`}
                    >
                      {message.body}
                    </div>
                  </div>
                )
              })}
            </div>
            <form
              className="flex shrink-0 gap-2 border-t border-slate-800 p-2"
              onSubmit={(e) => { e.preventDefault(); void postChat() }}
            >
              <input
                className="min-w-0 flex-1 rounded bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-violet-500"
                placeholder="Message"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
              />
              <button
                className="rounded bg-violet-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
                disabled={!chatDraft.trim()}
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-slate-800 px-3 py-1.5 text-xs text-slate-500">
        <span>{state?.participants.filter((p) => p.present).length ?? 0} in the room</span>

        <button
          className={`flex items-center gap-1.5 rounded px-2 py-1 ${
            micOn ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-rose-900 text-rose-100 hover:bg-rose-800'
          }`}
          onClick={() => setMedia('mic', !micOn)}
        >
          {micOn ? <Mic size={14} /> : <MicOff size={14} />}
          {micOn ? 'Mute' : 'Muted'}
        </button>
        <button
          className={`flex items-center gap-1.5 rounded px-2 py-1 ${
            camOn ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-rose-900 text-rose-100 hover:bg-rose-800'
          }`}
          onClick={() => setMedia('cam', !camOn)}
        >
          {camOn ? <Video size={14} /> : <VideoOff size={14} />}
          {camOn ? 'Stop video' : 'Video off'}
        </button>

        <button
          className="ml-auto hover:text-slate-300"
          onClick={async () => {
            await leaveRoom(session).catch(() => {})
            exitRoom()
          }}
        >
          Leave
        </button>
      </div>
    </div>
  )
}
