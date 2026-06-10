import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Menu, X, Home, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { LIST_GAMES, BANTER_GAMES, type Game } from '@/lib/games'

// In-game burger menu: a frosted drawer that slides in from the left with
// global navigation (Admin / Home) plus a full game switcher. Sits in the left
// slot of every game header.
export function GameMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function go(to: string) {
    setOpen(false)
    navigate(to)
  }

  function GameRow({ g }: { g: Game }) {
    const Icon = g.icon
    const active = pathname === g.to
    return (
      <button
        onClick={() => go(g.to)}
        className={`w-full text-left flex items-start gap-3 px-4 py-2.5 transition-colors ${active ? 'bg-green-400/10' : 'hover:bg-white/5'}`}
      >
        <span className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-green-400/20 text-green-400' : 'bg-white/5 text-green-400'}`}>
          <Icon size={16} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white truncate">{g.name}</span>
          <span className="block text-xs text-white/45 leading-snug">{g.pitch}</span>
        </span>
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="text-white/90 hover:text-green-400 transition-colors p-1"
      >
        <Menu size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-60 font-ui">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div className="absolute inset-y-0 left-0 z-70 w-80 max-w-[85vw] bg-[#0b0c1a]/70 backdrop-blur-xl shadow-2xl overflow-y-auto flex flex-col animate-slide-in-left">
            <div className="sticky top-0 bg-[#0b0c1a]/80 backdrop-blur-md divide-soft-b flex items-center justify-between px-4 py-3">
              <span className="font-display text-sm tracking-wide uppercase text-white">Menu</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-white/90 hover:text-green-400 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="py-1">
              {user?.is_admin && (
                <button
                  onClick={() => go('/admin')}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white/85 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <Settings size={18} className="text-green-400" /> Admin
                </button>
              )}
              <button
                onClick={() => go('/')}
                className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white/85 hover:bg-white/5 hover:text-white transition-colors divide-soft-b"
              >
                <Home size={18} className="text-green-400" /> Home
              </button>
            </nav>

            <div className="px-4 pt-3 pb-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">List Games</span>
            </div>
            {LIST_GAMES.map((g) => <GameRow key={g.to} g={g} />)}

            <div className="px-4 pt-4 pb-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Banter Games</span>
            </div>
            {BANTER_GAMES.map((g) => <GameRow key={g.to} g={g} />)}

            <div className="h-3" />
          </div>
        </div>
      )}
    </>
  )
}
