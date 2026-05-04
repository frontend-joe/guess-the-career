import { useNavigate } from 'react-router'
import { Users, ClipboardList, ChevronLeft } from 'lucide-react'

export function GuessTheCareerModePage() {
  const navigate = useNavigate()

  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-[#1a1a2e] px-4 gap-6 font-sans relative">
      <button
        onClick={() => navigate('/play')}
        className="absolute top-4 left-4 text-white/60 hover:text-white flex items-center gap-1 text-sm transition-colors"
      >
        <ChevronLeft size={16} />
        Games
      </button>

      <h1 className="text-white font-bold text-base tracking-[0.2em] uppercase mb-2">
        Guess the Career
      </h1>
      <p className="text-gray-400 text-sm">Choose a game mode</p>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => navigate('/play/guess-the-career/footballers')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <Users size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Players</span>
          <span className="text-gray-400 text-xs">Guess the footballer</span>
        </button>
        <button
          onClick={() => navigate('/play/guess-the-career/managers')}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <ClipboardList size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">Managers</span>
          <span className="text-gray-400 text-xs">Guess the manager</span>
        </button>
      </div>
    </div>
  )
}
