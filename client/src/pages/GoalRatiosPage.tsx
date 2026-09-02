import { useState, useRef, useCallback, useEffect } from 'react'
import { Trophy } from 'lucide-react'
import { GameMenu } from "@/components/GameMenu";
import { getFootballers, type Footballer } from '@/api/footballers'
import {
  getGoalRatiosPlayers, loadProgress, saveProgress, clearProgress,
  type GoalRatiosPlayer,
} from '@/api/goal-ratios'
import { NationalityFlag } from '@/components/NationalityFlag'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { GameSettingsButton } from '@/components/GameSettingsButton'

function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function formatClub(club: string): { name: string; isLoan: boolean } {
  const isLoan = club.startsWith('→')
  const name = club.replace(/^→\s*/, '').replace(/\s*\(loan\)\s*$/i, '').trim()
  return { name, isLoan }
}

interface GamePlayer extends GoalRatiosPlayer {
  found: boolean
}

export function GoalRatiosPage() {
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)

  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Footballer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [verifying] = useState(false)
  const [wrongGuess, setWrongGuess] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getGoalRatiosPlayers()
      .then((data) => {
        const foundIds = new Set(loadProgress())
        const gamePlayers: GamePlayer[] = data.map((p) => ({ ...p, found: foundIds.has(p.id) }))
        setPlayers(gamePlayers)
        if (gamePlayers.length > 0 && gamePlayers.every((p) => p.found)) {
          setCompleted(true)
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 50)
      })
  }, [])

  const foundCount = players.filter((p) => p.found).length
  const totalCount = players.length

  const fetchSuggestions = useCallback((term: string) => {
    if (term.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    getFootballers({ search: term })
      .then((results) => { setSuggestions(results.slice(0, 8)); setShowDropdown(true) })
      .catch(() => {})
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  function submitGuess(name: string, id: number | null) {
    if (verifying || completed) return

    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)

    const normalizedGuess = normalizeName(name)

    setPlayers((prev) => {
      // Find unguessed player matching by ID or normalized name
      const matchIdx = prev.findIndex(
        (p) => !p.found && (
          (id != null && p.id === id) ||
          normalizeName(p.name) === normalizedGuess
        ),
      )

      if (matchIdx === -1) {
        // No match — show wrong flash
        if (wrongTimer.current) clearTimeout(wrongTimer.current)
        setWrongGuess(name)
        wrongTimer.current = setTimeout(() => setWrongGuess(null), 1500)
        return prev
      }

      const next = prev.map((p, i) => i === matchIdx ? { ...p, found: true } : p)
      const newFoundIds = next.filter((p) => p.found).map((p) => p.id)
      saveProgress(newFoundIds)

      if (next.every((p) => p.found)) {
        setTimeout(() => setCompleted(true), 300)
      }

      return next
    })

    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputValue.trim() && !verifying) {
      const term = inputValue.trim()
      const termLower = term.toLowerCase()
      const exact = suggestions.find((s) => s.name.toLowerCase() === termLower)
      const best = exact ?? suggestions[0]
      if (best) {
        submitGuess(best.name, best.id)
      } else {
        getFootballers({ search: term })
          .then((results) => {
            const first = results[0]
            submitGuess(first?.name ?? term, first?.id ?? null)
          })
          .catch(() => submitGuess(term, null))
      }
    }
    if (e.key === 'Escape') { setSuggestions([]); setShowDropdown(false) }
  }

  function handleReset() {
    clearProgress()
    setCompleted(false)
    setPlayers((prev) => prev.map((p) => ({ ...p, found: false })))
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-[#1a1a2e]">
        <span className="text-white/50 text-sm">Loading…</span>
      </div>
    )
  }

  // ── COMPLETED ────────────────────────────────────────────────────────────────
  if (completed) {
    return (
      <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans bg-[#1a1a2e]">
        <div className="flex items-center justify-between px-3 py-2 shrink-0">
          <GameMenu />
          <span className="text-white font-display text-sm tracking-wide uppercase">Goal Ratios</span>
          <div className="w-8" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <Trophy size={56} className="text-yellow-400" />
          <div>
            <p className="text-white font-bold text-2xl mb-1">You found all {totalCount}!</p>
            <p className="text-white/60 text-sm">Every player with more goals than games</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleReset}
              className="w-full bg-white text-[#1a1a2e] font-bold text-sm py-3 rounded-xl"
            >
              Reset &amp; play again
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

  // ── GAME ──────────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans"
      onClick={() => { if (showDropdown) { setSuggestions([]); setShowDropdown(false) } }}
    >
      {/* Header */}
      <div className="bg-[#0b0c1a] divide-soft-b flex items-center justify-between px-3 py-2.5 shrink-0">
        <GameMenu />
        <span className="text-white font-display text-sm tracking-wide uppercase">Goal Ratios</span>
        <div className="flex items-center gap-1">
          <span className="text-white/60 text-sm font-mono whitespace-nowrap">
            {foundCount}/{totalCount}
          </span>
          <GameSettingsButton />
        </div>
      </div>

      {/* Scrollable player list */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50">
        <div className="px-3 pt-3 pb-2 flex flex-col gap-2">
          {players.map((player, i) => {
            return (
              <div
                key={i}
                className={`rounded-xl px-3 py-2.5 border transition-colors ${
                  player.found ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                }`}
              >
                {/* Flag + name row */}
                <div className="flex items-center gap-2 mb-2">
                  <NationalityFlag nationality={player.nationality} size={20} />
                  <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                  {player.found
                    ? <p className="text-sm font-semibold text-green-700 truncate">{player.name}</p>
                    : <span className="inline-block align-middle" style={{
                        width: '8em',
                        height: '1em',
                        backgroundColor: '#eff6ff',
                        border: '1.5px solid #3b82f6',
                        borderRadius: '3px',
                        backgroundImage: 'linear-gradient(#2563eb, #2563eb)',
                        backgroundSize: 'calc(100% - 8px) 1px',
                        backgroundPosition: '4px calc(100% - 4px)',
                        backgroundRepeat: 'no-repeat',
                      }} />
                  }
                  {player.mainClub && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-400">Main Club:</span>
                      <MiniClubBadge club={player.mainClub} wikipediaUrl={player.mainClubWikipediaUrl} />
                    </div>
                  )}
                  </div>
                </div>

                {/* Wiki-style stints table */}
                <table className="w-full table-fixed text-xs border-collapse" style={{ borderSpacing: 0 }}>
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[48%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                  </colgroup>
                  <thead>
                    <tr style={{ background: '#eaecf0' }}>
                      <th className="text-left px-1.5 py-0.5 font-semibold text-gray-600 border border-[#a2a9b1]">Years</th>
                      <th className="text-left px-1.5 py-0.5 font-semibold text-gray-600 border border-[#a2a9b1]">Club</th>
                      <th className="text-right px-1.5 py-0.5 font-semibold text-gray-600 border border-[#a2a9b1]">Apps</th>
                      <th className="text-right px-1.5 py-0.5 font-semibold text-gray-600 border border-[#a2a9b1]">Goals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {player.stints.map((stint, j) => {
                      const { name: clubName, isLoan } = formatClub(stint.club)
                      return (
                        <tr key={j} style={{ background: j % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                          <td className="px-1.5 py-0.5 text-gray-600 border border-[#a2a9b1] whitespace-nowrap">{stint.years}</td>
                          <td className="px-1.5 py-0.5 text-gray-800 border border-[#a2a9b1]">
                            {isLoan ? <>{clubName} <span className="text-gray-400">(loan)</span></> : clubName}
                          </td>
                          <td className="px-1.5 py-0.5 text-gray-800 text-right border border-[#a2a9b1]">{stint.apps}</td>
                          <td className="px-1.5 py-0.5 text-gray-800 text-right font-semibold border border-[#a2a9b1]">{stint.goals}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
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
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
              {suggestions.map((f) => (
                <button
                  key={f.id}
                  onMouseDown={(e) => { e.preventDefault(); submitGuess(f.name, f.id) }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
