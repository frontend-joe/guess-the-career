import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getSettings, putSettings } from '@/api/settings'

const KEY = 'gtl_game_settings'
const VALID = [25, 50, 75, 100] as const
const DEFAULT_PCT = 100

interface StoredSettings {
  guessPercentage: number
}

function readLocal(): StoredSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredSettings>
      const pct = parsed.guessPercentage
      if (typeof pct === 'number' && (VALID as readonly number[]).includes(pct)) {
        return { guessPercentage: pct }
      }
    }
  } catch {
    /* ignore */
  }
  return { guessPercentage: DEFAULT_PCT }
}

function writeLocal(s: StoredSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

interface SettingsValue {
  /** Share of a round's players (25/50/75/100) needed to pass it. */
  guessPercentage: number
  setGuessPercentage: (value: number) => void
  /** How many of `total` players must be guessed to pass, given the setting. */
  requiredToPass: (total: number) => number
}

const SettingsContext = createContext<SettingsValue | null>(null)

// Global, account-synced game settings (currently just Guess percentage). Local
// for instant reads (and logged-out use); the server is authoritative on login.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [guessPercentage, setPct] = useState<number>(() => readLocal().guessPercentage)

  // On login, adopt the account's stored value (server wins across devices).
  useEffect(() => {
    if (loading || !user) return
    let active = true
    getSettings()
      .then((s) => {
        if (!active) return
        const pct = s.guessPercentage
        if (typeof pct === 'number' && (VALID as readonly number[]).includes(pct)) {
          setPct(pct)
          writeLocal({ guessPercentage: pct })
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [loading, user])

  function setGuessPercentage(value: number) {
    if (!(VALID as readonly number[]).includes(value)) return
    setPct(value)
    writeLocal({ guessPercentage: value })
    if (user) void putSettings({ guessPercentage: value as 25 | 50 | 75 | 100 }).catch(() => {})
  }

  function requiredToPass(total: number): number {
    if (total <= 0) return 0
    if (guessPercentage >= 100) return total
    return Math.max(1, Math.ceil((total * guessPercentage) / 100))
  }

  return (
    <SettingsContext.Provider value={{ guessPercentage, setGuessPercentage, requiredToPass }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
