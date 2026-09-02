import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getSettings, putGuessPercentage } from '@/api/settings'

const KEY = 'gtl_game_settings'
const VALID = [25, 50, 75, 100] as const
const DEFAULT_PCT = 100

type PctMap = Record<string, number>

function isValidPct(v: unknown): v is number {
  return typeof v === 'number' && (VALID as readonly number[]).includes(v)
}

function readLocal(): PctMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { guessPercentages?: unknown }
      const map = parsed.guessPercentages
      if (map && typeof map === 'object') {
        const out: PctMap = {}
        for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
          if (isValidPct(v)) out[k] = v
        }
        return out
      }
    }
  } catch {
    /* ignore */
  }
  return {}
}

function writeLocal(map: PctMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ guessPercentages: map }))
  } catch {
    /* ignore */
  }
}

interface SettingsContextValue {
  guessPercentages: PctMap
  setGuessPercentage: (gameKey: string, value: number) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

// Per-game, account-synced game settings (currently just Guess percentage). Local
// for instant reads (and logged-out use); the server is authoritative on login.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [guessPercentages, setMap] = useState<PctMap>(() => readLocal())

  // On login, merge the account's stored per-game values (server wins per key).
  useEffect(() => {
    if (loading || !user) return
    let active = true
    getSettings()
      .then((s) => {
        if (!active || !s.guessPercentages) return
        setMap((local) => {
          const merged: PctMap = { ...local }
          for (const [k, v] of Object.entries(s.guessPercentages!)) {
            if (isValidPct(v)) merged[k] = v
          }
          writeLocal(merged)
          return merged
        })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [loading, user])

  function setGuessPercentage(gameKey: string, value: number) {
    if (!isValidPct(value)) return
    setMap((prev) => {
      const next = { ...prev, [gameKey]: value }
      writeLocal(next)
      return next
    })
    if (user) void putGuessPercentage(gameKey, value).catch(() => {})
  }

  return (
    <SettingsContext.Provider value={{ guessPercentages, setGuessPercentage }}>
      {children}
    </SettingsContext.Provider>
  )
}

export interface GameSettings {
  /** This game's pass share (25/50/75/100). 100 = must guess all (default). */
  guessPercentage: number
  setGuessPercentage: (value: number) => void
  /** How many of `total` players must be guessed to pass this game's round. */
  requiredToPass: (total: number) => number
}

// Read/write the Guess-percentage setting for one game. Every game passes a
// stable, unique gameKey so each game keeps its own difficulty.
export function useSettings(gameKey: string): GameSettings {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  const guessPercentage = ctx.guessPercentages[gameKey] ?? DEFAULT_PCT
  return {
    guessPercentage,
    setGuessPercentage: (value: number) => ctx.setGuessPercentage(gameKey, value),
    requiredToPass: (total: number) => {
      if (total <= 0) return 0
      if (guessPercentage >= 100) return total
      return Math.max(1, Math.ceil((total * guessPercentage) / 100))
    },
  }
}
