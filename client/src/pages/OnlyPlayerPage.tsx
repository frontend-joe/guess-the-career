import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import {
  Loader2,
  Trophy,
  X,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Plus,
  User,
} from "lucide-react";
import { GameMenu } from "@/components/GameMenu";
import {
  getOnlyPlayerScheduleRounds,
  type OnlyPlayerScheduleRound,
} from "@/api/only-player-schedule";
import {
  OverallProgressScreen,
  type ProgressRound,
} from "@/components/OverallProgressScreen";
import { MiniClubBadge } from "@/components/MiniClubBadge";
import { PositionBadge } from "@/components/PositionBadge";
import { GuessSearchInput } from "@/components/GuessSearchInput";
import { useShowPlayer } from "@/contexts/PlayerModalContext";
import { nationalityToFlagUrl } from "@/lib/flags";
import { useCompactMode } from "@/contexts/CompactModeContext";
import GameHeader from "@/components/GameHeader";
import CrestBadge from "@/components/CrestBadge";

// Only Player: exactly one qualifying player per round — the curated answer.
const ROUND_TARGET = 1;

// ─── localStorage ─────────────────────────────────────────────────────────────

const PROGRESS_KEY = "op_progress";

interface RoundProgress {
  solved: boolean;
  wrongGuesses?: string[];
}

interface SavedProgress {
  [entryKey: string]: RoundProgress;
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

function persistRound(key: string, solved: boolean, wrongGuesses: Set<string>) {
  const saved = loadProgress();
  saved[key] = { solved, wrongGuesses: [...wrongGuesses] };
  saveProgress(saved);
}

function roundKey(entryId: number): string {
  return String(entryId);
}

// ─── Name matching ────────────────────────────────────────────────────────────

const TRANSLITERATE: Record<string, string> = {
  ı: "i",
  ł: "l",
  ø: "o",
  đ: "d",
  ð: "d",
  æ: "a",
  œ: "o",
  ħ: "h",
  ŋ: "n",
  ŧ: "t",
  þ: "th",
  ß: "ss",
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
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
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
  const guessLast = g.split(" ").at(-1) ?? "";
  const answerLast = p.split(" ").at(-1) ?? "";
  if (answerLast.length < 4) return false;
  // Typed just the surname.
  if (g === answerLast) return true;
  // Surnames match (or near-miss by one char) — tolerates a differently spelled
  // or omitted first name, e.g. "Georgi Kinkladze" vs "Giorgi Kinkladze".
  if (guessLast.length >= 4) {
    if (guessLast === answerLast) return true;
    if (damerauDistance(guessLast, answerLast) === 1) return true;
  }
  return false;
}

// ─── Answer card ────────────────────────────────────────────────────────────────

function PlayerCard({
  player,
  solved,
}: {
  player: OnlyPlayerScheduleRound["player"];
  solved: boolean;
}) {
  const showPlayer = useShowPlayer();
  const clickable = solved && player.footballerId != null;

  // Text hints shown both before and after guessing (position is a chip below).
  const meta = [
    player.apps != null ? `${player.apps} apps` : null,
    player.period,
  ].filter(Boolean) as string[];

  return (
    <div
      className={`mx-auto w-full max-w-xs rounded-2xl border p-6 flex flex-col items-center gap-3 shadow-sm transition-colors ${solved ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}
    >
      {/* Avatar */}
      <div
        className={`w-28 h-28 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 ${solved ? "border-4 border-green-200" : "border-2 border-gray-200"}`}
      >
        {solved && player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-12 h-12 text-gray-300" strokeWidth={1.5} />
        )}
      </div>

      {/* Name */}
      {solved ? (
        clickable ? (
          <button
            type="button"
            onClick={() => showPlayer(player.footballerId!)}
            className="text-lg font-bold text-gray-800 text-center hover:underline"
          >
            {player.name}
          </button>
        ) : (
          <span className="text-lg font-bold text-gray-800 text-center">
            {player.name}
          </span>
        )
      ) : (
        <div className="h-5 w-32 rounded-full bg-gray-200" />
      )}

      {/* [pos] apps | years */}
      {(player.position || meta.length > 0) && (
        <div className="flex items-center gap-2 text-xs text-gray-500 tabular-nums">
          {player.position && <PositionBadge position={player.position} />}
          {meta.map((m, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300">|</span>}
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Round state ──────────────────────────────────────────────────────────────

interface RoundState {
  solved: boolean;
  wrongGuesses: Set<string>;
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function OnlyPlayerPage() {
  const { compact } = useCompactMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rounds, setRounds] = useState<OnlyPlayerScheduleRound[]>([]);
  const [roundStates, setRoundStates] = useState<Record<string, RoundState>>({});
  const [roundIndex, setRoundIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [progressSearch, setProgressSearch] = useState("");
  const [wrongGuessMsg, setWrongGuessMsg] = useState<string | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load schedule ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getOnlyPlayerScheduleRounds()
      .then((data) => {
        setRounds(data);
        const saved = loadProgress();
        const states: Record<string, RoundState> = {};
        data.forEach((r) => {
          const key = roundKey(r.entryId);
          const prog = saved[key];
          states[key] = {
            solved: prog?.solved ?? false,
            wrongGuesses: new Set(prog?.wrongGuesses ?? []),
          };
        });
        setRoundStates(states);

        const todayIso = new Date().toISOString().split("T")[0];
        const numParam = parseInt(searchParams.get("round") ?? "", 10);
        const paramIdx = !isNaN(numParam)
          ? Math.max(0, Math.min(numParam - 1, data.length - 1))
          : -1;
        const todayIdx = data.findIndex((r) => r.date === todayIso);
        const pastRounds = data.filter((r) => r.date <= todayIso);
        const idx =
          paramIdx >= 0
            ? paramIdx
            : todayIdx >= 0
              ? todayIdx
              : pastRounds.length > 0
                ? pastRounds.length - 1
                : 0;
        setRoundIndex(idx);
      })
      .catch(() => setError("Failed to load schedule"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync round index to URL ───────────────────────────────────────────────
  const currentRound = rounds[roundIndex];
  useEffect(() => {
    if (!currentRound) return;
    setSearchParams({ round: String(roundIndex + 1) }, { replace: true });
  }, [roundIndex, currentRound]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentKey = currentRound ? roundKey(currentRound.entryId) : null;
  const currentState = currentKey ? roundStates[currentKey] : null;

  useEffect(() => {
    if (!loading && !error && rounds.length > 0 && !showProgress) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [roundIndex, loading, error, rounds.length, showProgress]);

  // ── Submit guess ──────────────────────────────────────────────────────────
  function submitGuess(name: string) {
    if (!currentState || !currentKey || !currentRound) return;
    if (currentState.solved) return;

    if (matchesPlayer(name, currentRound.player.name)) {
      setRoundStates((prev) => ({
        ...prev,
        [currentKey]: { ...prev[currentKey], solved: true },
      }));
      persistRound(currentKey, true, currentState.wrongGuesses);
      return;
    }

    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    setWrongGuessMsg(`"${name}" isn't the one`);
    wrongTimer.current = setTimeout(() => setWrongGuessMsg(null), 2500);

    const newWrong = new Set(currentState.wrongGuesses);
    newWrong.add(normalizeGuess(name));
    setRoundStates((prev) => ({
      ...prev,
      [currentKey]: { ...prev[currentKey], wrongGuesses: newWrong },
    }));
    persistRound(currentKey, false, newWrong);
  }

  function guessStatus(s: { id: number; name: string }) {
    if (!currentState) return null;
    if (currentState.solved && matchesPlayer(s.name, currentRound!.player.name))
      return "correct" as const;
    if (currentState.wrongGuesses.has(normalizeGuess(s.name)))
      return "incorrect" as const;
    return null;
  }

  function handleRandom() {
    const idx = Math.floor(Math.random() * rounds.length);
    setRoundIndex(idx);
  }

  // ── Progress screen ───────────────────────────────────────────────────────
  const progressRounds: ProgressRound[] = rounds.map((r, i) => {
    const state = roundStates[roundKey(r.entryId)];
    const guessed = state?.solved ? 1 : 0;
    return {
      name: (
        <span className="text-xs font-medium">
          <span className="text-gray-400 mr-1">#{i + 1}</span>
          {r.nationality} × {r.club}
        </span>
      ),
      icon: (
        <div className="flex items-center gap-1">
          {nationalityToFlagUrl(r.nationality) ? (
            <img
              src={nationalityToFlagUrl(r.nationality)!}
              alt={r.nationality}
              className="w-5 h-5 object-cover rounded-sm shrink-0"
            />
          ) : (
            <span className="text-xs font-bold text-gray-400">
              {r.nationality.charAt(0)}
            </span>
          )}
          <MiniClubBadge club={r.club} wikipediaUrl={r.clubWikiUrl} />
        </div>
      ),
      guessed,
      total: ROUND_TARGET,
    };
  });

  const totalGuessed = rounds.filter(
    (r) => roundStates[roundKey(r.entryId)]?.solved,
  ).length;
  const totalPlayers = rounds.length;

  const filteredProgressData = progressRounds
    .map((r, i) => ({ r, i }))
    .filter(({ i }) => {
      if (!progressSearch.trim()) return true;
      const term = progressSearch.toLowerCase();
      return (
        rounds[i].nationality.toLowerCase().includes(term) ||
        rounds[i].club.toLowerCase().includes(term) ||
        rounds[i].player.name.toLowerCase().includes(term)
      );
    });
  const filteredProgressRounds = filteredProgressData.map((d) => d.r);
  const filteredOriginalIndices = filteredProgressData.map((d) => d.i);

  const isDone = currentState?.solved ?? false;

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    );
  }

  if (error || rounds.length === 0) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 bg-gray-50 px-6">
        <p className="text-gray-500 text-sm text-center">
          {error ?? "No rounds scheduled yet"}
        </p>
        <button
          onClick={() => (window.location.href = "/")}
          className="text-sm text-blue-600 underline"
        >
          Back to games
        </button>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      {/* ── Header ── */}
      <div className="bg-[#0b0c1a] divide-soft-b relative flex items-center justify-between px-3 py-2.5 shrink-0">
        <GameMenu />
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-display text-sm tracking-wide uppercase">
          Only Player
        </span>
        <button
          className="text-white/90 hover:text-green-400 transition-colors p-1"
          onClick={() => setShowProgress((v) => !v)}
        >
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
              onRoundClick={(i) => {
                setRoundIndex(filteredOriginalIndices[i]);
                setShowProgress(false);
              }}
              label="completed"
            />
          </div>
          <div className="shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
            <input
              type="text"
              value={progressSearch}
              onChange={(e) => setProgressSearch(e.target.value)}
              placeholder="Filter by nationality, club or player…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              style={{ fontSize: "16px" }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
            {currentRound && (
              <GameHeader
                compact={compact}
                image={
                  <div className="flex items-center gap-1">
                    <CrestBadge name={currentRound.nationality} />
                    <Plus size={14} className="text-gray-400 shrink-0" />
                    <CrestBadge
                      name={currentRound.club}
                      wikipediaUrl={currentRound.clubWikiUrl}
                    />
                  </div>
                }
                title={`Who is the only ${currentRound.nationality} player for ${currentRound.club}?`}
                subtitle="Name the only one"
              />
            )}
            {currentRound && (
              <div className="px-3 pt-6 pb-2 flex flex-col gap-3">
                <PlayerCard player={currentRound.player} solved={isDone} />
              </div>
            )}
          </div>

          {/* ── Bottom panel ── */}
          {currentRound && (
            <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
              <p
                className={`text-xs mb-2 ${isDone ? "text-green-400" : "text-white/50"}`}
              >
                {isDone ? "Found! ✓" : `0 / ${ROUND_TARGET} found`}
              </p>

              {wrongGuessMsg && (
                <div className="mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600 text-center animate-pulse">
                  {wrongGuessMsg}
                </div>
              )}

              {!isDone && (
                <div className="mb-3">
                  <GuessSearchInput
                    autoScrape={true}
                    inputRef={inputRef}
                    getKey={(f) => f.id}
                    getLabel={(f) => f.name}
                    getStatus={guessStatus}
                    onSelect={(name) => submitGuess(name)}
                  />
                </div>
              )}

              {/* Nav row */}
              <div className="relative flex items-center justify-between pt-1">
                <button
                  onClick={() => setRoundIndex((i) => Math.max(0, i - 1))}
                  disabled={roundIndex === 0}
                  className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 text-xs font-mono">
                  <span>
                    <span className="text-white">#{roundIndex + 1}</span>
                    <span className="text-white/50">/{rounds.length}</span>
                  </span>
                  <button
                    onClick={handleRandom}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    <Shuffle size={13} />
                  </button>
                </div>

                <button
                  onClick={() =>
                    setRoundIndex((i) => Math.min(rounds.length - 1, i + 1))
                  }
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
  );
}
