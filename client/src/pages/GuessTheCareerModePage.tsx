import { useNavigate } from 'react-router'
import { Users, ClipboardList, ChevronLeft } from 'lucide-react'
import { GameSettingsButton } from '@/components/GameSettingsButton'

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c1a]'

export function GuessTheCareerModePage() {
  const navigate = useNavigate()

  const modes = [
    { to: '/play/guess-the-career/footballers', icon: Users, label: 'Players', pitch: 'Guess the footballer' },
    { to: '/play/guess-the-career/managers', icon: ClipboardList, label: 'Managers', pitch: 'Guess the manager' },
  ]

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0b0c1a] pitch-grid text-white font-ui px-4 gap-7 relative overflow-hidden selection:bg-green-400/30">
      {/* glow bloom */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-md h-112 rounded-full bg-green-500/15 blur-3xl animate-pulse-glow" />

      <button
        onClick={() => navigate('/')}
        className={`absolute top-4 left-4 z-10 text-white/80 hover:text-green-400 flex items-center gap-1 text-sm font-medium transition-colors ${focusRing} rounded-lg`}
      >
        <ChevronLeft size={16} />
        Games
      </button>

      <div className="absolute top-4 right-4 z-10">
        <GameSettingsButton gameKey="guess_the_career_mode" />
      </div>

      <div className="relative text-center animate-rise">
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
          Guess the <span className="text-green-400 text-glow">Career</span>
        </h1>
        <p className="text-white/50 text-sm mt-2">Choose a game mode</p>
      </div>

      <div className="relative flex flex-col gap-4 w-full max-w-xs animate-rise">
        {modes.map(({ to, icon: Icon, label, pitch }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`group glass glass-hover rounded-3xl p-6 flex flex-col items-center gap-2 hover:-translate-y-1 cursor-pointer transition-all ${focusRing}`}
          >
            <div className="w-14 h-14 rounded-2xl bg-green-400/10 flex items-center justify-center text-green-400 group-hover:bg-green-400/20 transition-colors">
              <Icon size={28} />
            </div>
            <span className="font-display text-lg tracking-tight">{label}</span>
            <span className="text-white/55 text-sm">{pitch}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
