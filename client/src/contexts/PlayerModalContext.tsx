import { createContext, useContext, useState, type ReactNode } from 'react'
import { PlayerInfoModal } from '@/components/PlayerInfoModal'

const PlayerModalContext = createContext<((footballerId: number) => void) | null>(null)

// Wraps the app so any game can open the shared player info modal via
// useShowPlayer(). Renders a single modal instance.
export function PlayerModalProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<number | null>(null)
  return (
    <PlayerModalContext.Provider value={setOpenId}>
      {children}
      <PlayerInfoModal footballerId={openId} onClose={() => setOpenId(null)} />
    </PlayerModalContext.Provider>
  )
}

/** Returns show(footballerId) to open the player info modal. */
export function useShowPlayer(): (footballerId: number) => void {
  const ctx = useContext(PlayerModalContext)
  if (!ctx) throw new Error('useShowPlayer must be used within PlayerModalProvider')
  return ctx
}
