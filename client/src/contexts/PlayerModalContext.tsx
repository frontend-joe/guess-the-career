import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { PlayerInfoModal } from '@/components/PlayerInfoModal'

const PlayerModalContext = createContext<((footballerId: number) => void) | null>(null)

// Wraps the app so any game can open the shared player info modal via
// useShowPlayer(). Renders a single modal instance and keeps a small navigation
// history so tapping a relation can be undone with a back arrow.
export function PlayerModalProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const openRef = useRef<number | null>(null)
  openRef.current = openId

  function show(id: number) {
    const cur = openRef.current
    if (cur != null && cur !== id) setHistory((h) => [...h, cur])
    setOpenId(id)
  }
  function goBack() {
    setHistory((h) => {
      if (h.length === 0) return h
      setOpenId(h[h.length - 1])
      return h.slice(0, -1)
    })
  }
  function close() {
    setOpenId(null)
    setHistory([])
  }

  return (
    <PlayerModalContext.Provider value={show}>
      {children}
      <PlayerInfoModal
        footballerId={openId}
        onClose={close}
        onBack={history.length > 0 ? goBack : undefined}
      />
    </PlayerModalContext.Provider>
  )
}

/** Returns show(footballerId) to open the player info modal. */
export function useShowPlayer(): (footballerId: number) => void {
  const ctx = useContext(PlayerModalContext)
  if (!ctx) throw new Error('useShowPlayer must be used within PlayerModalProvider')
  return ctx
}
