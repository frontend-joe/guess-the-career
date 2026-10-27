import { useCallback, useEffect, useRef, useState } from 'react'
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
  submitGuess,
  type GuessResult,
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

export function RoomDevPage() {
  const [session, setSession] = useState<RoomSession | null>(null)
  const [state, setState] = useState<RoomState | null>(null)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [rounds, setRounds] = useState<TenablePlayRound[]>([])
  const [error, setError] = useState<string | null>(null)
  const [videoNote, setVideoNote] = useState<string | null>(null)
  const [lastGuess, setLastGuess] = useState<GuessResult | null>(null)

  const [joinCode, setJoinCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [roundId, setRoundId] = useState<number | ''>('')
  const [roundQuery, setRoundQuery] = useState('')
  const [guess, setGuess] = useState('')

  const roomRef = useRef<Room | null>(null)
  // The version we have already rendered. A broadcast carrying anything higher
  // means we are behind; anything lower is an out-of-order message to ignore.
  const versionRef = useRef(0)
  const sessionRef = useRef<RoomSession | null>(null)
  sessionRef.current = session

  const refresh = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    try {
      const next = await fetchRoomState(current)
      if (next.stateVersion < versionRef.current) return
      versionRef.current = next.stateVersion
      setState(next)
    } catch (err) {
      setError(String(err))
    }
  }, [])

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

      try {
        await room.connect(credentials.url, credentials.token)
        await room.localParticipant.enableCameraAndMicrophone()
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

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

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
              const joined = await createRoom()
              versionRef.current = joined.stateVersion
              setState(joined)
              setSession(joined)
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
            <input
              className="flex-1 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <button
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            disabled={!joinCode.trim() || !displayName.trim()}
            onClick={() => run(async () => {
              const joined = await joinRoom(joinCode.trim(), displayName.trim())
              versionRef.current = joined.stateVersion
              setState(joined)
              setSession(joined)
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
                return (
                  <li
                    key={rank}
                    className={`flex items-baseline gap-3 rounded px-3 py-1.5 ${
                      found ? 'bg-emerald-900/40' : 'bg-slate-900'
                    }`}
                  >
                    <span className="w-6 text-right text-sm text-slate-500">{rank}</span>
                    <span className="flex-1">{found ? found.name : '— — —'}</span>
                    <span className="text-sm text-slate-400">
                      {found ? `${found.value}${found.unit ? ` ${found.unit}` : ''}` : ''}
                    </span>
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
        {isHost && (
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
                onClick={() => run(() => endRoom(session))}
              >
                End game
              </button>
            </div>

            <p className="text-xs text-slate-400">{hostHint(round?.status)}</p>

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
                placeholder={round?.status === 'live' ? 'Type what they shouted…' : 'Start a round first'}
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

      {/* Faces — a third of the space either way: a column down the right on a
          desktop, a band across the bottom when stacked.
          min-h-0/min-w-0 are load-bearing: a flex item defaults to
          min-height:auto, so without them the <video> elements' intrinsic size
          wins over the one-third share and this grows over the board and the
          controls, which is exactly what it did the first time. */}
      <div className="flex min-h-0 min-w-0 flex-1 gap-2 border-t border-slate-800 bg-black p-2 lg:flex-col lg:border-l lg:border-t-0">
        {tiles.length === 0 && (
          <div className="grid flex-1 place-items-center text-sm text-slate-600">
            {videoNote ?? 'connecting…'}
          </div>
        )}
        {tiles.map((tile) => <VideoTile key={tile.identity} tile={tile} />)}
      </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-slate-800 px-3 py-1.5 text-xs text-slate-500">
        <span>{state?.participants.filter((p) => p.present).length ?? 0} in the room</span>
        <button
          className="ml-auto hover:text-slate-300"
          onClick={async () => {
            await leaveRoom(session).catch(() => {})
            versionRef.current = 0
            setSession(null)
            setState(null)
          }}
        >
          Leave
        </button>
      </div>
    </div>
  )
}
