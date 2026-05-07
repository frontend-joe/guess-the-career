import { useState, useEffect, useRef, useCallback } from 'react'
import { Home, Check, X, ChevronRight } from 'lucide-react'
import { getGhcSession, searchClubs } from '@/api/guess-his-clubs'
import type { GhcFootballer, ClubSuggestion } from '@/api/guess-his-clubs'
import { PlayerAvatar } from '@/components/PlayerAvatar'

type RoundState = 'playing' | 'cleared' | 'given_up'

interface RoundResult {
  footballerId: number
  footballerName: string
  wikipediaUrl: string
  photoUrl: string | null
  required: number
  correctClubs: string[]
  allClubs: string[]
  clubWikiUrls: Record<string, string>
  state: RoundState
}

export function GuessHisClubsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rounds, setRounds] = useState<RoundResult[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<ClubSuggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showFinalScore, setShowFinalScore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function buildRounds(footballers: GhcFootballer[]): RoundResult[] {
    return footballers.map(f => ({
      footballerId: f.id,
      footballerName: f.name,
      wikipediaUrl: f.wikipedia_url,
      photoUrl: f.photo_url,
      required: f.required,
      correctClubs: [],
      allClubs: f.clubs,
      clubWikiUrls: f.clubWikiUrls ?? {},
      state: 'playing' as RoundState,
    }))
  }

  function loadSession() {
    setLoading(true)
    setError(null)
    setRoundIndex(0)
    setRounds([])
    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)
    setShowFinalScore(false)
    getGhcSession()
      .then(data => setRounds(buildRounds(data)))
      .catch(() => setError('Failed to load session. Please try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSession() }, [])

  const fetchSuggestions = useCallback((term: string) => {
    if (term.length < 1) { setSuggestions([]); setShowDropdown(false); return }
    searchClubs(term).then(results => {
      setSuggestions(results)
      setShowDropdown(results.length > 0)
    })
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 200)
  }

  function handleClubGuess(clubName: string) {
    const round = rounds[roundIndex]
    if (!round || round.state !== 'playing') return

    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)

    const normalised = clubName.toLowerCase().trim()

    if (round.correctClubs.some(c => c.toLowerCase() === normalised)) {
      inputRef.current?.focus()
      return
    }

    const matched = round.allClubs.find(c => c.toLowerCase() === normalised)
    if (!matched) {
      inputRef.current?.focus()
      return
    }

    const newCorrect = [...round.correctClubs, matched]
    const newState: RoundState = newCorrect.length >= round.required ? 'cleared' : 'playing'
    const updated = [...rounds]
    updated[roundIndex] = { ...round, correctClubs: newCorrect, state: newState }
    setRounds(updated)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleClubGuess(inputValue.trim())
    }
    if (e.key === 'Escape') {
      setSuggestions([])
      setShowDropdown(false)
    }
  }

  function handleGiveUp() {
    const round = rounds[roundIndex]
    if (!round || round.state !== 'playing') return
    const updated = [...rounds]
    updated[roundIndex] = { ...round, state: 'given_up' }
    setRounds(updated)
  }

  function handleNextRound() {
    if (roundIndex < rounds.length - 1) {
      setRoundIndex(i => i + 1)
      setInputValue('')
      setSuggestions([])
      setShowDropdown(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const currentRound = rounds[roundIndex] ?? null
  const isRoundDone = currentRound?.state !== 'playing'
  const isLastRound = roundIndex === rounds.length - 1
  const totalCorrect = rounds.reduce((sum, r) => sum + r.correctClubs.length, 0)
  const totalRequired = rounds.reduce((sum, r) => sum + r.required, 0)

  return (
    <div
      className="h-dvh flex flex-col w-full max-w-[400px] mx-auto font-sans"
      onClick={() => { if (showDropdown) { setSuggestions([]); setShowDropdown(false) } }}
    >
      {/* Header */}
      <div className="bg-[#1a1a2e] flex items-center justify-between px-3 py-2 shrink-0">
        <button
          className="text-white p-1"
          onClick={() => window.location.href = '/play'}
        >
          <Home size={22} />
        </button>
        <span className="text-white font-bold text-sm tracking-widest uppercase">
          Guess His Clubs
        </span>
        {rounds.length > 0 ? (
          <span className="text-white/60 text-sm font-mono">
            {roundIndex + 1} / {rounds.length}
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

        {!loading && !error && showFinalScore && (
          <FinalScore
            rounds={rounds}
            totalCorrect={totalCorrect}
            totalRequired={totalRequired}
            onPlayAgain={loadSession}
          />
        )}

        {!loading && !error && !showFinalScore && currentRound && (
          <div className="flex flex-col items-center px-3 pt-6 pb-4 gap-5 mt-auto">
            <FootballerCard round={currentRound} />
            <ClubReveal round={currentRound} clubWikiUrls={currentRound.clubWikiUrls} />
          </div>
        )}
      </div>

      {/* Bottom panel */}
      {!loading && !error && !showFinalScore && currentRound && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">

          {/* Correct club chips + missed chips on give up */}
          {(currentRound.correctClubs.length > 0 || currentRound.state === 'given_up') && (
            <div className="flex flex-wrap gap-2 mb-3">
              {currentRound.correctClubs.map(club => (
                <span
                  key={club}
                  className="flex items-center gap-1 bg-green-500/20 text-green-400 text-xs font-semibold px-2.5 py-1 rounded-full"
                >
                  <Check size={11} />
                  {club}
                </span>
              ))}
              {currentRound.state === 'given_up' && currentRound.allClubs
                .filter(c => !currentRound.correctClubs.some(g => g.toLowerCase() === c.toLowerCase()))
                .map(club => (
                  <span
                    key={club}
                    className="flex items-center gap-1 bg-red-500/20 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full"
                  >
                    <X size={11} />
                    {club}
                  </span>
                ))}
            </div>
          )}

          {/* Status text */}
          <p className="text-white/50 text-xs mb-2">
            {isRoundDone
              ? currentRound.state === 'cleared'
                ? `Cleared! ${currentRound.correctClubs.length} / ${currentRound.required} required`
                : `Gave up — ${currentRound.correctClubs.length} / ${currentRound.required} required`
              : `${currentRound.correctClubs.length} / ${currentRound.required} required`}
          </p>

          {/* Input */}
          {!isRoundDone && (
            <div className="relative mb-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a club name…"
                className="w-full bg-white text-gray-900 rounded-lg px-3 py-2 outline-none"
                style={{ fontSize: '16px' }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                      onMouseDown={e => { e.preventDefault(); handleClubGuess(s.name) }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isRoundDone && (
              <button
                onClick={handleGiveUp}
                className="flex-1 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                <X size={14} />
                Give Up
              </button>
            )}
            {isRoundDone && !isLastRound && (
              <button
                onClick={handleNextRound}
                className="flex-1 flex items-center justify-center gap-1 bg-white text-[#1a1a2e] text-sm font-bold py-2 rounded-lg"
              >
                Next Round
                <ChevronRight size={14} />
              </button>
            )}
            {isRoundDone && isLastRound && (
              <button
                onClick={() => setShowFinalScore(true)}
                className="flex-1 flex items-center justify-center gap-1 bg-white text-[#1a1a2e] text-sm font-bold py-2 rounded-lg"
              >
                See Results
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FootballerCard({ round }: { round: RoundResult }) {
  return (
    <div className="flex flex-col items-center text-center gap-2">
      <PlayerAvatar
        id={round.footballerId}
        name={round.footballerName}
        wikipediaUrl={round.wikipediaUrl}
        storedPhotoUrl={round.photoUrl}
        size="lg"
      />
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-widest leading-none mb-0.5">Name the clubs of</p>
        <p className="text-gray-900 font-bold text-lg leading-tight">{round.footballerName}</p>
        <p className="text-gray-400 text-xs mt-0.5">{round.allClubs.length} clubs</p>
        <p className="text-gray-900 font-bold text-base mt-1">Guess {round.required} to clear</p>
      </div>
    </div>
  )
}

function ClubBadge({ name, wikipediaUrl, guessed }: { name: string; wikipediaUrl: string | null; guessed: boolean }) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null)

  useEffect(() => {
    if (!wikipediaUrl) { setLogoUrl(false); return }
    const title = wikipediaUrl.split('/wiki/')[1]
    if (!title) { setLogoUrl(false); return }
    const controller = new AbortController()
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => setLogoUrl(data?.thumbnail?.source ?? false))
      .catch(err => { if (err.name !== 'AbortError') setLogoUrl(false) })
    return () => controller.abort()
  }, [wikipediaUrl])

  const ring = guessed ? 'ring-2 ring-green-400' : 'ring-2 ring-red-400'

  return (
    <div className="relative" title={name}>
      <div className={`w-14 h-14 rounded-xl bg-white flex items-center justify-center ${ring}`}>
        {logoUrl === null && <div className="w-8 h-8 rounded bg-gray-100 animate-pulse" />}
        {logoUrl === false && <span className="text-sm font-bold text-gray-300">{name.charAt(0)}</span>}
        {logoUrl && <img src={logoUrl} alt={name} className="w-11 h-11 object-contain p-0.5" />}
      </div>
      <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${guessed ? 'bg-green-500' : 'bg-red-500'}`}>
        {guessed
          ? <Check size={10} className="text-white" strokeWidth={3} />
          : <X size={10} className="text-white" strokeWidth={3} />
        }
      </div>
    </div>
  )
}

function ClubReveal({ round, clubWikiUrls = {} }: { round: RoundResult; clubWikiUrls?: Record<string, string> }) {
  if (round.state === 'playing') return null

  const missedClubs = round.allClubs.filter(
    c => !round.correctClubs.some(g => g.toLowerCase() === c.toLowerCase())
  )

  return (
    <div className="w-full">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 text-center">All clubs</p>
      <div className="flex flex-wrap gap-3 justify-center">
        {round.correctClubs.map(club => (
          <ClubBadge
            key={club}
            name={club}
            wikipediaUrl={clubWikiUrls[club.toLowerCase()] ?? null}
            guessed={true}
          />
        ))}
        {missedClubs.map(club => (
          <ClubBadge
            key={club}
            name={club}
            wikipediaUrl={clubWikiUrls[club.toLowerCase()] ?? null}
            guessed={false}
          />
        ))}
      </div>
    </div>
  )
}

function FinalScore({
  rounds,
  totalCorrect,
  totalRequired,
  onPlayAgain,
}: {
  rounds: RoundResult[]
  totalCorrect: number
  totalRequired: number
  onPlayAgain: () => void
}) {
  const pct = totalRequired > 0 ? Math.round((totalCorrect / totalRequired) * 100) : 0
  const pctColor = pct >= 80 ? 'text-green-500' : pct >= 60 ? 'text-orange-400' : 'text-red-500'

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-6">
      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Final Score</p>
        <p className={`text-5xl font-bold mt-2 ${pctColor}`}>{pct}%</p>
      </div>

      <div className="w-full flex flex-col gap-2">
        {rounds.map((r, i) => {
          const cleared = r.state === 'cleared'
          const partial = r.correctClubs.length > 0 && !cleared
          return (
            <div
              key={r.footballerId}
              className={`flex items-center justify-between rounded-lg px-3 py-2 border ${cleared ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-gray-400 text-xs font-mono shrink-0">{i + 1}</span>
                <span className="text-sm font-semibold text-gray-800 truncate">{r.footballerName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs text-gray-500">
                  {r.correctClubs.length}/{r.required}
                </span>
                {cleared ? (
                  <Check size={14} className="text-green-500" />
                ) : partial ? (
                  <span className="text-yellow-500 text-xs font-bold">~</span>
                ) : (
                  <X size={14} className="text-red-400" />
                )}
              </div>
            </div>
          )
        })}
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
