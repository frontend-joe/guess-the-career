import { useState, useEffect } from 'react'
import { Home, TrendingUp, TrendingDown, ChevronRight, Trophy } from 'lucide-react'
import { getWsmSession } from '@/api/who-scored-more'
import type { WsmPlayer } from '@/api/who-scored-more'
import { PlayerAvatar } from '@/components/PlayerAvatar'

type GameStatus = 'playing' | 'correct' | 'wrong' | 'won'

export function WhoScoredMorePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [players, setPlayers] = useState<WsmPlayer[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [status, setStatus] = useState<GameStatus>('playing')

  function loadSession() {
    setLoading(true)
    setError(null)
    setCurrentIndex(0)
    setStatus('playing')
    setPlayers([])
    getWsmSession()
      .then(data => setPlayers(data))
      .catch(() => setError('Failed to load session. Please try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSession() }, [])

  function handleGuess(guess: 'more' | 'less') {
    if (status !== 'playing' || players.length === 0) return
    const current = players[currentIndex]
    const challenger = players[currentIndex + 1]
    const correct =
      (guess === 'more' && challenger.total_goals >= current.total_goals) ||
      (guess === 'less' && challenger.total_goals <= current.total_goals)

    if (correct) {
      setStatus(currentIndex === players.length - 2 ? 'won' : 'correct')
    } else {
      setStatus('wrong')
    }
  }

  function handleContinue() {
    setCurrentIndex(i => i + 1)
    setStatus('playing')
  }

  const current = players[currentIndex]
  const challenger = players[currentIndex + 1]
  const comparisonsTotal = players.length > 0 ? players.length - 1 : 9

  return (
    <div className="h-dvh flex flex-col w-full max-w-[400px] mx-auto font-sans">
      {/* Header */}
      <div className="bg-[#1a1a2e] flex items-center justify-between px-3 py-2 shrink-0">
        <button className="text-white p-1" onClick={() => window.location.href = '/play'}>
          <Home size={22} />
        </button>
        <span className="text-white font-bold text-sm tracking-widest uppercase">
          Who Scored More?
        </span>
        {players.length > 0 && status !== 'won' ? (
          <span className="text-white/60 text-sm font-mono">
            {currentIndex} / {comparisonsTotal}
          </span>
        ) : (
          <span className="w-8" />
        )}
      </div>

      {/* Scrollable area */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Loading session…
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <p className="text-red-500 text-sm text-center">{error}</p>
            <button
              onClick={loadSession}
              className="bg-[#1a1a2e] text-white text-sm px-4 py-2 rounded-lg"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && status === 'won' && (
          <WonScreen players={players} onPlayAgain={loadSession} />
        )}

        {!loading && !error && status !== 'won' && current && challenger && (
          <div className="flex-1 flex flex-col justify-center px-4 py-6 gap-4">
            <PlayerCard player={current} goalsVisible={true} goalsStyle="neutral" />
            <div className="flex items-center justify-center py-1">
              <span className="text-gray-400 text-xs uppercase tracking-widest font-semibold">vs</span>
            </div>
            <PlayerCard
              player={challenger}
              goalsVisible={status !== 'playing'}
              goalsStyle={status === 'correct' ? 'green' : status === 'wrong' ? 'red' : 'neutral'}
            />
          </div>
        )}
      </div>

      {/* Bottom panel */}
      {!loading && !error && status !== 'won' && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
          {status === 'playing' && (
            <div className="flex gap-3">
              <button
                onClick={() => handleGuess('more')}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                <TrendingUp size={16} />
                More
              </button>
              <button
                onClick={() => handleGuess('less')}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                <TrendingDown size={16} />
                Less
              </button>
            </div>
          )}
          {status === 'correct' && (
            <button
              onClick={handleContinue}
              className="w-full flex items-center justify-center gap-1 bg-white text-[#1a1a2e] text-sm font-bold py-3 rounded-xl"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          )}
          {status === 'wrong' && (
            <div className="flex flex-col gap-2">
              <p className="text-white/60 text-xs text-center">
                Wrong — {players[currentIndex + 1]?.name} scored {players[currentIndex + 1]?.total_goals} goals
              </p>
              <button
                onClick={loadSession}
                className="w-full flex items-center justify-center bg-white text-[#1a1a2e] text-sm font-bold py-3 rounded-xl"
              >
                Play Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PlayerCard({
  player,
  goalsVisible,
  goalsStyle,
}: {
  player: WsmPlayer
  goalsVisible: boolean
  goalsStyle: 'neutral' | 'green' | 'red'
}) {
  const goalsColor =
    goalsStyle === 'green' ? 'text-green-500' :
    goalsStyle === 'red' ? 'text-red-500' :
    'text-gray-900'

  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <PlayerAvatar
        id={player.id}
        name={player.name}
        wikipediaUrl={player.wikipedia_url}
        size="md"
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-base leading-tight truncate">{player.name}</p>
        <p className={`text-3xl font-bold mt-1 ${goalsColor}`}>
          {goalsVisible ? player.total_goals : '???'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">career goals</p>
      </div>
    </div>
  )
}

function WonScreen({ players, onPlayAgain }: { players: WsmPlayer[]; onPlayAgain: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 gap-6">
      <div className="text-center">
        <Trophy size={40} className="text-yellow-500 mx-auto mb-2" />
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Perfect!</p>
        <p className="text-5xl font-bold text-green-500 mt-2">10 / 10</p>
      </div>

      <div className="w-full flex flex-col gap-2">
        {players.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-gray-400 text-xs font-mono shrink-0">{i + 1}</span>
              <span className="text-sm font-semibold text-gray-800 truncate">{p.name}</span>
            </div>
            <span className="text-sm font-bold text-gray-600 shrink-0 ml-2">⚽ {p.total_goals}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onPlayAgain}
        className="bg-[#1a1a2e] text-white font-bold text-sm tracking-widest uppercase px-8 py-3 rounded-xl"
      >
        Play Again
      </button>
    </div>
  )
}
