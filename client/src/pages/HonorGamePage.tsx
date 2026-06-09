import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Home, Trophy } from 'lucide-react'
import { getHonorSession } from '@/api/honor-game'
import type { HonorQuestion, HonorPlayer } from '@/api/honor-game'
import { PlayerAvatar } from '@/components/PlayerAvatar'

type GameStatus = 'lobby' | 'playing' | 'correct' | 'wrong' | 'won'

const TOTAL_ROUNDS = 10

export function HonorGamePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<HonorQuestion[]>([])
  const [round, setRound] = useState(0)           // 0-indexed current question
  const [status, setStatus] = useState<GameStatus>('lobby')
  const [chosen, setChosen] = useState<1 | 2 | null>(null)  // which card was tapped

  const question = questions[round] ?? null
  function loadSession() {
    setLoading(true)
    setError(null)
    setRound(0)
    setStatus('lobby')
    setChosen(null)
    setQuestions([])
    getHonorSession()
      .then(qs => setQuestions(qs))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load session'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSession() }, [])

  function handleGuess(pick: 1 | 2) {
    if (status !== 'playing' || !question) return
    setChosen(pick)
    const p1 = question.player1
    const p2 = question.player2
    const correct = p1.count > p2.count ? 1 : 2
    if (pick === correct) {
      setStatus('correct')
    } else {
      setStatus('wrong')
    }
  }

  function handleNext() {
    const nextRound = round + 1
    if (nextRound >= questions.length || nextRound >= TOTAL_ROUNDS) {
      setStatus('won')
    } else {
      setRound(nextRound)
      setChosen(null)
      setStatus('playing')
    }
  }

  // Determine border colour for a player card after guess
  function cardBorder(side: 1 | 2): string {
    if (status !== 'correct' && status !== 'wrong') return 'border-transparent'
    if (!question) return 'border-transparent'
    const p1 = question.player1
    const p2 = question.player2
    const correct = p1.count > p2.count ? 1 : 2
    if (side === correct) return 'border-green-500'
    return side === chosen ? 'border-red-500' : 'border-transparent'
  }

  // ── Layout ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
        <Header onHome={() => navigate('/')} round={0} total={TOTAL_ROUNDS} />
        <div className="flex-1 bg-gray-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
        <Header onHome={() => navigate('/')} round={0} total={TOTAL_ROUNDS} />
        <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-gray-600 text-sm">{error}</p>
          <button onClick={loadSession} className="bg-[#1a1a2e] text-white text-sm px-5 py-2 rounded-lg">
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (status === 'lobby') {
    return (
      <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
        <Header onHome={() => navigate('/')} round={0} total={TOTAL_ROUNDS} />
        <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <Trophy className="w-12 h-12 text-yellow-500" />
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">More Trophies?</h2>
            <p className="text-gray-500 text-sm">
              Pick the player who won more of each trophy.<br />
              One wrong answer ends the game.
            </p>
          </div>
          <button
            onClick={() => setStatus('playing')}
            className="bg-[#1a1a2e] text-white font-display text-sm tracking-wide uppercase px-10 py-3 rounded-xl"
          >
            Start
          </button>
        </div>
      </div>
    )
  }

  if (status === 'won') {
    return (
      <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
        <Header onHome={() => navigate('/')} round={TOTAL_ROUNDS} total={TOTAL_ROUNDS} />
        <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <Trophy className="w-12 h-12 text-yellow-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Perfect!</h2>
            <p className="text-gray-500 text-sm">You got all {TOTAL_ROUNDS} right.</p>
          </div>
          <button
            onClick={loadSession}
            className="bg-[#1a1a2e] text-white font-display text-sm tracking-wide uppercase px-10 py-3 rounded-xl"
          >
            Play again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      <Header onHome={() => navigate('/')} round={round} total={TOTAL_ROUNDS} />

      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {question && (
          <div className="flex flex-col flex-1 items-center justify-center px-4 py-6 gap-6">

            {/* Trophy question */}
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">
                {question.honor_label}
              </p>
              <h2 className="text-lg font-bold text-gray-800">
                Who won more?
              </h2>
            </div>

            {/* Player cards */}
            <div className="flex gap-4 w-full">
              <PlayerCard
                player={question.player1}
                border={cardBorder(1)}
                revealed={status === 'correct' || status === 'wrong'}
                onClick={() => handleGuess(1)}
                disabled={status !== 'playing'}
              />
              <div className="flex items-center text-gray-400 font-bold text-sm shrink-0">vs</div>
              <PlayerCard
                player={question.player2}
                border={cardBorder(2)}
                revealed={status === 'correct' || status === 'wrong'}
                onClick={() => handleGuess(2)}
                disabled={status !== 'playing'}
              />
            </div>

            {/* Result feedback + next */}
            {(status === 'correct' || status === 'wrong') && (
              <div className="flex flex-col items-center gap-3 w-full">
                {status === 'correct' ? (
                  <p className="text-green-600 font-semibold text-sm">Correct! ✓</p>
                ) : (
                  <p className="text-red-500 font-semibold text-sm">Wrong!</p>
                )}
                {status === 'correct' ? (
                  <button
                    onClick={handleNext}
                    className="w-full bg-[#1a1a2e] text-white font-bold text-sm py-3 rounded-xl"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    onClick={loadSession}
                    className="w-full bg-[#1a1a2e] text-white font-bold text-sm py-3 rounded-xl"
                  >
                    Play again
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer progress */}
      <div
        className="shrink-0 px-4 py-3 flex items-center justify-center"
        style={{ backgroundColor: '#1a1a2e' }}
      >
        <span className="text-white text-xs font-semibold tracking-widest uppercase">
          Round {round + 1} / {TOTAL_ROUNDS}
        </span>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({ onHome, round, total }: { onHome: () => void; round: number; total: number }) {
  return (
    <div className="bg-[#0b0c1a] divide-soft-b flex items-center justify-between px-3 py-2.5 shrink-0">
      <button onClick={onHome} className="text-white/90 hover:text-green-400 transition-colors p-1">
        <Home className="w-5 h-5" />
      </button>
      <span className="text-white font-display text-sm tracking-wide uppercase">More Trophies?</span>
      <span className="text-white text-sm font-semibold w-12 text-right">
        {round}/{total}
      </span>
    </div>
  )
}

function PlayerCard({
  player,
  border,
  revealed,
  onClick,
  disabled,
}: {
  player: HonorPlayer
  border: string
  revealed: boolean
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex flex-col items-center gap-2 bg-white rounded-2xl p-4 border-2 transition-all shadow-sm ${border} ${disabled ? 'cursor-default' : 'active:scale-95'}`}
    >
      <PlayerAvatar
        id={player.id}
        name={player.name}
        wikipediaUrl={player.wikipedia_url}
        storedPhotoUrl={player.photo_url}
        size="lg"
        variant="game"
      />
      <p className="text-sm font-semibold text-gray-800 text-center leading-tight">{player.name}</p>
      <div className={`text-2xl font-bold ${revealed ? 'text-gray-800' : 'text-gray-300'}`}>
        {revealed ? player.count : '?'}
      </div>
    </button>
  )
}
