import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { Home, Loader2, Trophy, X, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react'
import { getFootballers } from '@/api/footballers'
import { getNationalsScheduleRounds, type NationalsScheduleRound } from '@/api/nationals-schedule'
import { OverallProgressScreen, type ProgressRound } from '@/components/OverallProgressScreen'
import { MiniClubBadge } from '@/components/MiniClubBadge'
import { nationalityToFlagUrl } from '@/lib/flags'

const TARGET = 5

const COUNTRY_ADJECTIVE: Record<string, string> = {
  England: 'English', Scotland: 'Scottish', Wales: 'Welsh', 'Northern Ireland': 'Northern Irish',
  France: 'French', Germany: 'German', Spain: 'Spanish', Italy: 'Italian', Portugal: 'Portuguese',
  Netherlands: 'Dutch', Belgium: 'Belgian', Brazil: 'Brazilian', Argentina: 'Argentine',
  Croatia: 'Croatian', Uruguay: 'Uruguayan', Colombia: 'Colombian', Chile: 'Chilean',
  Mexico: 'Mexican', 'United States': 'American', Turkey: 'Turkish', Russia: 'Russian',
  Ukraine: 'Ukrainian', Poland: 'Polish', 'Czech Republic': 'Czech', Slovakia: 'Slovak',
  Austria: 'Austrian', Switzerland: 'Swiss', Sweden: 'Swedish', Norway: 'Norwegian',
  Denmark: 'Danish', Finland: 'Finnish', Iceland: 'Icelandic', Serbia: 'Serbian',
  Greece: 'Greek', Romania: 'Romanian', Hungary: 'Hungarian', Slovenia: 'Slovenian',
  'North Macedonia': 'Macedonian', Albania: 'Albanian', 'Bosnia and Herzegovina': 'Bosnian',
  Montenegro: 'Montenegrin', Bulgaria: 'Bulgarian', Georgia: 'Georgian', Armenia: 'Armenian',
  Belarus: 'Belarusian', Azerbaijan: 'Azerbaijani', Ireland: 'Irish', 'Republic of Ireland': 'Irish',
  Ecuador: 'Ecuadorian', Paraguay: 'Paraguayan', Bolivia: 'Bolivian', Peru: 'Peruvian',
  Venezuela: 'Venezuelan', Japan: 'Japanese', 'South Korea': 'South Korean', Australia: 'Australian',
  Morocco: 'Moroccan', Algeria: 'Algerian', Nigeria: 'Nigerian', Senegal: 'Senegalese',
  Ghana: 'Ghanaian', 'Ivory Coast': 'Ivorian', Cameroon: 'Cameroonian', Egypt: 'Egyptian',
  Tunisia: 'Tunisian', Liberia: 'Liberian', Mali: 'Malian', Guinea: 'Guinean',
  Yugoslavia: 'Yugoslav', 'West Germany': 'German',
  Latvia: 'Latvian', Lithuania: 'Lithuanian', Estonia: 'Estonian',
  Israel: 'Israeli', 'Saudi Arabia': 'Saudi', Qatar: 'Qatari',
  'Costa Rica': 'Costa Rican', Jamaica: 'Jamaican', 'Trinidad and Tobago': 'Trinidadian',
  Zimbabwe: 'Zimbabwean', 'DR Congo': 'Congolese', 'South Africa': 'South African',
  Kosovo: 'Kosovan',
}

function nationalityAdjective(nat: string): string {
  return COUNTRY_ADJECTIVE[nat] ?? nat
}

// ─── localStorage ─────────────────────────────────────────────────────────────

const PROGRESS_KEY = 'np_progress'

interface RoundProgress {
  guessedIds: number[]
}

interface SavedProgress {
  [comboKey: string]: RoundProgress
}

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveProgress(progress: SavedProgress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

function comboKey(nationality: string, club: string): string {
  return `${nationality}|||${club}`
}

// ─── Name matching ────────────────────────────────────────────────────────────

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

// ─── Nationality badge (large, same shape as ClubBadge in TwoClubs) ───────────

function NationalityBadge({ nationality }: { nationality: string }) {
  const flagUrl = nationalityToFlagUrl(nationality)

  return (
    <div className="flex flex-col items-center gap-1.5 w-24">
      <div className="w-14 h-14 bg-white border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
        {flagUrl
          ? <img src={flagUrl} alt={nationality} className="w-full h-full object-cover p-2 bg-gray-50" />
          : <span className="text-gray-500 font-bold text-xl">{nationality.charAt(0)}</span>}
      </div>
      <span className="text-gray-800 font-semibold text-xs text-center leading-tight max-w-20 h-8 flex items-start justify-center line-clamp-2">{nationality}</span>
    </div>
  )
}

// ─── Club badge ───────────────────────────────────────────────────────────────

function ClubBadge({ name, wikiUrl }: { name: string; wikiUrl: string | null }) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null)

  useEffect(() => {
    if (!wikiUrl) { setLogoUrl(false); return }
    const title = wikiUrl.split('/wiki/')[1]
    if (!title) { setLogoUrl(false); return }
    const controller = new AbortController()
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setLogoUrl(data?.thumbnail?.source ?? false))
      .catch(err => { if (err.name !== 'AbortError') setLogoUrl(false) })
    return () => controller.abort()
  }, [wikiUrl])

  return (
    <div className="flex flex-col items-center gap-1.5 w-24">
      <div className="w-14 h-14 bg-white border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
        {logoUrl === null
          ? <div className="w-full h-full animate-pulse bg-gray-100" />
          : logoUrl === false
            ? <span className="text-gray-500 font-bold text-xl">{name.charAt(0)}</span>
            : <img src={logoUrl} alt={name} className="w-full h-full object-contain p-1" />}
      </div>
      <span className="text-gray-800 font-semibold text-xs text-center leading-tight max-w-20 h-8 flex items-start justify-center line-clamp-2">{name}</span>
    </div>
  )
}

// ─── Player slot ──────────────────────────────────────────────────────────────

interface Player {
  id: number
  name: string
  photo_url: string | null
}

function PlayerSlot({ index, player }: { index: number; player: Player | null }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${player ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${player ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
        {index + 1}
      </span>
      {player ? (
        <div className="flex items-center gap-2 min-w-0">
          {player.photo_url && !imgFailed
            ? <img src={player.photo_url} alt={player.name} className="w-7 h-7 rounded-full object-cover shrink-0" onError={() => setImgFailed(true)} />
            : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-xs font-bold text-gray-400">{player.name.charAt(0)}</div>
          }
          <span className="text-sm font-semibold text-gray-800 truncate">{player.name}</span>
        </div>
      ) : (
        <div className="h-px bg-gray-200 flex-1 rounded-full" />
      )}
    </div>
  )
}

// ─── Round state ──────────────────────────────────────────────────────────────

interface RoundState {
  round: NationalsScheduleRound
  players: Player[] | null
  guessedIds: Set<number>
}

// ─── Verify ───────────────────────────────────────────────────────────────────

interface VerifyResult {
  valid: boolean
  footballer: { id: number; name: string; photo_url: string | null } | null
  foundName?: string
  foundNationality?: string | null
  imported: boolean
  reason?: 'not_retired' | 'wrong_nationality' | 'wrong_club' | 'wrong_both'
}

async function verifyGuess(
  footballerName: string,
  footballerId: number | null,
  nationality: string,
  club: string,
): Promise<VerifyResult> {
  try {
    const body: Record<string, unknown> = { footballerName, nationality, club }
    if (footballerId != null) body.footballerId = footballerId
    const res = await fetch('/api/nationals/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { valid: false, footballer: null, imported: false }
    return await res.json()
  } catch {
    return { valid: false, footballer: null, imported: false }
  }
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function NationalityPlayersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [rounds, setRounds] = useState<NationalsScheduleRound[]>([])
  const [roundStates, setRoundStates] = useState<Record<string, RoundState>>({})
  const [roundIndex, setRoundIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  const [progressSearch, setProgressSearch] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<{ id: number; name: string; photo_url: string | null }[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [wrongGuessMsg, setWrongGuessMsg] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Load schedule ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    getNationalsScheduleRounds()
      .then(data => {
        setRounds(data)
        const saved = loadProgress()
        const states: Record<string, RoundState> = {}
        data.forEach(r => {
          const key = comboKey(r.nationality, r.club)
          const prog = saved[key]
          states[key] = {
            round: r,
            players: null,
            guessedIds: new Set(prog?.guessedIds ?? []),
          }
        })
        setRoundStates(states)

        const todayIso = new Date().toISOString().split('T')[0]
        const numParam = parseInt(searchParams.get('round') ?? '', 10)
        const paramIdx = !isNaN(numParam) ? Math.max(0, Math.min(numParam - 1, data.length - 1)) : -1
        const todayIdx = data.findIndex(r => r.date === todayIso)
        const pastRounds = data.filter(r => r.date <= todayIso)
        const idx = paramIdx >= 0 ? paramIdx : todayIdx >= 0 ? todayIdx : pastRounds.length > 0 ? pastRounds.length - 1 : 0
        setRoundIndex(idx)
      })
      .catch(() => setError('Failed to load schedule'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync round index to URL ───────────────────────────────────────────────
  const currentRound = rounds[roundIndex]
  useEffect(() => {
    if (!currentRound) return
    setSearchParams({ round: String(roundIndex + 1) }, { replace: true })
  }, [roundIndex, currentRound]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch players for current round ───────────────────────────────────────
  const currentKey = currentRound ? comboKey(currentRound.nationality, currentRound.club) : null
  const currentState = currentKey ? roundStates[currentKey] : null

  useEffect(() => {
    if (!currentRound || !currentKey) return
    if (roundStates[currentKey]?.players !== null) return

    fetch(`/api/nationals/answers?nationality=${encodeURIComponent(currentRound.nationality)}&club=${encodeURIComponent(currentRound.club)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((players: Player[]) => {
        setRoundStates(prev => ({ ...prev, [currentKey]: { ...prev[currentKey], players } }))
      })
      .catch(() => {})
  }, [currentKey, currentRound]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !error && rounds.length > 0 && !showProgress) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [roundIndex, loading, error, rounds.length, showProgress])

  // ── Autocomplete ──────────────────────────────────────────────────────────
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
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  // ── Submit guess ──────────────────────────────────────────────────────────
  async function submitGuess(name: string) {
    if (!currentState || !currentKey || !currentRound || verifying) return
    const players = currentState.players
    if (!players) return
    const activeGuesses = players.filter(p => currentState.guessedIds.has(p.id)).length
    if (activeGuesses >= TARGET) return

    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)

    const alreadyFound = players
      .filter(p => currentState.guessedIds.has(p.id))
      .some(p => matchesPlayer(name, p.name))
    if (alreadyFound) { setTimeout(() => inputRef.current?.focus(), 50); return }

    const matched = players.filter(p => !currentState.guessedIds.has(p.id) && matchesPlayer(name, p.name))
    if (matched.length > 0) {
      const newGuessedIds = new Set([...currentState.guessedIds, ...matched.map(p => p.id)])
      setRoundStates(prev => ({ ...prev, [currentKey]: { ...prev[currentKey], guessedIds: newGuessedIds } }))
      const saved = loadProgress()
      saved[currentKey] = { guessedIds: [...newGuessedIds] }
      saveProgress(saved)
    } else {
      setVerifying(true)
      try {
        const result = await verifyGuess(name, null, currentRound.nationality, currentRound.club)
        if (result.valid && result.footballer) {
          const f = result.footballer
          setRoundStates(prev => {
            const state = prev[currentKey]
            if (!state) return prev
            const alreadyInList = state.players?.some(p => p.id === f.id)
            const newPlayers = alreadyInList ? state.players! : [...(state.players ?? []), f]
            const newGuessedIds = new Set([...state.guessedIds, f.id])
            return { ...prev, [currentKey]: { ...state, players: newPlayers, guessedIds: newGuessedIds } }
          })
          const saved = loadProgress()
          const existing = saved[currentKey]?.guessedIds ?? []
          saved[currentKey] = { guessedIds: [...new Set([...existing, f.id])] }
          saveProgress(saved)
        } else {
          if (wrongTimer.current) clearTimeout(wrongTimer.current)
          const displayName = result.foundName ?? `"${name}"`
          const actualNat = result.foundNationality ? (nationalityAdjective(result.foundNationality) || result.foundNationality) : null
          const msg =
            result.reason === 'not_retired' ? `Correct, but ${displayName} isn't retired yet!` :
            result.reason === 'wrong_nationality' && actualNat ? `${displayName} is actually ${actualNat}` :
            result.reason === 'wrong_club' ? `${displayName} didn't play for ${currentRound.club}` :
            result.reason === 'wrong_both' ? `${displayName} wasn't either` :
            `${displayName} is not a valid answer`
          setWrongGuessMsg(msg)
          wrongTimer.current = setTimeout(() => setWrongGuessMsg(null), 2500)
        }
      } finally {
        setVerifying(false)
      }
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

  function handleRandom() {
    const idx = Math.floor(Math.random() * rounds.length)
    setRoundIndex(idx)
  }

  // ── Progress screen ───────────────────────────────────────────────────────
  const progressRounds: ProgressRound[] = rounds.map((r, i) => {
    const key = comboKey(r.nationality, r.club)
    const state = roundStates[key]
    const statePlayers = state?.players
    const validIds = statePlayers
      ? statePlayers.filter(p => state!.guessedIds.has(p.id)).length
      : state?.guessedIds.size ?? 0
    const guessed = Math.min(validIds, TARGET)
    return {
      name: <span className="text-xs font-medium"><span className="text-gray-400 mr-1">#{i + 1}</span>{r.nationality} × {r.club}</span>,
      icon: (
        <div className="flex items-center gap-1">
          {nationalityToFlagUrl(r.nationality)
            ? <img src={nationalityToFlagUrl(r.nationality)!} alt={r.nationality} className="w-5 h-5 object-cover rounded-sm shrink-0" />
            : <span className="text-xs font-bold text-gray-400">{r.nationality.charAt(0)}</span>
          }
          <MiniClubBadge club={r.club} wikipediaUrl={r.clubWikiUrl} />
        </div>
      ),
      guessed,
      total: TARGET,
    }
  })

  const totalGuessed = Object.values(roundStates).filter(s => s.guessedIds.size >= TARGET).length
  const totalPlayers = rounds.length

  const filteredProgressData = progressRounds
    .map((r, i) => ({ r, i }))
    .filter(({ i }) => {
      if (!progressSearch.trim()) return true
      const term = progressSearch.toLowerCase()
      return rounds[i].nationality.toLowerCase().includes(term) || rounds[i].club.toLowerCase().includes(term)
    })
  const filteredProgressRounds = filteredProgressData.map(d => d.r)
  const filteredOriginalIndices = filteredProgressData.map(d => d.i)

  const players = currentState?.players ?? null

  // Only count IDs that exist in the loaded players list — guards against stale localStorage IDs
  // from players that were deleted and re-imported with a new ID.
  const validGuessedIds = players
    ? new Set(players.filter(p => currentState!.guessedIds.has(p.id)).map(p => p.id))
    : currentState?.guessedIds ?? new Set<number>()
  const guessedCount = validGuessedIds.size
  const isDone = guessedCount >= TARGET

  const foundPlayers: (Player | null)[] = Array.from({ length: TARGET }, (_, i) => {
    if (!players) return null
    const found = players.filter(p => validGuessedIds.has(p.id))
    return found[i] ?? null
  })

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  if (error || rounds.length === 0) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 bg-gray-50 px-6">
        <p className="text-gray-500 text-sm text-center">{error ?? 'No rounds scheduled yet'}</p>
        <button onClick={() => window.location.href = '/play'} className="text-sm text-blue-600 underline">Back to games</button>
      </div>
    )
  }

  return (
    <div
      className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans"
      onClick={() => { if (showDropdown) { setSuggestions([]); setShowDropdown(false) } }}
    >
      {/* ── Header ── */}
      <div className="bg-[#1a1a2e] flex items-center justify-between px-3 py-2 shrink-0">
        <button className="text-white p-1" onClick={() => window.location.href = '/play'}>
          <Home size={22} />
        </button>
        <span className="text-white font-bold text-sm tracking-widest uppercase">Nationality Players</span>
        <button className="text-white p-1" onClick={() => setShowProgress(v => !v)}>
          {showProgress ? <X size={20} /> : <Trophy size={20} />}
        </button>
      </div>

      {showProgress ? (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
          <div className="flex-1 overflow-y-auto">
            <OverallProgressScreen
              totalGuessed={totalGuessed}
              totalPlayers={totalPlayers}
              rounds={filteredProgressRounds}
              onRoundClick={i => { setRoundIndex(filteredOriginalIndices[i]); setShowProgress(false) }}
              label="completed"
            />
          </div>
          <div className="shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
            <input
              type="text"
              value={progressSearch}
              onChange={e => setProgressSearch(e.target.value)}
              placeholder="Filter by nationality or club…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              style={{ fontSize: '16px' }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
            {currentRound && (
              <div className="px-3 pt-4 pb-2 flex flex-col gap-3">
                {/* Combo header */}
                <div className="relative bg-white rounded-2xl border border-gray-200 px-4 pt-3 pb-4 flex flex-col items-center gap-3 overflow-hidden">
                  {currentRound.playerCount <= 6 ? (
                    <div className="absolute top-3.5 -right-5.5 rotate-45 bg-red-500 text-white text-[9px] font-bold tracking-wider uppercase px-7 py-0.5 shadow-sm">
                      Solid
                    </div>
                  ) : currentRound.playerCount <= 15 ? (
                    <div className="absolute top-3.5 -right-5.5 rotate-45 bg-amber-400 text-white text-[9px] font-bold tracking-wider uppercase px-7 py-0.5 shadow-sm">
                      Medium
                    </div>
                  ) : (
                    <div className="absolute top-3.5 -right-5.5 rotate-45 bg-green-500 text-white text-[9px] font-bold tracking-wider uppercase px-7 py-0.5 shadow-sm">
                      Easy
                    </div>
                  )}
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-widest">{nationalityAdjective(currentRound.nationality)} {currentRound.club} Players</span>
                  <div className="flex items-center justify-center gap-6">
                    <NationalityBadge nationality={currentRound.nationality} />
                    <span className="text-gray-400 font-bold text-lg">&amp;</span>
                    <ClubBadge name={currentRound.club} wikiUrl={currentRound.clubWikiUrl} />
                  </div>
                </div>

                {/* 5 player slots */}
                {players === null ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-gray-300" size={22} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {foundPlayers.map((player, i) => (
                      <PlayerSlot key={i} index={i} player={player} />
                    ))}
                  </div>
                )}

                {/* Wrong guess flash */}
                {wrongGuessMsg && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600 text-center animate-pulse">
                    {wrongGuessMsg}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Bottom panel ── */}
          {currentRound && (
            <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
              <p className={`text-xs mb-2 ${verifying ? 'text-yellow-400' : guessedCount > 0 ? 'text-green-400' : 'text-white/50'}`}>
                {verifying ? 'Checking…' : isDone ? `All ${TARGET} found! ✓` : `${guessedCount} / ${TARGET} found`}
              </p>

              {!isDone && (
                <div className="relative mb-3">
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
                    disabled={verifying}
                    className="w-full bg-white text-gray-900 rounded-lg px-3 py-2 outline-none disabled:opacity-60"
                    style={{ fontSize: '16px' }}
                  />
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

              {/* Nav row */}
              <div className="relative flex items-center justify-between pt-1">
                <button
                  onClick={() => setRoundIndex(i => Math.max(0, i - 1))}
                  disabled={roundIndex === 0}
                  className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs font-mono">
                  <span><span className="text-white">#{roundIndex + 1}</span><span className="text-white/50">/{rounds.length}</span></span>
                  <button onClick={handleRandom} className="text-white/40 hover:text-white transition-colors">
                    <Shuffle size={13} />
                  </button>
                </div>

                <button
                  onClick={() => setRoundIndex(i => Math.min(rounds.length - 1, i + 1))}
                  disabled={roundIndex === rounds.length - 1}
                  className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
