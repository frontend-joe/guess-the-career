import { getProgress, putProgress } from '@/api/progress'

// Account-synced game progress. Every game hand-rolls its own localStorage key,
// so instead of touching each game we treat each progress key's value as an
// opaque JSON blob and mirror it to the server for the logged-in user. This
// makes progress survive iOS Safari's 7-day storage eviction and follow the
// account across devices — with zero per-game changes.

const GTC_KEYS = new Set(['gtc_solved_f', 'gtc_solved_m', 'gtc_given_up_f', 'gtc_given_up_m'])

// A localStorage key that holds game progress worth syncing. Covers every game's
// `*_progress` key plus the few that don't follow that convention. Non-progress
// keys (gtl_compact_mode, gtc_mode, *_played, recent-player windows) are excluded.
export function isProgressKey(key: string): boolean {
  return (
    key.endsWith('_progress') ||
    key.startsWith('pk_progress_') ||
    key.startsWith('centurions_') ||
    GTC_KEYS.has(key)
  )
}

type J = unknown
const isPlainObject = (v: J): v is Record<string, J> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// Generic union of two progress blobs — accumulates progress from both sides so
// no guess is ever lost when two devices diverge. Objects merge keys; arrays
// dedupe-concat; booleans OR; numbers max; XI-style 'cleared' wins; else local.
export function mergeProgress(local: J, server: J): J {
  if (local === undefined || local === null) return server
  if (server === undefined || server === null) return local
  if (Array.isArray(local) && Array.isArray(server)) {
    const seen = new Set<string>()
    const out: J[] = []
    for (const item of [...server, ...local]) {
      const k = JSON.stringify(item)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(item)
    }
    return out
  }
  if (isPlainObject(local) && isPlainObject(server)) {
    const out: Record<string, J> = { ...server }
    for (const key of Object.keys(local)) {
      out[key] = key in server ? mergeProgress(local[key], server[key]) : local[key]
    }
    return out
  }
  if (typeof local === 'boolean' && typeof server === 'boolean') return local || server
  if (typeof local === 'number' && typeof server === 'number') return Math.max(local, server)
  if (local === 'cleared' || server === 'cleared') return 'cleared'
  return local
}

// ── Auto-push (wrap localStorage.setItem so every game's saves reach the server)

let currentUserId: number | null = null
let suppress = false // true while syncProgress() writes, so we batch instead
const pending = new Map<string, J>()
let debounce: ReturnType<typeof setTimeout> | null = null

function schedulePush(key: string, value: J) {
  pending.set(key, value)
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => void flush(), 1500)
}

async function flush(keepalive = false) {
  if (debounce) {
    clearTimeout(debounce)
    debounce = null
  }
  if (currentUserId == null || pending.size === 0) return
  const batch = Object.fromEntries(pending)
  pending.clear()
  try {
    await putProgress(batch, { keepalive })
  } catch {
    // best-effort; the next save (or next load's sync) will retry
  }
}

let installed = false
// Wrap localStorage.setItem once so writing any progress key (from any game)
// schedules a debounced push, and flush on pagehide/hide (mobile Safari freezes
// backgrounded tabs, so we must send the last change before it's suspended).
export function installProgressSync() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const original = localStorage.setItem.bind(localStorage)
  localStorage.setItem = (key: string, value: string) => {
    original(key, value)
    if (suppress || currentUserId == null || !isProgressKey(key)) return
    let parsed: J
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = value
    }
    schedulePush(key, parsed)
  }
  const flushNow = () => void flush(true)
  window.addEventListener('pagehide', flushNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow()
  })
}

export function enableSync(userId: number) {
  currentUserId = userId
}

export function disableSync() {
  currentUserId = null
  pending.clear()
  if (debounce) {
    clearTimeout(debounce)
    debounce = null
  }
}

// ── One-time sync: merge server ⇄ localStorage (upload existing + restore) ─────

function localProgress(): Record<string, J> {
  const out: Record<string, J> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !isProgressKey(key)) continue
    const raw = localStorage.getItem(key)
    if (raw == null) continue
    try {
      out[key] = JSON.parse(raw)
    } catch {
      // skip corrupt
    }
  }
  return out
}

// Run once when authenticated: union local and server progress per key, write the
// merged result back to localStorage (restores after eviction), and upload any
// keys where local added something the server didn't have (migrates existing
// progress up). Skips silently if the user isn't logged in.
export async function syncProgress(): Promise<void> {
  let server: Record<string, J>
  try {
    server = await getProgress()
  } catch {
    return // not authenticated or offline
  }
  const local = localProgress()
  const keys = new Set([...Object.keys(local), ...Object.keys(server)])
  const toPush: Record<string, J> = {}

  suppress = true
  try {
    for (const key of keys) {
      const merged = mergeProgress(local[key], server[key])
      const mergedStr = JSON.stringify(merged)
      try {
        localStorage.setItem(key, mergedStr)
      } catch {
        // storage full — ignore
      }
      if (mergedStr !== JSON.stringify(server[key])) toPush[key] = merged
    }
  } finally {
    suppress = false
  }

  try {
    await putProgress(toPush)
  } catch {
    // ignore; ongoing auto-push will catch up
  }
}
