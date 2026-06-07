import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, X, Search } from 'lucide-react'
import { getKycClubs, getKycSession, type KycClub, type KycPlayer } from '@/api/know-your-club'
import { getFootballers, type Footballer } from '@/api/footballers'
import { NationalityFlag } from '@/components/NationalityFlag'

type GameState = 'lobby' | 'loading' | 'playing' | 'complete' | 'given_up'

interface PlayerResult {
  player: KycPlayer
  guessed: boolean
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function matchesPlayer(guess: string, name: string): boolean {
  const g = normalize(guess)
  const p = normalize(name)
  if (g === p) return true
  const lastName = p.split(' ').at(-1) ?? ''
  return lastName.length >= 4 && g === lastName
}

function ClubBadge({ name, wikipediaUrl }: { name: string; wikipediaUrl: string | null }) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null)

  useEffect(() => {
    if (!wikipediaUrl) { setLogoUrl(false); return }
    const title = wikipediaUrl.split('/wiki/')[1]
    if (!title) { setLogoUrl(false); return }
    const controller = new AbortController()
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setLogoUrl(data?.thumbnail?.source ?? false))
      .catch(err => { if (err.name !== 'AbortError') setLogoUrl(false) })
    return () => controller.abort()
  }, [wikipediaUrl])

  return (
    <div className="w-7 h-7 bg-white/10 flex items-center justify-center shrink-0 overflow-hidden rounded-lg">
      {logoUrl === null ? (
        <div className="w-full h-full bg-white/10 animate-pulse rounded-lg" />
      ) : logoUrl === false ? (
        <span className="text-white/60 font-bold text-xs">{name.charAt(0)}</span>
      ) : (
        <img src={logoUrl} alt={name} className="w-5 h-5 object-contain" />
      )}
    </div>
  )
}

export function KnowYourClubPage() {
  const [gameState, setGameState] = useState<GameState>('lobby')
  const [clubs, setClubs] = useState<KycClub[]>([])
  const [clubsLoading, setClubsLoading] = useState(true)
  const [clubSearch, setClubSearch] = useState('')
  const [selectedClub, setSelectedClub] = useState<KycClub | null>(null)
  const [players, setPlayers] = useState<PlayerResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Footballer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [guessFlash, setGuessFlash] = useState<'correct' | 'wrong' | false>(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getKycClubs()
      .then(setClubs)
      .finally(() => setClubsLoading(false))
  }, [])

  useEffect(() => {
    if (gameState === 'playing') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [gameState])

  const fetchSuggestions = useCallback((term: string) => {
    if (term.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    getFootballers({ search: term })
      .then(results => { setSuggestions(results.slice(0, 8)); setShowDropdown(results.length > 0) })
      .catch(() => {})
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 200)
  }

  function selectClub(club: KycClub) {
    setSelectedClub(club)
    setGameState('loading')
    getKycSession(club.id)
      .then(session => {
        setPlayers(session.players.map(p => ({ player: p, guessed: false })))
        setCurrentIndex(0)
        setInputValue('')
        setSuggestions([])
        setShowDropdown(false)
        setGameState('playing')
      })
      .catch(() => setGameState('lobby'))
  }

  function submitGuess(guess: string) {
    if (!guess.trim()) return
    const current = players[currentIndex]
    if (!current || current.guessed) return

    if (!matchesPlayer(guess, current.player.name)) {
      setInputValue('')
      setSuggestions([])
      setShowDropdown(false)
      setGuessFlash('wrong')
      setTimeout(() => setGuessFlash(false), 400)
      return
    }

    setGuessFlash('correct')
    setTimeout(() => setGuessFlash(false), 400)

    const updated = players.map((p, i) => i === currentIndex ? { ...p, guessed: true } : p)
    setPlayers(updated)
    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)
    inputRef.current?.blur()
    window.scrollTo(0, 0)

    if (currentIndex + 1 >= players.length) {
      setTimeout(() => setGameState('complete'), 500)
    } else {
      setTimeout(() => setCurrentIndex(i => i + 1), 400)
    }
  }

  function pickDifferentTeam() {
    setGameState('lobby')
    setClubSearch('')
    setPlayers([])
    setCurrentIndex(0)
  }

  const filteredClubs = clubs.filter(c =>
    c.name.toLowerCase().includes(clubSearch.toLowerCase())
  )

  const guessedCount = players.filter(p => p.guessed).length
  const currentPlayer = players[currentIndex] ?? null
  const isEndState = gameState === 'complete' || gameState === 'given_up'

  return (
    <div
      className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans bg-[#1a1a2e]"
      onClick={() => { if (showDropdown) { setSuggestions([]); setShowDropdown(false) } }}
    >
      {/* Lobby */}
      {gameState === 'lobby' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 pt-8 pb-4 shrink-0">
            <button
              onClick={() => (window.location.href = '/')}
              className="text-white/60 text-sm flex items-center gap-1 mb-6"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <h1 className="text-white font-bold text-xl tracking-wide mb-1">Know Your Club</h1>
            <p className="text-white/50 text-sm mb-4">Pick a club and identify 10 players</p>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search clubs…"
                value={clubSearch}
                onChange={e => setClubSearch(e.target.value)}
                className="w-full bg-white/10 text-white placeholder-white/30 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {clubsLoading ? (
              <div className="text-white/50 text-sm text-center py-10">Loading clubs…</div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {filteredClubs.map(club => (
                  <button
                    key={club.id}
                    onClick={() => selectClub(club)}
                    className="flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-xl px-3 py-3 transition-colors text-center"
                  >
                    <span className="font-medium text-sm leading-snug">{club.name}</span>
                  </button>
                ))}
                {filteredClubs.length === 0 && !clubsLoading && (
                  <p className="text-white/40 text-sm text-center py-10">No clubs found</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {gameState === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/60 text-sm">Loading…</p>
        </div>
      )}

      {/* In-game states */}
      {(gameState === 'playing' || isEndState) && selectedClub && (
        <>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={pickDifferentTeam} className="text-white/60 p-1 shrink-0">
                <ChevronLeft size={20} />
              </button>
              <ClubBadge name={selectedClub.name} wikipediaUrl={selectedClub.wikipediaUrl} />
              <span className="text-white font-bold text-sm truncate">{selectedClub.name}</span>
            </div>
            {gameState === 'playing' && (
              <span className="text-white/60 text-sm font-mono shrink-0 ml-2">
                {guessedCount} / {players.length}
              </span>
            )}
          </div>

          {/* Photo */}
          {gameState === 'playing' && currentPlayer && (
            <div className="flex-1 min-h-0 flex flex-col px-4 pb-4 gap-3">
              <p className="text-white/70 text-sm font-semibold text-center tracking-widest uppercase shrink-0">Who is this?</p>
              <div className={`relative flex-1 min-h-0 rounded-2xl overflow-hidden ${guessFlash === 'correct' ? 'bg-green-500' : guessFlash === 'wrong' ? 'bg-red-500' : 'bg-gray-900'}`}>
                <img
                  key={currentPlayer.player.id}
                  src={currentPlayer.player.photoUrl}
                  alt="Player"
                  className="w-full h-full object-cover object-top"
                />
                {guessFlash === 'correct' && (
                  <div className="absolute inset-0 bg-green-500/50 pointer-events-none" />
                )}
                {guessFlash === 'wrong' && (
                  <div className="absolute inset-0 bg-red-500/50 pointer-events-none" />
                )}
              </div>
            </div>
          )}

          {/* Results grid */}
          {isEndState && (
            <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50">
              <div className="px-4 pt-5 pb-3">
                {gameState === 'complete' ? (
                  <h2 className="text-lg font-bold text-gray-900">
                    You really know your {selectedClub.name} players!
                  </h2>
                ) : (
                  <h2 className="text-xl font-bold text-gray-900">Too bad!</h2>
                )}
                <p className="text-sm text-gray-500 mt-0.5">{guessedCount} / {gameState === 'given_up' ? currentIndex + 1 : players.length} guessed</p>
              </div>
              <div className="grid grid-cols-2 gap-3 px-4 pb-4">
                {(gameState === 'given_up' ? players.slice(0, currentIndex + 1) : players).map(({ player, guessed }) => (
                  <div key={player.id} className="flex flex-col rounded-xl overflow-hidden bg-white border border-gray-200">
                    <div className="aspect-square bg-gray-100">
                      <img
                        src={player.photoUrl}
                        alt={player.name}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="px-2 py-1.5">
                      <p className={`text-xs font-semibold truncate ${!guessed && gameState === 'given_up' ? 'text-red-500' : 'text-gray-900'}`}>
                        {player.name}
                      </p>
                      <NationalityFlag nationality={player.nationality} className="h-2.5 w-auto mt-0.5 border border-[#ebebeb]" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-8 flex flex-col gap-2">
                <button
                  onClick={() => selectClub(selectedClub)}
                  className="w-full bg-[#1a1a2e] text-white font-semibold text-sm py-3 rounded-xl"
                >
                  {gameState === 'complete' ? 'Play again with ' : 'Try again with '}
                  {selectedClub.name}
                </button>
                <button
                  onClick={pickDifferentTeam}
                  className="w-full bg-gray-100 text-gray-700 font-semibold text-sm py-3 rounded-xl"
                >
                  Pick a different team
                </button>
              </div>
            </div>
          )}

          {/* Bottom panel */}
          {gameState === 'playing' && (
            <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
              <div className="relative mb-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      submitGuess(inputValue)
                      setSuggestions([])
                      setShowDropdown(false)
                    }
                  }}
                  placeholder="Type a player name…"
                  className="w-full bg-white rounded-lg px-4 py-2.5 text-base text-gray-900 outline-none"
                  autoComplete="off"
                />
                {showDropdown && suggestions.length > 0 && (
                  <div className="absolute bottom-full mb-1 left-0 right-0 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto z-10">
                    {suggestions.map(s => (
                      <button
                        key={s.id}
                        className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
                        onMouseDown={e => {
                          e.preventDefault()
                          setInputValue(s.name)
                          setSuggestions([])
                          setShowDropdown(false)
                          submitGuess(s.name)
                        }}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setGameState('given_up')}
                className="w-full flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                <X size={14} />
                Give Up
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
