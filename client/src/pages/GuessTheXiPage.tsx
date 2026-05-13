import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router";
import { Home, ChevronRight, ChevronLeft, Shuffle, Trophy, X } from "lucide-react";
import { OverallProgressScreen } from "@/components/OverallProgressScreen";
import {
  type XiRoundPlayer,
} from "@/api/guess-the-xi";
import { getXiScheduleRounds, type XiScheduleRound } from "@/api/xi-schedule";
import { getFootballers, type Footballer } from "@/api/footballers";
import {
  submitXiScore,
  getXiLeaderboard,
  type XiLeaderboardEntry,
} from "@/api/xi-leaderboard";

type RoundState = "playing" | "cleared";

interface RoundResult {
  date: string;
  matchId: number;
  matchName: string;
  team: string;
  year: number;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  teamWikipediaUrl: string | null;
  teamImageUrl: string | null;
  isToty: boolean;
  players: XiRoundPlayer[];
  playerNames: string[];
  guessedIndices: Set<number>;
  state: RoundState;
}

const PROGRESS_KEY = "gxi_schedule_progress";

interface SavedProgress {
  [roundKey: string]: {
    guessedIndices: number[];
    state: RoundState;
  };
}

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: SavedProgress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function roundKey(matchId: number, team: string): string {
  return `${matchId}:${team}`;
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

import { nationalityToFlagUrl } from "@/lib/flags";
import { NationalityFlag } from "@/components/NationalityFlag";
import { MiniClubBadge } from "@/components/MiniClubBadge";

const TRANSLITERATE: Record<string, string> = {
  ı: "i", ł: "l", ø: "o", đ: "d", ð: "d",
  æ: "a", œ: "o", ħ: "h", ŋ: "n", ŧ: "t",
  þ: "th", ß: "ss",
};
const TRANSLIT_RE = /[ıłøđðæœħŋŧþß]/g;

function normalizeGuess(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(TRANSLIT_RE, (c) => TRANSLITERATE[c] ?? c)
    .trim();
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
  const g = normalizeGuess(guess);
  const p = normalizeGuess(playerName);
  if (g === p) return true;
  const lastName = p.split(" ").at(-1) ?? "";
  if (lastName.length >= 4 && g === lastName) return true;
  if (lastName.length >= 4 && g.length >= 4 && damerauDistance(g, lastName) === 1) return true;
  return false;
}

function buildRounds(data: XiScheduleRound[], saved: SavedProgress): RoundResult[] {
  return data.map((r) => {
    const key = roundKey(r.matchId, r.team);
    const prog = saved[key];
    return {
      date: r.date,
      matchId: r.matchId,
      matchName: r.matchName,
      team: r.team,
      year: r.year,
      competition: r.competition,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      teamWikipediaUrl: r.teamWikipediaUrl,
      teamImageUrl: r.teamImageUrl,
      isToty: r.isToty,
      players: r.players,
      playerNames: r.playerNames,
      guessedIndices: prog ? new Set(prog.guessedIndices) : new Set<number>(),
      state: prog?.state ?? "playing",
    };
  });
}

export function GuessTheXiPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Footballer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFinalScore, setShowFinalScore] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getXiScheduleRounds()
      .then((data) => {
        const saved = loadProgress();
        const built = buildRounds(data, saved);
        setRounds(built);
        const n = parseInt(searchParams.get("n") ?? "0");
        setRoundIndex(Math.min(Math.max(n, 0), built.length - 1));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load schedule."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !error && rounds.length > 0 && !showFinalScore) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [roundIndex, loading, error, rounds.length, showFinalScore]);

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
    const newState: RoundState = allGuessed ? "cleared" : "playing";

    const updated = [...rounds];
    updated[roundIndex] = { ...round, guessedIndices: newGuessed, state: newState };
    setRounds(updated);

    const progress = loadProgress();
    progress[roundKey(round.matchId, round.team)] = {
      guessedIndices: [...newGuessed],
      state: newState,
    };
    saveProgress(progress);

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

  function goToRound(index: number) {
    if (index < 0 || index >= rounds.length) return;
    setRoundIndex(index);
    setSearchParams({ n: String(index) }, { replace: true });
    setInputValue("");
    setSuggestions([]);
    setShowDropdown(false);
  }

  function handlePrevious() {
    goToRound(roundIndex - 1);
  }

  function handleRandom() {
    if (rounds.length <= 1) return;
    let idx: number;
    do { idx = Math.floor(Math.random() * rounds.length) } while (idx === roundIndex);
    goToRound(idx);
  }

  function handleNext() {
    if (roundIndex < rounds.length - 1) {
      goToRound(roundIndex + 1);
    }
  }

  function handleSeeResults() {
    setShowFinalScore(true);
  }

  const currentRound = rounds[roundIndex] ?? null;
  const isRoundDone = currentRound?.state === "cleared";
  const isLastRound = roundIndex === rounds.length - 1;
  const allCleared = rounds.length > 0 && rounds.every((r) => r.state === "cleared");
  const totalGuessed = rounds.reduce((sum, r) => sum + r.guessedIndices.size, 0);
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
      <div className="bg-[#1a1a2e] relative flex items-center justify-between px-3 py-2 shrink-0">
        <button
          className="text-white p-1"
          onClick={() => (window.location.href = "/play")}
        >
          <Home size={22} />
        </button>
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-bold text-sm tracking-widest uppercase">
          Guess The XI
        </span>
        {rounds.length > 0 ? (
          showProgress ? (
            <button
              onClick={() => setShowProgress(false)}
              className="text-white/60 hover:text-white transition-colors p-1"
            >
              <X size={18} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm font-mono">
                {roundIndex + 1} / {rounds.length}
              </span>
              <button
                onClick={() => setShowProgress(true)}
                className="text-white/40 hover:text-white/80 transition-colors p-0.5"
              >
                <Trophy size={14} />
              </button>
            </div>
          )
        ) : (
          <span className="w-8" />
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Loading schedule…
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <p className="text-red-500 text-sm text-center">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#1a1a2e] text-white text-sm px-4 py-2 rounded-lg"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && rounds.length === 0 && (
          <div className="flex items-center justify-center h-full px-6">
            <p className="text-gray-500 text-sm text-center">No rounds scheduled yet — check back soon.</p>
          </div>
        )}

        {!loading && !error && showFinalScore && (
          <FinalScore
            rounds={rounds}
            totalGuessed={totalGuessed}
            totalPlayers={totalPlayers}
            onBack={() => setShowFinalScore(false)}
          />
        )}

        {!loading && !error && !showFinalScore && showProgress && (
          <OverallProgressScreen
            totalGuessed={totalGuessed}
            totalPlayers={totalPlayers}
            rounds={rounds.map((r) => ({
              name: `${r.year} ${r.competition}${/final/i.test(r.matchName) ? ' Final' : ''}`,
              subtitle: r.team,
              guessed: r.guessedIndices.size,
              total: r.players.length,
            }))}
            onRoundClick={(i) => { goToRound(i); setShowProgress(false); }}
          />
        )}

        {!loading && !error && !showFinalScore && !showProgress && currentRound && (
          <div className="px-3 pt-4 pb-2">
            {/* Match header card */}
            <div className="mb-3 flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-3 py-3">
              <ClubBadge
                name={currentRound.team}
                imageUrl={currentRound.teamImageUrl}
                wikipediaUrl={currentRound.teamWikipediaUrl}
              />
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-widest leading-tight truncate">
                  {abbreviateCompetition(currentRound.competition)}{" "}
                  {currentRound.year}
                </p>
                <p className="text-base font-bold text-gray-900 leading-snug truncate">
                  {currentRound.team}{" "}
                  {currentRound.awayTeam && (
                    <span className="text-xs text-gray-400 font-normal ml-1">
                      vs{" "}
                      {currentRound.homeTeam === currentRound.team
                        ? currentRound.awayTeam
                        : currentRound.homeTeam}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Player list */}
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
              {currentRound.players.map((player, i) => {
                const guessed = currentRound.guessedIndices.has(i);
                const name = currentRound.playerNames[i];

                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 px-3 h-8 border-b border-gray-100 last:border-0"
                  >
                    {currentRound.isToty ? (
                      <>
                        <span className="w-5 shrink-0 flex items-center justify-center">
                          {player.clubAtTime && (
                            <MiniClubBadge
                              club={player.clubAtTime}
                              wikipediaUrl={player.clubAtTimeWikipediaUrl ?? null}
                            />
                          )}
                        </span>
                        <span
                          className={`text-xs font-semibold w-7 text-center py-0.5 rounded shrink-0 ${POSITION_COLORS[player.position] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {player.position}
                        </span>
                        <span className="w-4 shrink-0 flex items-center justify-center">
                          <NationalityFlag nationality={player.nationality} className="w-4 h-3.5 object-cover border border-[#ebebeb]" />
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-400 text-xs tabular-nums w-5 text-right shrink-0">
                          {player.squadNumber ?? "—"}
                        </span>
                        <span
                          className={`text-xs font-semibold w-7 text-center py-0.5 rounded shrink-0 ${POSITION_COLORS[player.position] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {player.position}
                        </span>
                        <span className="w-4 shrink-0 flex items-center justify-center">
                          {!nationalityToFlagUrl(currentRound.team)
                            ? <NationalityFlag nationality={player.nationality} className="w-4 h-3.5 object-cover border border-[#ebebeb]" />
                            : player.clubAtTime && (
                                <MiniClubBadge
                                  club={player.clubAtTime}
                                  wikipediaUrl={player.clubAtTimeWikipediaUrl ?? null}
                                />
                              )}
                        </span>
                      </>
                    )}
                    {guessed ? (
                      <span className="text-green-600 font-semibold text-sm flex-1">{name}</span>
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
      {!loading && !error && !showFinalScore && !showProgress && rounds.length > 0 && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
          {/* Progress text */}
          {currentRound && (
            <p className={`text-xs mb-2 ${currentRound.guessedIndices.size > 0 ? "text-green-400" : "text-white/50"}`}>
              {isRoundDone
                ? `All 11 guessed! ✓`
                : `${currentRound.guessedIndices.size} / 11 guessed`}
            </p>
          )}

          {/* Input */}
          {currentRound && !isRoundDone && (
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

          {/* Nav row */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handlePrevious}
              disabled={roundIndex === 0}
              className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <div className="flex items-center gap-2 text-white/60 text-xs font-mono">
              <span>#{roundIndex + 1}</span>
              <button onClick={handleRandom} className="text-white/40 hover:text-white transition-colors">
                <Shuffle size={13} />
              </button>
            </div>

            {isRoundDone && isLastRound && allCleared ? (
              <button
                onClick={handleSeeResults}
                className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide"
              >
                Results
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={roundIndex === rounds.length - 1}
                className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
              >
                Next
                <ChevronRight size={16} />
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
  imageUrl = null,
  wikipediaUrl,
}: {
  name: string;
  imageUrl?: string | null;
  wikipediaUrl: string | null;
}) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null);
  const flagUrl = nationalityToFlagUrl(name);

  useEffect(() => {
    if (imageUrl || flagUrl) return;
    if (!wikipediaUrl) { setLogoUrl(false); return; }
    const title = wikipediaUrl.split("/wiki/")[1];
    if (!title) { setLogoUrl(false); return; }
    const controller = new AbortController();
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => setLogoUrl(data?.thumbnail?.source ?? false))
      .catch((err) => { if (err.name !== "AbortError") setLogoUrl(false); });
    return () => controller.abort();
  }, [wikipediaUrl, flagUrl, imageUrl]);

  return (
    <div
      className="w-12 h-12 bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden"
      style={{ borderRadius: "12px" }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-10 h-10 object-contain" style={{ borderRadius: "12px" }} />
      ) : flagUrl ? (
        <div className="w-9 h-9 rounded-md overflow-hidden shrink-0">
          <img src={flagUrl} alt={name} className="w-full h-full object-cover" />
        </div>
      ) : logoUrl === null ? (
        <div className="w-full h-full bg-gray-200 animate-pulse" style={{ borderRadius: "12px" }} />
      ) : logoUrl === false ? (
        <span className="text-gray-400 font-bold text-sm">{name.charAt(0)}</span>
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
  onBack,
}: {
  rounds: RoundResult[];
  totalGuessed: number;
  totalPlayers: number;
  onBack: () => void;
}) {
  const pct = totalPlayers > 0 ? Math.round((totalGuessed / totalPlayers) * 100) : 0;
  const pctColor =
    pct >= 80 ? "text-green-500" : pct >= 50 ? "text-orange-400" : "text-red-500";
  const allCleared = rounds.every((r) => r.state === "cleared");

  const [tab, setTab] = useState<"score" | "leaderboard">("score");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<XiLeaderboardEntry[] | null>(null);
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
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Final Score</p>
        <p className={`text-5xl font-bold mt-2 ${pctColor}`}>{pct}%</p>
        <p className="text-gray-500 text-sm mt-2">{totalGuessed} / {totalPlayers} players</p>
      </div>

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
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {r.homeTeam}{r.awayTeam ? ` vs ${r.awayTeam}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">{r.team} XI</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${guessedCount === total ? "text-green-600" : guessedCount > 0 ? "text-orange-500" : "text-red-500"}`}>
                    {guessedCount}/{total}
                  </span>
                  <span className="text-base">{cleared ? "✓" : guessedCount > 0 ? "~" : "✗"}</span>
                </div>
              );
            })}
          </div>

          {allCleared && (
            <div className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
              <p className="text-xs text-gray-400 uppercase tracking-widest text-center">
                Perfect score — enter the leaderboard
              </p>
              {submitted ? (
                <p className="text-sm text-green-600 font-semibold text-center">✓ Score saved!</p>
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
                  {submitError && <p className="text-xs text-red-500">{submitError}</p>}
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
            <p className="text-sm text-red-500 text-center">Failed to load leaderboard.</p>
          )}
          {leaderboard === null && !leaderboardError && (
            <p className="text-sm text-gray-400 text-center">Loading…</p>
          )}
          {leaderboard && leaderboard.length === 0 && (
            <p className="text-sm text-gray-400 text-center">No scores yet. Be the first!</p>
          )}
          {leaderboard && leaderboard.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
              <span className="text-xs font-bold text-gray-400 w-5 tabular-nums">{i + 1}</span>
              <span className="flex-1 text-sm font-semibold text-gray-900 truncate">{entry.player_name}</span>
              <span className="text-sm font-bold tabular-nums text-green-600">{entry.score}/{entry.total}</span>
              <span className="text-xs text-gray-400 tabular-nums">
                {Math.round((entry.score / entry.total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onBack}
        className="bg-[#1a1a2e] text-white font-bold px-8 py-3 rounded-xl w-full text-sm"
      >
        Back to Game
      </button>
    </div>
  );
}
