import { createContext, useContext, useState, type ReactNode } from 'react'

const KEY = 'gtl_compact_mode'

interface CompactModeValue {
  compact: boolean
  setCompact: (value: boolean) => void
}

const CompactModeContext = createContext<CompactModeValue | null>(null)

// Admin-only "compact mode": hides each game's subject card so only the header,
// list and guessing input show. Persisted in localStorage; toggled from the
// in-game burger menu and read by every list-game page.
export function CompactModeProvider({ children }: { children: ReactNode }) {
  const [compact, setCompactState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })

  function setCompact(value: boolean) {
    setCompactState(value)
    try {
      localStorage.setItem(KEY, value ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  return (
    <CompactModeContext.Provider value={{ compact, setCompact }}>
      {children}
    </CompactModeContext.Provider>
  )
}

export function useCompactMode(): CompactModeValue {
  const ctx = useContext(CompactModeContext)
  if (!ctx) throw new Error('useCompactMode must be used within CompactModeProvider')
  return ctx
}
