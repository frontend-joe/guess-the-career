import { useState, useEffect, useRef, useCallback } from "react";
import { Home, ChevronRight, X } from "lucide-react";
import {
  getXiSession,
  type XiRound,
  type XiRoundPlayer,
} from "@/api/guess-the-xi";
import { getFootballers, type Footballer } from "@/api/footballers";
import {
  submitXiScore,
  getXiLeaderboard,
  type XiLeaderboardEntry,
} from "@/api/xi-leaderboard";

type RoundState = "playing" | "cleared" | "given_up";

interface RoundResult {
  matchId: number;
  matchName: string;
  team: string;
  year: number;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  teamWikipediaUrl: string | null;
  players: XiRoundPlayer[];
  playerNames: string[];
  guessedIndices: Set<number>;
  state: RoundState;
}

const COMPETITION_ABBR: Record<string, string> = {
  "UEFA Champions League": "Champions League",
  "UEFA Europa League": "Europa League",
  "UEFA Cup": "UEFA Cup",
  "UEFA Conference League": "Conference League",
  "FIFA World Cup": "World Cup",
  "UEFA European Championship": "Euro",
  "FA Cup": "FA Cup",
  "Premier League": "PL",
  "La Liga": "La Liga",
  "Serie A": "Serie A",
  Bundesliga: "Bundesliga",
  "Ligue 1": "Ligue 1",
};

function abbreviateCompetition(competition: string): string {
  return COMPETITION_ABBR[competition] ?? competition;
}

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-purple-100 text-purple-700",
  DF: "bg-blue-100 text-blue-700",
  MF: "bg-green-100 text-green-700",
  FW: "bg-orange-100 text-orange-700",
};

import { nationalityToFlagUrl } from '@/lib/flags'

function normalizeGuess(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function matchesPlayer(guess: string, playerName: string): boolean {
  const g = normalizeGuess(guess);
  const p = normalizeGuess(playerName);
  if (g === p) return true;
  // Last-name-only match (min 4 chars to avoid false positives on short particles)
  const lastName = p.split(" ").at(-1) ?? "";
  return lastName.length >= 4 && g === lastName;
}

export function GuessTheXiPage() {
  const [difficulty, setDifficulty] = useState<'easy' | 'hard' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Footballer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFinalScore, setShowFinalScore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function buildRounds(data: XiRound[]): RoundResult[] {
    return data.map((r) => ({
      matchId: r.matchId,
      matchName: r.matchName,
      team: r.team,
      year: r.year,
      competition: r.competition,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      teamWikipediaUrl: r.teamWikipediaUrl,
      players: r.players,
      playerNames: r.playerNames,
      guessedIndices: new Set<number>(),
      state: "playing" as RoundState,
    }));
  }

  function loadSession() {
    setLoading(true);
    setError(null);
    setRoundIndex(0);
    setRounds([]);
    setInputValue("");
    setSuggestions([]);
    setShowDropdown(false);
    setShowFinalScore(false);
    getXiSession()
      .then((data) => setRounds(buildRounds(data)))
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load session. Please try again.",
        ),
      )
      .finally(() => setLoading(false));
  }

  function startGame(d: 'easy' | 'hard') {
    setDifficulty(d);
    loadSession();
  }

  function handlePlayAgain() {
    setDifficulty(null);
    setRounds([]);
    setRoundIndex(0);
    setShowFinalScore(false);
  }

  useEffect(() => {
    if (difficulty && !loading && !error && !showFinalScore) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [difficulty, roundIndex, loading, error, showFinalScore]);

  const fetchSuggestions = useCallback((term: string) => {
    if (term.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    getFootballers({ search: term })
      .then((results) => {
        setSuggestions(results.slice(0, 8));
        setShowDropdown(results.length > 0);
      })
      .catch(() => {});
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 200);
  }

  function handleGuess(name: string) {
    const round = rounds[roundIndex];
    if (!round || round.state !== "playing") return;

    setInputValue("");
    setSuggestions([]);
    setShowDropdown(false);

    const matched: number[] = [];
    round.playerNames.forEach((pName, i) => {
      if (!round.guessedIndices.has(i) && matchesPlayer(name, pName)) {
        matched.push(i);
      }
    });

    if (matched.length === 0) {
      inputRef.current?.focus();
      return;
    }

    const newGuessed = new Set(round.guessedIndices);
    matched.forEach((i) => newGuessed.add(i));
    const allGuessed = newGuessed.size === round.players.length;
    const updated = [...rounds];
    updated[roundIndex] = {
      ...round,
      guessedIndices: newGuessed,
      state: allGuessed ? "cleared" : "playing",
    };
    setRounds(updated);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && inputValue.trim()) {
      handleGuess(inputValue.trim());
    }
    if (e.key === "Escape") {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }

  function handleGiveUp() {
    const round = rounds[roundIndex];
    if (!round || round.state !== "playing") return;
    const updated = [...rounds];
    updated[roundIndex] = { ...round, state: "given_up" };
    setRounds(updated);
  }

  function handleNextRound() {
    if (roundIndex < rounds.length - 1) {
      setRoundIndex((i) => i + 1);
      setInputValue("");
      setSuggestions([]);
      setShowDropdown(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const currentRound = rounds[roundIndex] ?? null;
  const isRoundDone = currentRound?.state !== "playing";
  const isLastRound = roundIndex === rounds.length - 1;
  const totalGuessed = rounds.reduce(
    (sum, r) => sum + r.guessedIndices.size,
    0,
  );
  const totalPlayers = rounds.reduce((sum, r) => sum + r.players.length, 0);

  return (
    <div
      className="h-dvh flex flex-col w-full max-w-[400px] mx-auto font-sans"
      onClick={() => {
        if (showDropdown) {
          setSuggestions([]);
          setShowDropdown(false);
        }
      }}
    >
      {/* Header */}
      <div className="bg-[#1a1a2e] flex items-center justify-between px-3 py-2 shrink-0">
        <button
          className="text-white p-1"
          onClick={() => (window.location.href = "/play")}
        >
          <Home size={22} />
        </button>
        <span className="text-white font-bold text-sm tracking-widest uppercase">
          Guess The XI
        </span>
        {rounds.length > 0 ? (
          <span className="text-white/60 text-sm font-mono">
            {roundIndex + 1} / {rounds.length}
          </span>
        ) : (
          <span className="w-8" />
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {!difficulty && (
          <div className="flex flex-col items-center justify-center flex-1 px-6 gap-6">
            <h2 className="text-2xl font-bold text-gray-900">Choose difficulty</h2>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => startGame('easy')}
                className="flex flex-col items-center gap-0.5 bg-white border-2 border-green-400 rounded-xl px-4 py-5 hover:bg-green-50 transition-colors"
              >
                <span className="font-bold text-lg text-gray-900 tracking-wide">EASY</span>
                <span className="text-xs text-gray-400">Nationality flags shown</span>
              </button>
              <button
                onClick={() => startGame('hard')}
                className="flex flex-col items-center gap-0.5 bg-white border-2 border-red-400 rounded-xl px-4 py-5 hover:bg-red-50 transition-colors"
              >
                <span className="font-bold text-lg text-gray-900 tracking-wide">HARD</span>
                <span className="text-xs text-gray-400">No flags</span>
              </button>
            </div>
          </div>
        )}

        {difficulty && loading && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Loading session…
          </div>
        )}

        {difficulty && error && (
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
            totalGuessed={totalGuessed}
            totalPlayers={totalPlayers}
            onPlayAgain={handlePlayAgain}
          />
        )}

        {!loading && !error && !showFinalScore && currentRound && (
          <div className="px-3 pt-4 pb-2">
            {/* Match header card */}
            <div className="mb-3 flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-3 py-3">
              <ClubBadge
                name={currentRound.team}
                wikipediaUrl={currentRound.teamWikipediaUrl}
              />
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-widest leading-tight truncate">
                  {abbreviateCompetition(currentRound.competition)} Final{" "}
                  {currentRound.year}
                </p>
                <p className="text-base font-bold text-gray-900 leading-snug truncate">
                  {currentRound.team} XI{" "}
                  <span className="text-xs text-gray-400 font-normal ml-1.5">
                    vs{" "}
                    {currentRound.homeTeam === currentRound.team
                      ? currentRound.awayTeam
                      : currentRound.homeTeam}
                  </span>
                </p>
              </div>
            </div>

            {/* Player list */}
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
              {currentRound.players.map((player, i) => {
                const guessed = currentRound.guessedIndices.has(i);
                const revealed = currentRound.state === "given_up" && !guessed;
                const name = currentRound.playerNames[i];

                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 px-3 h-8 border-b border-gray-100 last:border-0"
                  >
                    {/* Squad number */}
                    <span className="text-gray-400 text-xs tabular-nums w-5 text-right shrink-0">
                      {player.squadNumber ?? "—"}
                    </span>

                    {/* Position badge */}
                    <span
                      className={`text-xs font-semibold w-7 text-center py-0.5 rounded shrink-0 ${POSITION_COLORS[player.position] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {player.position}
                    </span>

                    {/* Flag (easy mode only) */}
                    {difficulty === 'easy' && (
                      <span className="w-5 shrink-0 flex items-center">
                        {!nationalityToFlagUrl(currentRound.team) &&
                          nationalityToFlagUrl(player.nationality) && (
                            <img src={nationalityToFlagUrl(player.nationality)!} alt={player.nationality ?? ''} className="h-3.5 w-auto border border-[#ebebeb]" />
                          )}
                      </span>
                    )}

                    {/* Player name or placeholder */}
                    {guessed ? (
                      <span className="text-green-600 font-semibold text-sm flex-1">{name}</span>
                    ) : revealed ? (
                      <span className="text-red-500 font-medium text-sm flex-1">{name}</span>
                    ) : (
                      <div className="flex-1 h-px bg-gray-300 rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      {!loading && !error && !showFinalScore && currentRound && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
          {/* Progress text */}
          <p
            className={`text-xs mb-2 ${currentRound.guessedIndices.size > 0 ? "text-green-400" : "text-white/50"}`}
          >
            {isRoundDone
              ? currentRound.state === "cleared"
                ? `All 11 guessed! ✓`
                : `${currentRound.guessedIndices.size} / 11 guessed`
              : `${currentRound.guessedIndices.size} / 11 guessed`}
          </p>

          {/* Input with footballer autocomplete */}
          {!isRoundDone && (
            <div className="relative mb-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a player name…"
                className="w-full bg-white text-gray-900 rounded-lg px-3 py-2 outline-none"
                style={{ fontSize: "16px" }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleGuess(s.name);
                      }}
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
  );
}

function ClubBadge({
  name,
  wikipediaUrl,
}: {
  name: string;
  wikipediaUrl: string | null;
}) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null);

  const flagUrl = nationalityToFlagUrl(name);

  useEffect(() => {
    if (flagUrl) return;
    if (!wikipediaUrl) {
      setLogoUrl(false);
      return;
    }
    const title = wikipediaUrl.split("/wiki/")[1];
    if (!title) {
      setLogoUrl(false);
      return;
    }
    const controller = new AbortController();
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => setLogoUrl(data?.thumbnail?.source ?? false))
      .catch((err) => {
        if (err.name !== "AbortError") setLogoUrl(false);
      });
    return () => controller.abort();
  }, [wikipediaUrl, flagUrl]);

  return (
    <div
      className="w-12 h-12 bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden"
      style={{ borderRadius: "12px" }}
    >
      {flagUrl ? (
        <img src={flagUrl} alt={name} className="w-full h-full object-cover" />
      ) : logoUrl === null ? (
        <div
          className="w-full h-full bg-gray-200 animate-pulse"
          style={{ borderRadius: "12px" }}
        />
      ) : logoUrl === false ? (
        <span className="text-gray-400 font-bold text-sm">
          {name.charAt(0)}
        </span>
      ) : (
        <img src={logoUrl} alt={name} className="w-10 h-10 object-contain" />
      )}
    </div>
  );
}

function FinalScore({
  rounds,
  totalGuessed,
  totalPlayers,
  onPlayAgain,
}: {
  rounds: RoundResult[];
  totalGuessed: number;
  totalPlayers: number;
  onPlayAgain: () => void;
}) {
  const pct =
    totalPlayers > 0 ? Math.round((totalGuessed / totalPlayers) * 100) : 0;
  const pctColor =
    pct >= 80
      ? "text-green-500"
      : pct >= 50
        ? "text-orange-400"
        : "text-red-500";
  const qualifies = pct >= 75;

  const [tab, setTab] = useState<"score" | "leaderboard">("score");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<XiLeaderboardEntry[] | null>(
    null,
  );
  const [leaderboardError, setLeaderboardError] = useState(false);

  useEffect(() => {
    if (tab === "leaderboard" && leaderboard === null) {
      getXiLeaderboard()
        .then(setLeaderboard)
        .catch(() => setLeaderboardError(true));
    }
  }, [tab, leaderboard]);

  async function handleSubmit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitXiScore(name.trim(), totalGuessed, totalPlayers);
      setSubmitted(true);
      setLeaderboard(null);
    } catch {
      setSubmitError("Failed to save score. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-6">
      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
          Final Score
        </p>
        <p className={`text-5xl font-bold mt-2 ${pctColor}`}>{pct}%</p>
        <p className="text-gray-500 text-sm mt-2">
          {totalGuessed} / {totalPlayers} players
        </p>
      </div>

      {/* Tabs */}
      <div className="flex w-full rounded-xl overflow-hidden border border-gray-200">
        <button
          onClick={() => setTab("score")}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === "score" ? "bg-[#1a1a2e] text-white" : "bg-white text-gray-500"}`}
        >
          Results
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === "leaderboard" ? "bg-[#1a1a2e] text-white" : "bg-white text-gray-500"}`}
        >
          Leaderboard
        </button>
      </div>

      {tab === "score" && (
        <>
          <div className="w-full flex flex-col gap-2">
            {rounds.map((r, i) => {
              const guessedCount = r.guessedIndices.size;
              const total = r.players.length;
              const cleared = r.state === "cleared";
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {r.homeTeam} vs {r.awayTeam}
                    </p>
                    <p className="text-xs text-gray-500">{r.team} XI</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-bold tabular-nums ${guessedCount === total ? "text-green-600" : guessedCount > 0 ? "text-orange-500" : "text-red-500"}`}
                    >
                      {guessedCount}/{total}
                    </span>
                  </div>
                  <span className="text-base">
                    {cleared ? "✓" : guessedCount > 0 ? "~" : "✗"}
                  </span>
                </div>
              );
            })}
          </div>

          {qualifies && (
            <div className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
              <p className="text-xs text-gray-400 uppercase tracking-widest text-center">
                You qualify for the leaderboard
              </p>
              {submitted ? (
                <p className="text-sm text-green-600 font-semibold text-center">
                  ✓ Score saved!
                </p>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    maxLength={50}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                  />
                  {submitError && (
                    <p className="text-xs text-red-500">{submitError}</p>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={!name.trim() || submitting}
                    className="w-full bg-[#1a1a2e] text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-40"
                  >
                    {submitting ? "Saving…" : "Submit to Leaderboard"}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {tab === "leaderboard" && (
        <div className="w-full flex flex-col gap-2">
          {leaderboardError && (
            <p className="text-sm text-red-500 text-center">
              Failed to load leaderboard.
            </p>
          )}
          {leaderboard === null && !leaderboardError && (
            <p className="text-sm text-gray-400 text-center">Loading…</p>
          )}
          {leaderboard && leaderboard.length === 0 && (
            <p className="text-sm text-gray-400 text-center">
              No scores yet. Be the first!
            </p>
          )}
          {leaderboard &&
            leaderboard.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100"
              >
                <span className="text-xs font-bold text-gray-400 w-5 tabular-nums">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-semibold text-gray-900 truncate">
                  {entry.player_name}
                </span>
                <span className="text-sm font-bold tabular-nums text-green-600">
                  {entry.score}/{entry.total}
                </span>
                <span className="text-xs text-gray-400 tabular-nums">
                  {Math.round((entry.score / entry.total) * 100)}%
                </span>
              </div>
            ))}
        </div>
      )}

      <button
        onClick={onPlayAgain}
        className="bg-[#1a1a2e] text-white font-bold px-8 py-3 rounded-xl w-full text-sm"
      >
        Play Again
      </button>
    </div>
  );
}
