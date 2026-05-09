import { useState, useEffect, useRef, useCallback } from 'react'
import { Home, Loader2, Check, X, ChevronRight } from 'lucide-react'
import { getFootballers, type Footballer } from '@/api/footballers'
import {
  getTwoClubsSession,
  verifyGuess,
  getTwoClubsAnswers,
  recordPlayedPair,
  type TwoClubsSession,
  type VerifyResult,
} from '@/api/two-clubs'

type GameStatus = 'loading' | 'error' | 'playing' | 'won' | 'given_up'

interface ConfirmedPlayer {
  id: number
  name: string
  photo_url: string | null
}

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
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
        {logoUrl === null
          ? <div className="w-full h-full animate-pulse bg-gray-200" />
          : logoUrl === false
            ? <span className="text-gray-500 font-bold text-xl">{name.charAt(0)}</span>
            : <img src={logoUrl} alt={name} className="w-10 h-10 object-contain" />}
      </div>
      <span className="text-gray-800 font-semibold text-sm text-center leading-tight max-w-25">{name}</span>
    </div>
  )
}

function PlayerSlot({ index, player }: { index: number; player: ConfirmedPlayer | null }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${player ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${player ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
        {index + 1}
      </span>
      {player ? (
        <div className="flex items-center gap-2 min-w-0">
          {player.photo_url && (
            <img src={player.photo_url} alt={player.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
          )}
          <span className="text-sm font-semibold text-gray-800 truncate">{player.name}</span>
        </div>
      ) : (
        <span className="text-sm text-gray-300 italic">?</span>
      )}
    </div>
  )
}

function AnswerReveal({ players, confirmed }: { players: Footballer[]; confirmed: ConfirmedPlayer[] }) {
  const confirmedIds = new Set(confirmed.map(c => c.id))
  return (
    <div className="flex flex-col gap-2">
      {players.map(p => {
        const isFound = confirmedIds.has(p.id)
        return (
          <div key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${isFound ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            {p.photo_url && (
              <img src={p.photo_url} alt={p.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
            )}
            <span className={`text-sm font-semibold truncate ${isFound ? 'text-green-700' : 'text-gray-500'}`}>{p.name}</span>
            {isFound && <span className="ml-auto text-green-500 text-xs shrink-0">✓</span>}
          </div>
        )
      })}
    </div>
  )
}

export function TwoClubsPage() {
  const [status, setStatus] = useState<GameStatus>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [session, setSession] = useState<TwoClubsSession | null>(null)
  const [confirmed, setConfirmed] = useState<ConfirmedPlayer[]>([])
  const [revealedAnswers, setRevealedAnswers] = useState<Footballer[]>([])
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Footballer[]>([])
  const [wikiVerified, setWikiVerified] = useState<Footballer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const wikiSearchRef = useRef<string>('')
  const [verifying, setVerifying] = useState(false)
  const [wrongGuess, setWrongGuess] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const inputRef = useRef<HTMLInputElement>(null)
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const TARGET = 5

  function loadSession() {
    setStatus('loading')
    setConfirmed([])
    setRevealedAnswers([])
    setInputValue('')
    setSuggestions([])
    setWikiVerified([])
    setShowDropdown(false)
    setWrongGuess(null)
    setSelectedId(null)

    getTwoClubsSession()
      .then(s => {
        setSession(s)
        setStatus('playing')
        setTimeout(() => inputRef.current?.focus(), 50)
      })
      .catch(e => {
        setErrorMsg(e instanceof Error ? e.message : 'Failed to load game')
        setStatus('error')
      })
  }

  useEffect(() => { loadSession() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSuggestions = useCallback((term: string, clubA: string, clubB: string) => {
    if (term.length < 2) { setSuggestions([]); setWikiVerified([]); setShowDropdown(false); return }

    getFootballers({ search: term })
      .then(results => {
        setSuggestions(results.slice(0, 8))
        setShowDropdown(true)
      })
      .catch(() => {})

    if (term.length >= 3) {
      const searchTerm = term
      wikiSearchRef.current = searchTerm
      setWikiVerified([])
      ;(async () => {
        try {
          const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term + ' footballer')}&format=json&srlimit=5&origin=*`
          const res = await fetch(url)
          if (!res.ok || wikiSearchRef.current !== searchTerm) return
          const data = await res.json() as { query?: { search?: { title: string }[] } }
          const titles = (data.query?.search ?? []).map((r: { title: string }) => r.title.replace(/ \([^)]+\)$/, ''))

          for (const name of titles) {
            if (wikiSearchRef.current !== searchTerm) return
            const result = await verifyGuess(name, null, clubA, clubB)
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
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    setSelectedId(null)
    wikiSearchRef.current = val
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val, session?.clubA ?? '', session?.clubB ?? ''), 300)
  }

  async function submitGuess(name: string, id: number | null) {
    if (!session || verifying || status !== 'playing') return
    if (confirmed.some(c => c.id === id || c.name.toLowerCase() === name.toLowerCase())) {
      setInputValue('')
      setSuggestions([])
      setWikiVerified([])
      setShowDropdown(false)
      wikiSearchRef.current = ''
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    setInputValue('')
    setSuggestions([])
    setWikiVerified([])
    setShowDropdown(false)
    wikiSearchRef.current = ''
    setVerifying(true)

    let result: VerifyResult
    try {
      result = await verifyGuess(name, id, session.clubA, session.clubB)
    } catch {
      result = { valid: false, footballer: null, imported: false }
    } finally {
      setVerifying(false)
    }

    if (result.valid && result.footballer) {
      const newConfirmed = [...confirmed, { id: result.footballer.id, name: result.footballer.name, photo_url: result.footballer.photo_url }]
      setConfirmed(newConfirmed)
      if (newConfirmed.length >= TARGET) {
        recordPlayedPair(session.clubA, session.clubB)
        setStatus('won')
      }
    } else {
      if (wrongTimer.current) clearTimeout(wrongTimer.current)
      setWrongGuess(name)
      wrongTimer.current = setTimeout(() => setWrongGuess(null), 1500)
    }

    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleSelectSuggestion(footballer: Footballer) {
    setSelectedId(footballer.id)
    submitGuess(footballer.name, footballer.id)
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

  async function handleGiveUp() {
    if (!session) return
    recordPlayedPair(session.clubA, session.clubB)
    try {
      const answers = await getTwoClubsAnswers(session.clubA, session.clubB)
      setRevealedAnswers(answers)
    } catch {
      setRevealedAnswers([])
    }
    setStatus('given_up')
  }

  function handleNext() {
    loadSession()
  }

  const slots = Array.from({ length: Math.max(TARGET, confirmed.length) }, (_, i) => confirmed[i] ?? null)
  const isRoundDone = status === 'won' || status === 'given_up'

  return (
    <div
      className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans"
      onClick={() => { if (showDropdown) { setSuggestions([]); setWikiVerified([]); setShowDropdown(false) } }}
    >
      {/* Header */}
      <div className="bg-[#1a1a2e] flex items-center justify-between px-3 py-2 shrink-0">
        <button className="text-white p-1" onClick={() => window.location.href = '/play'}>
          <Home size={22} />
        </button>
        <span className="text-white font-bold text-sm tracking-widest uppercase">Two Clubs</span>
        <span className="text-white/60 text-sm font-mono w-8 text-right">
          {status === 'playing' ? `${confirmed.length}/${TARGET}` : ''}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-gray-400" size={28} />
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
            <p className="text-red-500 text-sm text-center">{errorMsg}</p>
            <button onClick={loadSession} className="bg-[#1a1a2e] text-white text-sm px-4 py-2 rounded-lg">
              Try again
            </button>
          </div>
        )}

        {/* Session body */}
        {session && status !== 'loading' && status !== 'error' && (
          <div className="px-3 pt-4 pb-2 flex flex-col gap-3">
            {/* Club header — light mode */}
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-4 flex items-center justify-center gap-6">
              <ClubBadge name={session.clubA} wikiUrl={session.clubAWikiUrl} />
              <span className="text-gray-300 font-bold text-lg">×</span>
              <ClubBadge name={session.clubB} wikiUrl={session.clubBWikiUrl} />
            </div>

            {/* Player slots */}
            {(status === 'playing' || status === 'won') && (
              <div className="flex flex-col gap-2">
                {slots.map((player, i) => (
                  <PlayerSlot key={i} index={i} player={player} />
                ))}
              </div>
            )}

            {/* Answer reveal on give up */}
            {status === 'given_up' && revealedAnswers.length > 0 && (
              <AnswerReveal players={revealedAnswers} confirmed={confirmed} />
            )}
            {status === 'given_up' && revealedAnswers.length === 0 && (
              <div className="flex flex-col gap-2">
                {confirmed.map((p, i) => <PlayerSlot key={p.id} index={i} player={p} />)}
              </div>
            )}

            {/* Won message */}
            {status === 'won' && (
              <p className="text-center text-2xl font-bold text-green-500 py-1">You got them all!</p>
            )}

            {/* Wrong guess flash */}
            {wrongGuess && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600 text-center animate-pulse">
                "{wrongGuess}" didn't play for both clubs
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom panel — CIC-style, shown when session loaded */}
      {session && status !== 'loading' && status !== 'error' && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">

          {/* Confirmed player chips + missed chips on give up */}
          {(confirmed.length > 0 || status === 'given_up') && (
            <div className="flex flex-wrap gap-2 mb-3">
              {confirmed.map(p => (
                <span key={p.id} className="flex items-center gap-1 bg-green-500/20 text-green-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <Check size={11} />
                  {p.name}
                </span>
              ))}
              {status === 'given_up' && revealedAnswers
                .filter(p => !confirmed.some(c => c.id === p.id))
                .map(p => (
                  <span key={p.id} className="flex items-center gap-1 bg-red-500/20 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <X size={11} />
                    {p.name}
                  </span>
                ))
              }
            </div>
          )}

          {/* Status text */}
          <p className="text-white/50 text-xs mb-2">
            {status === 'won'
              ? `You got them all! All ${TARGET} players found`
              : status === 'given_up'
                ? `Gave up — ${confirmed.length} / ${revealedAnswers.length > 0 ? revealedAnswers.length : TARGET} found`
                : verifying
                  ? 'Checking…'
                  : `${confirmed.length} / ${TARGET} players found`}
          </p>

          {/* Input — playing only */}
          {status === 'playing' && (
            <div className="relative mb-3">
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
              {showDropdown && (() => {
                const dbIds = new Set(suggestions.map(s => s.id))
                const allItems = [
                  ...suggestions,
                  ...wikiVerified.filter(w => !dbIds.has(w.id)),
                ]
                return allItems.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                    {allItems.map(f => (
                      <button
                        key={f.id}
                        onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(f) }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isRoundDone && (
              <button
                onClick={handleGiveUp}
                disabled={verifying}
                className="flex-1 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                <X size={14} />
                Give Up
              </button>
            )}
            {isRoundDone && (
              <button
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-1 bg-white text-[#1a1a2e] text-sm font-bold py-2 rounded-lg"
              >
                {status === 'won' ? 'Next Round' : 'Play Again'}
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
