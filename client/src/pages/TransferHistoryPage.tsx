import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { ChevronRight, ChevronLeft, Shuffle, Trophy, X, ArrowRight } from "lucide-react";
import { GameMenu } from "@/components/GameMenu";
import { OverallProgressScreen } from "@/components/OverallProgressScreen";
import { GuessSearchInput } from "@/components/GuessSearchInput";
import { NationalityFlag } from "@/components/NationalityFlag";
import { MiniClubBadge } from "@/components/MiniClubBadge";
import { PositionBadge } from "@/components/PositionBadge";
import {
  getTransferHistoryRounds,
  type TransferScheduleRound,
  type TransferRoundPlayer,
} from "@/api/transfer-history-schedule";

type RoundState = "playing" | "cleared";

interface RoundResult {
  date: string;
  windowId: number;
  league: string;
  seasonLabel: string;
  transfers: TransferRoundPlayer[];
  playerNames: string[];
  guessedIndices: Set<number>;
  wrongGuesses: Set<string>;
  state: RoundState;
}

const PROGRESS_KEY = "transfer_history_schedule_progress";

interface SavedProgress {
  [roundKey: string]: {
    guessedIndices: number[];
    wrongGuesses?: string[];
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

function roundKey(windowId: number): string {
  return String(windowId);
}

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
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
    }
  }
  return dp[m][n];
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

function buildRounds(data: TransferScheduleRound[], saved: SavedProgress): RoundResult[] {
  return data.map((r) => {
    const prog = saved[roundKey(r.windowId)];
    return {
      date: r.date,
      windowId: r.windowId,
      league: r.league,
      seasonLabel: r.seasonLabel,
      transfers: r.transfers,
      playerNames: r.playerNames,
      // Clamp saved indices to the current transfer list (now top 10) so old
      // progress from when full windows were shown doesn't inflate counts.
      guessedIndices: prog ? new Set(prog.guessedIndices.filter((i) => i < r.transfers.length)) : new Set<number>(),
      wrongGuesses: new Set(prog?.wrongGuesses ?? []),
      state: prog?.state ?? "playing",
    };
  });
}

export function TransferHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [showFinalScore, setShowFinalScore] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getTransferHistoryRounds()
      .then((data) => {
        const built = buildRounds(data, loadProgress());
        setRounds(built);
        const n = parseInt(searchParams.get("n") ?? "0");
        setRoundIndex(Math.min(Math.max(n, 0), Math.max(built.length - 1, 0)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load schedule."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !error && rounds.length > 0 && !showFinalScore) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [roundIndex, loading, error, rounds.length, showFinalScore]);

  function persist(round: RoundResult, guessed: Set<number>, wrong: Set<string>, state: RoundState) {
    const progress = loadProgress();
    progress[roundKey(round.windowId)] = {
      guessedIndices: [...guessed],
      wrongGuesses: [...wrong],
      state,
    };
    saveProgress(progress);
  }

  function handleGuess(name: string) {
    const round = rounds[roundIndex];
    if (!round || round.state !== "playing") return;

    const matched: number[] = [];
    round.playerNames.forEach((pName, i) => {
      if (!round.guessedIndices.has(i) && matchesPlayer(name, pName)) matched.push(i);
    });

    if (matched.length === 0) {
      const newWrong = new Set(round.wrongGuesses);
      newWrong.add(normalizeGuess(name));
      const updated = [...rounds];
      updated[roundIndex] = { ...round, wrongGuesses: newWrong };
      setRounds(updated);
      persist(round, round.guessedIndices, newWrong, round.state);
      return;
    }

    const newGuessed = new Set(round.guessedIndices);
    matched.forEach((i) => newGuessed.add(i));
    const allGuessed = newGuessed.size === round.transfers.length;
    const newState: RoundState = allGuessed ? "cleared" : "playing";

    const updated = [...rounds];
    updated[roundIndex] = { ...round, guessedIndices: newGuessed, state: newState };
    setRounds(updated);
    persist(round, newGuessed, round.wrongGuesses, newState);
  }

  function guessStatus(round: RoundResult, s: { name: string }) {
    if (round.playerNames.some((pn, i) => round.guessedIndices.has(i) && matchesPlayer(s.name, pn)))
      return "correct" as const;
    if (round.wrongGuesses.has(normalizeGuess(s.name))) return "incorrect" as const;
    return null;
  }

  function goToRound(index: number) {
    if (index < 0 || index >= rounds.length) return;
    setRoundIndex(index);
    setSearchParams({ n: String(index) }, { replace: true });
  }

  const currentRound = rounds[roundIndex] ?? null;
  const isRoundDone = currentRound?.state === "cleared";
  const isLastRound = roundIndex === rounds.length - 1;
  const allCleared = rounds.length > 0 && rounds.every((r) => r.state === "cleared");
  const totalGuessed = rounds.reduce((sum, r) => sum + r.guessedIndices.size, 0);
  const totalPlayers = rounds.reduce((sum, r) => sum + r.transfers.length, 0);
  const roundTotal = currentRound?.transfers.length ?? 0;

  return (
    <div className="h-dvh flex flex-col w-full max-w-[400px] mx-auto font-sans">
      {/* Header */}
      <div className="bg-[#0b0c1a] divide-soft-b relative flex items-center justify-between px-3 py-2.5 shrink-0">
        <GameMenu />
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-display text-sm tracking-wide uppercase">
          Transfer History
        </span>
        {rounds.length > 0 ? (
          showProgress ? (
            <button onClick={() => setShowProgress(false)} className="text-white/60 hover:text-white transition-colors p-1">
              <X size={18} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm font-mono">{roundIndex + 1} / {rounds.length}</span>
              <button onClick={() => setShowProgress(true)} className="text-white/40 hover:text-white/80 transition-colors p-0.5">
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
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">Loading schedule…</div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <p className="text-red-500 text-sm text-center">{error}</p>
            <button onClick={() => window.location.reload()} className="bg-[#1a1a2e] text-white text-sm px-4 py-2 rounded-lg">
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
          <FinalScore rounds={rounds} totalGuessed={totalGuessed} totalPlayers={totalPlayers} onBack={() => setShowFinalScore(false)} />
        )}

        {!loading && !error && !showFinalScore && showProgress && (
          <OverallProgressScreen
            totalGuessed={totalGuessed}
            totalPlayers={totalPlayers}
            label="guessed"
            rounds={rounds.map((r) => ({
              name: `${r.league} ${r.seasonLabel}`,
              subtitle: `${r.transfers.length} transfers`,
              guessed: r.guessedIndices.size,
              total: r.transfers.length,
            }))}
            onRoundClick={(i) => { goToRound(i); setShowProgress(false); }}
          />
        )}

        {!loading && !error && !showFinalScore && !showProgress && currentRound && (
          <div className="px-3 pt-4 pb-2">
            {/* Window header */}
            <div className="mb-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-400 uppercase tracking-widest leading-tight">{currentRound.seasonLabel} transfers</p>
              <p className="text-base font-bold text-gray-900 leading-snug">{currentRound.league}</p>
            </div>

            {/* Transfer list */}
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
              {currentRound.transfers.map((t, i) => {
                const guessed = currentRound.guessedIndices.has(i);
                const name = currentRound.playerNames[i];
                return (
                  <div key={t.id} className="flex items-center gap-2 px-2.5 py-2 border-b border-gray-100 last:border-0">
                    <span className="w-4 shrink-0 flex items-center justify-center">
                      <NationalityFlag nationality={t.nationality} className="w-4 h-3.5 object-cover border border-[#ebebeb]" />
                    </span>

                    <PositionBadge position={t.position} className="text-xs font-semibold w-7 text-center py-0.5" />

                    <div className="flex-1 min-w-0">
                      {guessed ? (
                        <span className="text-gray-900 font-semibold text-sm truncate block">{name}</span>
                      ) : (
                        <div className="h-px bg-gray-300 rounded-full" />
                      )}
                    </div>

                    {/* From → To clubs (persistent hint), right-aligned by the fee */}
                    <span className="flex items-center gap-1 shrink-0">
                      <MiniClubBadge club={t.fromClub} wikipediaUrl={t.fromClubWikipediaUrl} size={16} />
                      <ArrowRight size={15} strokeWidth={2.75} className="text-gray-500 shrink-0" />
                      <MiniClubBadge club={t.toClub} wikipediaUrl={t.toClubWikipediaUrl} size={16} />
                    </span>

                    <span className="text-[11px] tabular-nums text-gray-500 shrink-0 w-14 text-right">{t.feeText}</span>
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
          {currentRound && (
            <p className={`text-xs mb-2 ${currentRound.guessedIndices.size > 0 ? "text-green-400" : "text-white/50"}`}>
              {isRoundDone ? `All ${roundTotal} guessed! ✓` : `${currentRound.guessedIndices.size} / ${roundTotal} guessed`}
            </p>
          )}

          {currentRound && !isRoundDone && (
            <div className="mb-3">
              <GuessSearchInput
                key={roundKey(currentRound.windowId)}
                inputRef={inputRef}
                getKey={(f) => f.id}
                getLabel={(f) => f.name}
                getStatus={(f) => guessStatus(currentRound, f)}
                onSelect={(name) => handleGuess(name)}
              />
            </div>
          )}

          <div className="relative flex items-center justify-between pt-1">
            <button
              onClick={() => goToRound(roundIndex - 1)}
              disabled={roundIndex === 0}
              className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 text-white/60 text-xs font-mono">
              <span>#{roundIndex + 1}</span>
              <button
                onClick={() => {
                  if (rounds.length <= 1) return;
                  let idx: number;
                  do { idx = Math.floor(Math.random() * rounds.length); } while (idx === roundIndex);
                  goToRound(idx);
                }}
                className="text-white/40 hover:text-white transition-colors"
              >
                <Shuffle size={13} />
              </button>
            </div>

            {isRoundDone && isLastRound && allCleared ? (
              <button onClick={() => setShowFinalScore(true)} className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide">
                Results
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => goToRound(roundIndex + 1)}
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
  const pctColor = pct >= 80 ? "text-green-500" : pct >= 50 ? "text-orange-400" : "text-red-500";

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-6">
      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Final Score</p>
        <p className={`text-5xl font-bold mt-2 ${pctColor}`}>{pct}%</p>
        <p className="text-gray-500 text-sm mt-2">{totalGuessed} / {totalPlayers} transfers</p>
      </div>

      <div className="w-full flex flex-col gap-2">
        {rounds.map((r, i) => {
          const guessedCount = r.guessedIndices.size;
          const total = r.transfers.length;
          const cleared = r.state === "cleared";
          return (
            <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{r.league} {r.seasonLabel}</p>
                <p className="text-xs text-gray-500">{total} transfers</p>
              </div>
              <span className={`text-sm font-bold tabular-nums ${guessedCount === total ? "text-green-600" : guessedCount > 0 ? "text-orange-500" : "text-red-500"}`}>
                {guessedCount}/{total}
              </span>
              <span className="text-base">{cleared ? "✓" : guessedCount > 0 ? "~" : "✗"}</span>
            </div>
          );
        })}
      </div>

      <button onClick={onBack} className="bg-[#1a1a2e] text-white font-bold px-8 py-3 rounded-xl w-full text-sm">
        Back to Game
      </button>
    </div>
  );
}
