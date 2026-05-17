import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getFootballers } from '@/api/footballers'
import {
  getCenturionPlayers, loadCenturionProgress, saveCenturionProgress,
  CENTURION_MODES, type CenturionPlayer,
} from '@/api/centurions'
import { NationalityFlag } from '@/components/NationalityFlag'
import { MiniClubBadge } from '@/components/MiniClubBadge'

// ── Fuzzy matching (same as TwoClubsPage) ─────────────────────────────────────

const TRANSLITERATE: Record<string, string> = {
  ı: 'i', ł: 'l', ø: 'o', đ: 'd', ð: 'd',
  æ: 'a', œ: 'o', ħ: 'h', ŋ: 'n', ŧ: 't',
  þ: 'th', ß: 'ss',
}
const TRANSLIT_RE = /[ıłøđðæœħŋŧþß]/g

function normalizeGuess(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(TRANSLIT_RE, c => TRANSLITERATE[c] ?? c).trim()
}

function damerauDistance(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
    }
  }
  return dp[m][n]
}

function matchesPlayer(guess: string, playerName: string): boolean {
  const g = normalizeGuess(guess)
  const p = normalizeGuess(playerName)
  if (g === p) return true
  const lastName = p.split(' ').at(-1) ?? ''
  if (lastName.length >= 4 && g === lastName) return true
  if (lastName.length >= 4 && g.length >= 4 && damerauDistance(g, lastName) === 1) return true
  return false
}

// ── Player slot ───────────────────────────────────────────────────────────────

function PlayerSlot({ player, found, mode }: { player: CenturionPlayer; found: boolean; mode: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const isAppearances = mode === 'appearances'

  if (found) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 border bg-green-50 border-green-200">
        {player.photo_url && !imgFailed
          ? <img src={player.photo_url} alt={player.name} className="w-8 h-8 rounded-full object-cover shrink-0" onError={() => setImgFailed(true)} />
          : <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center shrink-0 text-xs font-bold text-green-700">{player.name.charAt(0)}</div>
        }
        <span className="text-sm font-semibold text-green-800 truncate flex-1">{player.name}</span>
        <span className="text-xs font-bold text-green-600 shrink-0 tabular-nums">
          {player.stat.toLocaleString()}{isAppearances ? ' apps' : ' goals'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 border bg-white border-gray-200">
      <NationalityFlag nationality={player.nationality} size={20} />
      <div className="flex-1 h-3 bg-gray-100 rounded-full" />
      {player.hint_club && mode !== 'international' && (
        <MiniClubBadge club={player.hint_club} wikipediaUrl={null} />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CenturionsGamePage() {
  const { mode } = useParams<{ mode: string }>()
  const navigate = useNavigate()

  const modeConfig = CENTURION_MODES.find(m => m.id === mode)

  const [players, setPlayers] = useState<CenturionPlayer[]>([])
  const [guessedKeys, setGuessedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<{ id: number; name: string }[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [wrongGuess, setWrongGuess] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!mode) return
    setLoading(true)
    getCenturionPlayers(mode)
      .then(data => {
        setPlayers(data)
        const saved = loadCenturionProgress(mode)
        setGuessedKeys(new Set(saved.guessedKeys))
        saveCenturionProgress(mode, saved.guessedKeys, data.length)
      })
      .catch(() => setError('Failed to load players'))
      .finally(() => setLoading(false))
  }, [mode])

  useEffect(() => {
    if (!loading && !error) setTimeout(() => inputRef.current?.focus(), 50)
  }, [loading, error])

  const fetchSuggestions = useCallback((term: string) => {
    if (term.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    getFootballers({ search: term })
      .then(results => { setSuggestions(results.slice(0, 8)); setShowDropdown(true) })
      .catch(() => {})
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250)
  }

  function submitGuess(name: string) {
    if (!mode) return
    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)

    const matched = players.filter(p => !guessedKeys.has(p.slot_key) && matchesPlayer(name, p.name))
    if (matched.length > 0) {
      const newKeys = new Set([...guessedKeys, ...matched.map(p => p.slot_key)])
      setGuessedKeys(newKeys)
      saveCenturionProgress(mode, [...newKeys], players.length)
    } else {
      if (wrongTimer.current) clearTimeout(wrongTimer.current)
      setWrongGuess(name)
      wrongTimer.current = setTimeout(() => setWrongGuess(null), 1500)
    }

    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputValue.trim()) {
      const term = inputValue.trim()
      const exact = suggestions.find(s => s.name.toLowerCase() === term.toLowerCase())
      submitGuess(exact?.name ?? suggestions[0]?.name ?? term)
    }
    if (e.key === 'Escape') { setSuggestions([]); setShowDropdown(false) }
  }

  if (!modeConfig) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Unknown game mode</p>
      </div>
    )
  }

  const guessedCount = guessedKeys.size
  const total = players.length
  const isComplete = total > 0 && guessedCount >= total

  return (
    <div
      className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans"
      onClick={() => { if (showDropdown) { setSuggestions([]); setShowDropdown(false) } }}
    >
      {/* Header */}
      <div className="bg-[#1a1a2e] flex items-center justify-between px-3 py-2 shrink-0">
        <button className="text-white p-1" onClick={() => navigate('/play/centurions')}>
          <ArrowLeft size={22} />
        </button>
        <span className="text-white font-bold text-sm tracking-widest uppercase truncate px-2">
          {modeConfig.title}
        </span>
        <span className="text-white/60 text-sm font-mono whitespace-nowrap">
          {guessedCount}/{loading ? '…' : total}
        </span>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-gray-400" size={28} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
        ) : (
          <div className="px-3 pt-3 pb-2 flex flex-col gap-1.5">
            {players.map(player => (
              <PlayerSlot
                key={player.slot_key}
                player={player}
                found={guessedKeys.has(player.slot_key)}
                mode={mode ?? ''}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom input panel */}
      <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
        <p className={`text-xs mb-2 ${isComplete ? 'text-green-400' : guessedCount > 0 ? 'text-blue-300' : 'text-white/50'}`}>
          {isComplete ? `All ${total} found! ✓` : `${guessedCount} / ${total} found`}
        </p>

        {isComplete ? (
          <div className="bg-green-500/20 border border-green-500/30 rounded-xl px-3 py-3 text-sm text-green-300 text-center font-semibold">
            Challenge complete!
          </div>
        ) : (
          <div className="relative">
            <div className="bg-blue-600 rounded-xl px-2 py-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a player name…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-white text-gray-900 rounded-lg px-3 py-2 outline-none"
                style={{ fontSize: '16px' }}
              />
            </div>

            {showDropdown && suggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                {suggestions.map(f => (
                  <button
                    key={f.id}
                    onMouseDown={e => { e.preventDefault(); submitGuess(f.name) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {wrongGuess && (
          <div className="mt-2 bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300 text-center animate-pulse">
            "{wrongGuess}" doesn't qualify
          </div>
        )}
      </div>
    </div>
  )
}
