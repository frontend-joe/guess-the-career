import { useState, useRef } from 'react'
import { Home, ChevronRight, ArrowLeft, Trophy } from 'lucide-react'
import { GameMenu } from '@/components/GameMenu'
import { GuessSearchInput } from '@/components/GuessSearchInput'
import {
  getPositionPlayers, verifyPositionGuess, loadProgress, loadWrongGuesses, saveProgress, clearProgress,
  type PositionPlayer,
} from '@/api/position-knowledge'
import { nationalityToFlagUrl } from '@/lib/flags'
import { GameSettingsButton } from '@/components/GameSettingsButton'

const NATIONS = ['England', 'Spain', 'Italy', 'France', 'Germany', 'Argentina', 'Brazil', 'Netherlands', 'Portugal', 'Ireland']

const POSITIONS: { key: string; label: string }[] = [
  { key: 'goalkeeper',           label: 'Goalkeeper' },
  { key: 'right_back',           label: 'Right Back' },
  { key: 'left_back',            label: 'Left Back' },
  { key: 'centre_back',          label: 'Centre Back' },
  { key: 'defensive_midfielder', label: 'Defensive Midfielder' },
  { key: 'central_midfielder',   label: 'Central Midfielder' },
  { key: 'attacking_midfielder', label: 'Attacking Midfielder' },
  { key: 'winger',               label: 'Winger' },
  { key: 'striker',              label: 'Striker' },
]

const NATION_ADJECTIVE: Record<string, string> = {
  England: 'English', Spain: 'Spanish', Italy: 'Italian',
  France: 'French', Germany: 'German', Argentina: 'Argentine', Brazil: 'Brazilian',
  Netherlands: 'Dutch', Portugal: 'Portuguese', Ireland: 'Irish',
}

interface GamePlayer extends PositionPlayer {
  found: boolean
}

const MAX_roundSize = 12

type View = 'lobby' | 'playing' | 'success'

export function PositionKnowledgePage() {
  const [view, setView] = useState<View>('lobby')
  const [selectedNation, setSelectedNation] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [roundSize, setRoundSize] = useState(MAX_roundSize)

  // Input state
  const [verifying, setVerifying] = useState(false)
  const [wrongGuess, setWrongGuess] = useState<string | null>(null)
  const [wrongGuesses, setWrongGuesses] = useState<Set<string>>(new Set())

  const inputRef = useRef<HTMLInputElement>(null)
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const positionLabel = selectedPosition ? (POSITIONS.find(p => p.key === selectedPosition)?.label ?? '') : ''
  const gameTitle = selectedNation && selectedPosition
    ? `${NATION_ADJECTIVE[selectedNation]} ${positionLabel}s`
    : ''

  const foundCount = players.length
  const totalCount = roundSize

  async function startGame(nation: string, position: string) {
    try {
      const available = await getPositionPlayers(nation, position)
      const size = Math.min(MAX_roundSize, available.length)
      setRoundSize(size)
      const saved = loadProgress(nation, position)
      setPlayers(saved.map(p => ({ ...p, found: true })))
      setWrongGuesses(new Set(loadWrongGuesses(nation, position)))
    } catch {
      setRoundSize(MAX_roundSize)
      setPlayers([])
      setWrongGuesses(new Set())
    }
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
    setWrongGuesses(new Set())
    setWrongGuess(null)
  }

  async function submitGuess(name: string, id: number | null) {
    if (!selectedNation || !selectedPosition || verifying || view !== 'playing') return

    // Already guessed?
    if (players.some(p => p.id === id || p.name.toLowerCase() === name.toLowerCase())) {
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

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
        if (next.length >= roundSize) {
          clearProgress(selectedNation!, selectedPosition!)
          setTimeout(() => setView('success'), 300)
        } else {
          saveProgress(selectedNation!, selectedPosition!, next.map(({ id, name, photo_url }) => ({ id, name, photo_url })), [...wrongGuesses])
        }
        return next
      })
    } else {
      if (wrongTimer.current) clearTimeout(wrongTimer.current)
      setWrongGuess(name)
      wrongTimer.current = setTimeout(() => setWrongGuess(null), 1500)
      const newWrong = new Set(wrongGuesses)
      newWrong.add(name.toLowerCase().trim())
      setWrongGuesses(newWrong)
      saveProgress(
        selectedNation, selectedPosition,
        players.map(({ id, name, photo_url }) => ({ id, name, photo_url })),
        [...newWrong],
      )
    }
  }

  function guessStatus(s: { id: number; name: string }) {
    if (players.some(p => p.id === s.id || p.name.toLowerCase() === s.name.toLowerCase()))
      return 'correct' as const
    if (wrongGuesses.has(s.name.toLowerCase().trim())) return 'incorrect' as const
    return null
  }

  // Check progress badge for lobby (any saved progress for current nation selection)
  function hasProgress(position: string): boolean {
    if (!selectedNation) return false
    return loadProgress(selectedNation, position).length > 0
  }

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (view === 'lobby') {
    const formValid = !!(selectedNation && selectedPosition)
    return (
      <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans bg-[#1a1a2e]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 shrink-0">
          <button className="text-white/90 hover:text-green-400 transition-colors p-1" onClick={() => window.location.href = '/'}>
            <Home size={22} />
          </button>
          <span className="text-white font-display text-sm tracking-wide uppercase">Position Knowledge</span>
          <div className="w-8" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-6">
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
        </div>

        {/* Start button — fixed to bottom */}
        <div className="shrink-0 px-4 py-4 border-t border-white/10">
          <button
            onClick={handleStart}
            disabled={!formValid}
            className={`w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl transition-colors ${
              formValid
                ? 'bg-white text-[#1a1a2e]'
                : 'bg-white/20 text-white/40 cursor-not-allowed'
            }`}
          >
            {formValid
              ? `Start — ${NATION_ADJECTIVE[selectedNation!]} ${positionLabel}s`
              : 'Select a nation and position'}
          </button>
        </div>
      </div>
    )
  }

  // ── SUCCESS ────────────────────────────────────────────────────────────────
  if (view === 'success') {
    return (
      <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans bg-[#1a1a2e]">
        <div className="flex items-center justify-between px-3 py-2 shrink-0">
          <button className="text-white/90 hover:text-green-400 transition-colors p-1" onClick={() => window.location.href = '/'}>
            <Home size={22} />
          </button>
          <span className="text-white font-display text-sm tracking-wide uppercase">Position Knowledge</span>
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
              onClick={() => window.location.href = '/'}
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
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      {/* Header */}
      <div className="bg-[#0b0c1a] divide-soft-b flex items-center justify-between px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-1">
          <GameMenu />
          <button className="text-white/90 hover:text-green-400 transition-colors p-1" onClick={handleBack}>
            <ArrowLeft size={22} />
          </button>
        </div>
        <span className="text-white font-display text-sm tracking-wide uppercase truncate px-2">{gameTitle}</span>
        <div className="flex items-center gap-1">
          <span className="text-white/60 text-sm font-mono whitespace-nowrap">
            {foundCount}/{totalCount}
          </span>
          <GameSettingsButton />
        </div>
      </div>

      {/* Scrollable player list */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50">
        <div className="px-3 pt-3 pb-2 flex flex-col gap-1.5">
          {Array.from({ length: roundSize }, (_, i) => {
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

        <GuessSearchInput autoScrape={true}
          inputRef={inputRef}
          disabled={verifying}
          suppressDropdown={!!wrongGuess}
          getKey={f => f.id}
          getLabel={f => f.name}
          getStatus={guessStatus}
          onSelect={(name, item) => submitGuess(name, item?.id ?? null)}
        />
      </div>
    </div>
  )
}
