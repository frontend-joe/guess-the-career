import { AccessToken, DataPacket_Kind, RoomServiceClient } from 'livekit-server-sdk'

// LiveKit carries two separate things for us: the video and audio between
// players, and the broadcast that tells every client the board has moved.
//
// The server never joins the room. RoomServiceClient speaks plain HTTP
// (Twirp), so sendData() fans a message out from a process holding no realtime
// connection at all. That is the whole reason this codebase has no WebSocket
// server: the clients already maintain one connection each, with reconnect and
// ordered delivery, and a second realtime system to deliver ~40 messages a
// round would need its own heartbeat, backoff and fan-out state — state that
// dies on every deploy. It also keeps us free of native modules, which matters
// on a nixpacks container whose better-sqlite3 build is already one gcc away
// from breaking.
//
// Everything here degrades to a no-op when LIVEKIT_* is unset, so the server
// boots and the HTTP game still works on a machine with no LiveKit account.

const TOKEN_TTL = '6h'

// One topic for server-authoritative state. Peer-to-peer ephemera (reactions,
// "I'm about to say something") belongs on a different topic and must never
// reach this one, so a client can tell at a glance what it is allowed to trust.
export const STATE_TOPIC = 'gtl-state'

export interface LivekitConfig {
  url: string
  apiKey: string
  apiSecret: string
}

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

const REQUIRED = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const

// Which of the three are missing. Names only — a name is not a secret, and
// without this the failure is a bare "no video" that gives you nothing to go
// on when the cause is a typo or the wrong Railway service.
export function livekitMissing(): string[] {
  return REQUIRED.filter((name) => env(name) == null)
}

export function livekitConfig(): LivekitConfig | null {
  if (livekitMissing().length) return null
  return {
    url: env('LIVEKIT_URL')!,
    apiKey: env('LIVEKIT_API_KEY')!,
    apiSecret: env('LIVEKIT_API_SECRET')!,
  }
}

// LIVEKIT_URL is handed out as wss:// for clients to dial; the service API is
// the same host over https. Accept either spelling so nobody has to keep two
// nearly identical variables in sync.
function serviceUrl(url: string): string {
  return url.replace(/^ws/, 'http')
}

let cached: { config: LivekitConfig; client: RoomServiceClient } | null = null

function roomService(config: LivekitConfig): RoomServiceClient {
  if (!cached || cached.config.url !== config.url || cached.config.apiKey !== config.apiKey) {
    cached = {
      config,
      client: new RoomServiceClient(serviceUrl(config.url), config.apiKey, config.apiSecret),
    }
  }
  return cached.client
}

// A join token for one participant in one room. Scoped to that room by name,
// so a token leaked out of a game code cannot be used to wander into another.
export async function mintJoinToken(
  roomName: string,
  identity: string,
  displayName: string,
): Promise<string | null> {
  const config = livekitConfig()
  if (!config) return null
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity,
    name: displayName,
    ttl: TOKEN_TTL,
  })
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    // Clients may talk to each other directly on their own topics. They cannot
    // forge a state message that other clients will act on, because clients
    // treat a broadcast as nothing more than "go and refetch the state".
    canPublishData: true,
  })
  return token.toJwt()
}

export interface StateBroadcast {
  kind: string
  stateVersion: number
  code: string
}

// Tell the room that something changed.
//
// Deliberately fire-and-forget. The write has already landed in SQLite by the
// time this is called, and a broadcast is only ever a hint to go and refetch;
// awaiting LiveKit's round trip would add it to the latency of the host's
// guess, and a failure would turn a successful write into a 500. A message
// that never arrives costs a client its 10-second poll, nothing more.
export function broadcastState(livekitRoom: string, message: StateBroadcast): void {
  const config = livekitConfig()
  if (!config) return
  const payload = new TextEncoder().encode(JSON.stringify({ v: 1, ...message }))
  roomService(config)
    .sendData(livekitRoom, payload, DataPacket_Kind.RELIABLE, { topic: STATE_TOPIC })
    .catch((err: unknown) => {
      // Includes the ordinary case of a room nobody has dialled into yet.
      console.warn(`livekit: broadcast to ${livekitRoom} failed:`, err)
    })
}
