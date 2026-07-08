import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Menu, X, Home, Settings, Rows3, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCompactMode } from '@/contexts/CompactModeContext'
import { Checkbox } from '@/components/ui/checkbox'
import { LIST_GAMES, BANTER_GAMES, type Game } from '@/lib/games'

// In-game burger menu: a frosted drawer that slides in from the left with
// global navigation (Admin / Home) plus a full game switcher. Sits in the left
// slot of every game header.
export function GameMenu() {
  const { user } = useAuth()
  const { compact, setCompact } = useCompactMode()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [mounted, setMounted] = useState(false) // in the DOM (kept during exit)
  const [visible, setVisible] = useState(false) // drives the slide/fade transition

  function openMenu() {
    setMounted(true)
    requestAnimationFrame(() => setVisible(true))
  }
  function closeMenu() {
    setVisible(false)
    setTimeout(() => setMounted(false), 200) // unmount after the slide-out
  }

  // Close on Escape while open.
  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mounted])

  function go(to: string) {
    closeMenu()
    navigate(to)
  }

  // Row styling for the global nav links (Admin / Home).
  function Row({ icon: Icon, label, to }: { icon: LucideIcon; label: string; to: string }) {
    const active = pathname === to
    return (
      <button
        onClick={() => go(to)}
        className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${active ? 'bg-green-400/10' : 'hover:bg-white/5'}`}
      >
        <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-green-400/20 text-green-400' : 'bg-white/5 text-green-400'}`}>
          <Icon size={16} />
        </span>
        <span className="block text-sm font-semibold text-white truncate">{label}</span>
      </button>
    )
  }

  // Compact game card for the 3-per-row grid: icon tile + name + pitch.
  function GameCard({ game }: { game: Game }) {
    const Icon = game.icon
    const active = pathname === game.to
    return (
      <button
        onClick={() => go(game.to)}
        className={`group flex flex-col items-start text-left gap-1.5 rounded-xl p-2.5 transition active:scale-95 ${active ? 'bg-green-400/10' : 'bg-white/5 hover:bg-white/10'}`}
      >
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${active ? 'bg-green-400/20 text-green-400' : 'bg-green-400/10 text-green-400 group-hover:bg-green-400/20'}`}>
          <Icon size={18} />
        </span>
        <span className="text-[11px] font-semibold text-white leading-tight line-clamp-2">{game.name}</span>
      </button>
    )
  }

  return (
    <>
      <button
        onClick={openMenu}
        aria-label="Open menu"
        aria-haspopup="menu"
        aria-expanded={mounted}
        className="text-white/90 hover:text-green-400 transition-colors p-1"
      >
        <Menu size={22} />
      </button>

      {mounted && (
        <div className="fixed inset-0 z-60 font-ui flex justify-center items-stretch sm:items-center">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeMenu}
          />
          {/* Panel — full-screen on mobile, centered modal on sm+ */}
          <div className={`relative z-70 w-full h-full sm:h-auto sm:max-w-3xl sm:max-h-[85vh] sm:rounded-2xl bg-[#0b0c1a]/90 backdrop-blur-xl shadow-2xl overflow-y-auto flex flex-col transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <div className="sticky top-0 z-10 bg-[#0b0c1a]/80 backdrop-blur-md divide-soft-b flex items-center justify-between px-4 py-3">
              <span className="font-display text-sm tracking-wide uppercase text-white">Menu</span>
              <button
                onClick={closeMenu}
                aria-label="Close menu"
                className="text-white/90 hover:text-green-400 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="py-1 divide-soft-b">
              {user?.is_admin && <Row icon={Settings} label="Admin" to="/admin" />}
              <Row icon={Home} label="Home" to="/" />
            </nav>

            {user?.is_admin && (
              <div className="py-1 divide-soft-b">
                <label className="w-full flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/5">
                  <span className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-green-400">
                    <Rows3 size={16} />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-white">Compact mode</span>
                  <Checkbox checked={compact} onCheckedChange={setCompact} className="h-4 w-4 shrink-0" />
                </label>
              </div>
            )}

            <div className="px-4 pt-3 pb-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">List Games</span>
            </div>
            <div className="grid grid-cols-3 gap-2 px-3">
              {LIST_GAMES.map((g) => <GameCard key={g.to} game={g} />)}
            </div>

            <div className="px-4 pt-4 pb-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Banter Games</span>
            </div>
            <div className="grid grid-cols-3 gap-2 px-3">
              {BANTER_GAMES.map((g) => <GameCard key={g.to} game={g} />)}
            </div>

            <div className="h-3" />
          </div>
        </div>
      )}
    </>
  )
}
