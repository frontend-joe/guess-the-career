import { useState, useRef, useCallback } from 'react'
import { Home, ChevronRight, ArrowLeft, Trophy } from 'lucide-react'
import { getFootballers, type Footballer } from '@/api/footballers'
import {
  verifyPositionGuess, loadProgress, saveProgress, clearProgress,
  type PositionPlayer,
} from '@/api/position-knowledge'
import { nationalityToFlagUrl } from '@/lib/flags'

const NATIONS = ['England', 'Spain', 'Italy', 'France', 'Germany', 'Argentina', 'Brazil', 'Netherlands']

const POSITIONS: { key: string; label: string }[] = [
  { key: 'goalkeeper',           label: 'Goalkeeper' },
  { key: 'right_back',           label: 'Right Back' },
  { key: 'left_back',            label: 'Left Back' },
  { key: 'centre_back',          label: 'Centre Back' },
  { key: 'midfielder',           label: 'Midfielder' },
  { key: 'defensive_midfielder', label: 'Defensive Midfielder' },
  { key: 'attacking_midfielder', label: 'Attacking Midfielder' },
  { key: 'winger',               label: 'Winger' },
  { key: 'forward',              label: 'Forward' },
  { key: 'striker',              label: 'Striker' },
]

const NATION_ADJECTIVE: Record<string, string> = {
  England: 'English', Spain: 'Spanish', Italy: 'Italian',
  France: 'French', Germany: 'German', Argentina: 'Argentine', Brazil: 'Brazilian',
  Netherlands: 'Dutch',
}

interface GamePlayer extends PositionPlayer {
  found: boolean
}

const ROUND_SIZE = 12

type View = 'lobby' | 'playing' | 'success'

export function PositionKnowledgePage() {
  const [view, setView] = useState<View>('lobby')
  const [selectedNation, setSelectedNation] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])

  // Input state
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Footballer[]>([])
  const [wikiVerified, setWikiVerified] = useState<{ id: number; name: string; photo_url: string | null }[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [wrongGuess, setWrongGuess] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wikiSearchRef = useRef<string>('')
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const positionLabel = selectedPosition ? (POSITIONS.find(p => p.key === selectedPosition)?.label ?? '') : ''
  const gameTitle = selectedNation && selectedPosition
    ? `${NATION_ADJECTIVE[selectedNation]} ${positionLabel}s`
    : ''

  const foundCount = players.length
  const totalCount = ROUND_SIZE

  function startGame(nation: string, position: string) {
    const saved = loadProgress(nation, position)
    setPlayers(saved.map(p => ({ ...p, found: true })))
    setView('playing')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleStart() {
    if (!selectedNation || !selectedPosition) return
    startGame(selectedNation, selectedPosition)
  }

  function handleBack() {
    setView('lobby')
    setPlayers([])
    setInputValue('')
    setSuggestions([])
    setWikiVerified([])
    setShowDropdown(false)
    setWrongGuess(null)
  }

  const fetchSuggestions = useCallback((term: string) => {
    if (term.length < 2) { setSuggestions([]); setWikiVerified([]); setShowDropdown(false); return }

    getFootballers({ search: term })
      .then(results => { setSuggestions(results.slice(0, 8)); setShowDropdown(true) })
      .catch(() => {})

    if (term.length >= 3 && selectedNation && selectedPosition) {
      const searchTerm = term
      wikiSearchRef.current = searchTerm
      setWikiVerified([]);
      (async () => {
        try {
          const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term + ' footballer')}&format=json&srlimit=5&origin=*`
          const res = await fetch(url)
          if (!res.ok || wikiSearchRef.current !== searchTerm) return
          const data = await res.json() as { query?: { search?: { title: string }[] } }
          const titles = (data.query?.search ?? []).map((r: { title: string }) => r.title.replace(/ \([^)]+\)$/, ''))
          for (const name of titles) {
            if (wikiSearchRef.current !== searchTerm) return
            const result = await verifyPositionGuess(name, null, selectedNation, selectedPosition)
            if (wikiSearchRef.current !== searchTerm) return
            if (result.valid && result.footballer) {
              setWikiVerified(prev => {
                if (prev.some(p => p.id === result.footballer!.id)) return prev
                return [...prev, result.footballer!]
              })
              setShowDropdown(true)
            }
          }
        } catch { /* ignore */ }
      })()
    }
  }, [selectedNation, selectedPosition])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    wikiSearchRef.current = val
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  async function submitGuess(name: string, id: number | null) {
    if (!selectedNation || !selectedPosition || verifying || view !== 'playing') return

    // Already guessed?
    if (players.some(p => p.id === id || p.name.toLowerCase() === name.toLowerCase())) {
      setInputValue(''); setSuggestions([]); setWikiVerified([]); setShowDropdown(false)
      wikiSearchRef.current = ''
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    setInputValue(''); setSuggestions([]); setWikiVerified([]); setShowDropdown(false)
    wikiSearchRef.current = ''
    setVerifying(true)

    let result
    try {
      result = await verifyPositionGuess(name, id, selectedNation, selectedPosition)
    } catch {
      result = { valid: false, footballer: null, imported: false }
    } finally {
      setVerifying(false)
    }

    if (result.valid && result.footballer) {
      const f = result.footballer
      setPlayers(prev => {
        // Already found this round
        if (prev.some(p => p.id === f.id)) return prev
        const next = [...prev, { id: f.id, name: f.name, photo_url: f.photo_url, found: true }]
        if (next.length >= ROUND_SIZE) {
          clearProgress(selectedNation, selectedPosition)
          setTimeout(() => setView('success'), 300)
        } else {
          saveProgress(selectedNation, selectedPosition, next.map(({ id, name, photo_url }) => ({ id, name, photo_url })))
        }
        return next
      })
    } else {
      if (wrongTimer.current) clearTimeout(wrongTimer.current)
      setWrongGuess(name)
      wrongTimer.current = setTimeout(() => setWrongGuess(null), 1500)
    }

    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputValue.trim() && !verifying) {
      const term = inputValue.trim()
      const termLower = term.toLowerCase()
      const all = [...suggestions, ...wikiVerified.filter(w => !suggestions.some(s => s.id === w.id))]
      const exact = all.find(s => s.name.toLowerCase() === termLower)
      const best = exact ?? all[0]
      if (best) {
        submitGuess(best.name, best.id)
      } else {
        getFootballers({ search: term })
          .then(results => {
            const first = results[0]
            submitGuess(first?.name ?? term, first?.id ?? null)
          })
          .catch(() => submitGuess(term, null))
      }
    }
    if (e.key === 'Escape') { setSuggestions([]); setWikiVerified([]); setShowDropdown(false) }
  }

  // Check progress badge for lobby (any saved progress for current nation selection)
  function hasProgress(position: string): boolean {
    if (!selectedNation) return false
    return loadProgress(selectedNation, position).length > 0
  }

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (view === 'lobby') {
    return (
      <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans bg-[#1a1a2e]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 shrink-0">
          <button className="text-white p-1" onClick={() => window.location.href = '/play'}>
            <Home size={22} />
          </button>
          <span className="text-white font-bold text-sm tracking-widest uppercase">Position Knowledge</span>
          <div className="w-8" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Nation picker */}
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">Select a nation</p>
            <div className="grid grid-cols-2 gap-2">
              {NATIONS.map(nation => {
                const flagUrl = nationalityToFlagUrl(nation)
                const isSelected = selectedNation === nation
                return (
                  <button
                    key={nation}
                    onClick={() => { setSelectedNation(nation); setSelectedPosition(null) }}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors text-left ${
                      isSelected
                        ? 'bg-white text-[#1a1a2e] border-white font-semibold'
                        : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {flagUrl && <img src={flagUrl} alt={nation} className="w-8 h-5 object-cover rounded-sm shrink-0" />}
                    <span className="text-sm font-medium">{nation}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Position picker — only after nation selected */}
          {selectedNation && (
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">Select a position</p>
              <div className="grid grid-cols-2 gap-2">
                {POSITIONS.map(({ key, label }) => {
                  const isSelected = selectedPosition === key
                  const progress = hasProgress(key)
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedPosition(key)}
                      className={`relative flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border transition-colors text-left ${
                        isSelected
                          ? 'bg-white text-[#1a1a2e] border-white font-semibold'
                          : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-sm">{label}</span>
                      {progress && !isSelected && (
                        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Start button */}
          {selectedNation && selectedPosition && (
            <button
              onClick={handleStart}
              className="w-full flex items-center justify-center gap-2 bg-white text-[#1a1a2e] font-bold text-sm py-3 rounded-xl"
            >
              {`Start — ${NATION_ADJECTIVE[selectedNation]} ${positionLabel}s`}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── SUCCESS ────────────────────────────────────────────────────────────────
  if (view === 'success') {
    return (
      <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans bg-[#1a1a2e]">
        <div className="flex items-center justify-between px-3 py-2 shrink-0">
          <button className="text-white p-1" onClick={() => window.location.href = '/play'}>
            <Home size={22} />
          </button>
          <span className="text-white font-bold text-sm tracking-widest uppercase">Position Knowledge</span>
          <div className="w-8" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <Trophy size={56} className="text-yellow-400" />
          <div>
            <p className="text-white font-bold text-2xl mb-1">
              You found all {totalCount}!
            </p>
            <p className="text-white/60 text-sm">{gameTitle}</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleBack}
              className="w-full flex items-center justify-center gap-2 bg-white text-[#1a1a2e] font-bold text-sm py-3 rounded-xl"
            >
              Play again
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => window.location.href = '/play'}
              className="w-full text-white/50 text-sm py-2"
            >
              Back to games
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans"
      onClick={() => { if (showDropdown) { setSuggestions([]); setWikiVerified([]); setShowDropdown(false) } }}
    >
      {/* Header */}
      <div className="bg-[#1a1a2e] flex items-center justify-between px-3 py-2 shrink-0">
        <button className="text-white p-1" onClick={handleBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="text-white font-bold text-sm tracking-widest uppercase truncate px-2">{gameTitle}</span>
        <span className="text-white/60 text-sm font-mono whitespace-nowrap">
          {foundCount}/{totalCount}
        </span>
      </div>

      {/* Scrollable player list */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50">
        <div className="px-3 pt-3 pb-2 flex flex-col gap-1.5">
          {Array.from({ length: ROUND_SIZE }, (_, i) => {
            const player = players[i]
            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
                  player ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                }`}
              >
                {player ? (
                  <>
                    {player.photo_url
                      ? <img src={player.photo_url} alt={player.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                      : <div className="w-7 h-7 rounded-full bg-green-200 flex items-center justify-center shrink-0 text-xs font-bold text-green-600">{player.name.charAt(0)}</div>
                    }
                    <span className="text-sm font-semibold text-green-700 truncate">{player.name}</span>
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-full bg-gray-100 shrink-0" />
                    <div className="h-px bg-gray-200 flex-1 rounded-full" />
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom input panel */}
      <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
        <p className="text-white/50 text-xs mb-2">
          {verifying ? 'Checking…' : `${foundCount} / ${totalCount} found`}
        </p>

        {wrongGuess && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300 text-center mb-2 animate-pulse">
            "{wrongGuess}" doesn't qualify
          </div>
        )}

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a player name…"
            disabled={verifying}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-white text-gray-900 rounded-lg px-3 py-2 outline-none"
            style={{ fontSize: '16px' }}
          />
          {showDropdown && !wrongGuess && (() => {
            const dbIds = new Set(suggestions.map(s => s.id))
            const allItems = [...suggestions, ...wikiVerified.filter(w => !dbIds.has(w.id))]
            return allItems.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                {allItems.map(f => (
                  <button
                    key={f.id}
                    onMouseDown={e => { e.preventDefault(); submitGuess(f.name, f.id) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
