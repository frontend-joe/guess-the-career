import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import {
  Loader2,
  Trophy,
  X,
  ChevronLeft,
  ChevronRight,
  Shuffle,
} from "lucide-react";
import { GameMenu } from "@/components/GameMenu";
import {
  getClubForeignersScheduleRounds,
  type ClubForeignersScheduleRound,
} from "@/api/club-foreigners-schedule";
import {
  OverallProgressScreen,
  type ProgressRound,
} from "@/components/OverallProgressScreen";
import { MiniClubBadge } from "@/components/MiniClubBadge";
import { NationalityFlag } from "@/components/NationalityFlag";
import { PositionBadge } from "@/components/PositionBadge";
import { GuessSearchInput } from "@/components/GuessSearchInput";
import { useShowPlayer } from "@/contexts/PlayerModalContext";

// Each round asks for a per-club number of overseas players (admin-set, default 5).
const DEFAULT_ROUND_TARGET = 5;

// ─── localStorage ─────────────────────────────────────────────────────────────

const PROGRESS_KEY = "club_foreigners_progress";

interface RoundProgress {
  guessedIds: number[];
  wrongGuesses?: string[];
}

interface SavedProgress {
  [club: string]: RoundProgress;
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

function persistRound(
  key: string,
  guessedIds: Set<number>,
  wrongGuesses: Set<string>,
) {
  const saved = loadProgress();
  saved[key] = { guessedIds: [...guessedIds], wrongGuesses: [...wrongGuesses] };
  saveProgress(saved);
}

// ─── Name matching ────────────────────────────────────────────────────────────

const TRANSLITERATE: Record<string, string> = {
  ı: "i", ł: "l", ø: "o", đ: "d", ð: "d", æ: "a", œ: "o", ħ: "h", ŋ: "n", ŧ: "t", þ: "th", ß: "ss",
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

// ─── Club badge ───────────────────────────────────────────────────────────────

function ClubBadge({ name, wikiUrl }: { name: string; wikiUrl: string | null }) {
  const [logoUrl, setLogoUrl] = useState<string | false | null>(null);

  useEffect(() => {
    if (!wikiUrl) { setLogoUrl(false); return; }
    const title = wikiUrl.split("/wiki/")[1];
    if (!title) { setLogoUrl(false); return; }
    const controller = new AbortController();
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setLogoUrl(data?.thumbnail?.source ?? false))
      .catch((err) => { if (err.name !== "AbortError") setLogoUrl(false); });
    return () => controller.abort();
  }, [wikiUrl]);

  return (
    <div className="flex flex-col items-center gap-1.5 w-32">
      <div className="w-16 h-16 bg-white border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
        {logoUrl === null ? (
          <div className="w-full h-full animate-pulse bg-gray-100" />
        ) : logoUrl === false ? (
          <span className="text-gray-500 font-bold text-2xl">{name.charAt(0)}</span>
        ) : (
          <img src={logoUrl} alt={name} className="w-full h-full object-contain p-1" />
        )}
      </div>
      <span className="text-gray-800 font-semibold text-sm text-center leading-tight max-w-28 line-clamp-2">
        {name}
      </span>
    </div>
  );
}

// ─── Player slot ──────────────────────────────────────────────────────────────

interface Player {
  id: number;
  name: string;
  photo_url: string | null;
  nationality?: string | null;
  country?: string | null;
  position?: string | null;
  apps?: number;
  years?: string | null;
}

// A slot is either a guessed player (filled) or an empty slot hinting one of the
// club's foreign nationalities still to be named (with a representative player's
// position as an extra clue on the right).
function CountrySlot({ index, player, hint }: { index: number; player: Player | null; hint: Player | null }) {
  const showPlayer = useShowPlayer();
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${player ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${player ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`}>
        {index + 1}
      </span>
      {player ? (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <NationalityFlag nationality={player.country ?? player.nationality} size={16} />
          {player.position && <PositionBadge position={player.position} />}
          <button
            type="button"
            onClick={() => showPlayer(player.id)}
            className="text-sm font-semibold text-gray-800 truncate text-left hover:underline"
          >
            {player.name}
          </button>
          {player.apps != null && (
            <span className="ml-auto text-xs font-semibold text-gray-500 tabular-nums shrink-0">{player.apps} apps</span>
          )}
        </div>
      ) : hint ? (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <NationalityFlag nationality={hint.country ?? hint.nationality} size={16} />
          {hint.position && <PositionBadge position={hint.position} />}
          <div className="h-px bg-gray-200 flex-1 rounded-full" />
          {hint.years && <span className="text-xs text-gray-400 tabular-nums shrink-0">{hint.years}</span>}
        </div>
      ) : (
        <div className="h-px bg-gray-200 flex-1 rounded-full" />
      )}
    </div>
  );
}

// ─── Round state ──────────────────────────────────────────────────────────────

interface RoundState {
  round: ClubForeignersScheduleRound;
  players: Player[] | null;
  guessedIds: Set<number>;
  wrongGuesses: Set<string>;
}

// ─── Verify ───────────────────────────────────────────────────────────────────

interface VerifyResult {
  valid: boolean;
  footballer: Player | null;
  foundName?: string;
  imported: boolean;
  reason?: "wrong_club" | "home_nation" | "not_retired";
}

async function verifyGuess(footballerName: string, footballerId: number | null, club: string): Promise<VerifyResult> {
  try {
    const body: Record<string, unknown> = { footballerName, club };
    if (footballerId != null) body.footballerId = footballerId;
    const res = await fetch("/api/club-foreigners/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { valid: false, footballer: null, imported: false };
    return await res.json();
  } catch {
    return { valid: false, footballer: null, imported: false };
  }
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function ClubForeignersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rounds, setRounds] = useState<ClubForeignersScheduleRound[]>([]);
  const [roundStates, setRoundStates] = useState<Record<string, RoundState>>({});
  const [roundIndex, setRoundIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [progressSearch, setProgressSearch] = useState("");
  const [wrongGuessMsg, setWrongGuessMsg] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    getClubForeignersScheduleRounds()
      .then((data) => {
        setRounds(data);
        const saved = loadProgress();
        const states: Record<string, RoundState> = {};
        data.forEach((r) => {
          const prog = saved[r.club];
          states[r.club] = {
            round: r,
            players: null,
            guessedIds: new Set(prog?.guessedIds ?? []),
            wrongGuesses: new Set(prog?.wrongGuesses ?? []),
          };
        });
        setRoundStates(states);

        const todayIso = new Date().toISOString().split("T")[0];
        const numParam = parseInt(searchParams.get("round") ?? "", 10);
        const paramIdx = !isNaN(numParam) ? Math.max(0, Math.min(numParam - 1, data.length - 1)) : -1;
        const todayIdx = data.findIndex((r) => r.date === todayIso);
        const pastRounds = data.filter((r) => r.date <= todayIso);
        const idx = paramIdx >= 0 ? paramIdx : todayIdx >= 0 ? todayIdx : pastRounds.length > 0 ? pastRounds.length - 1 : 0;
        setRoundIndex(idx);
      })
      .catch(() => setError("Failed to load schedule"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentRound = rounds[roundIndex];
  useEffect(() => {
    if (!currentRound) return;
    setSearchParams({ round: String(roundIndex + 1) }, { replace: true });
  }, [roundIndex, currentRound]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentKey = currentRound ? currentRound.club : null;
  const currentState = currentKey ? roundStates[currentKey] : null;

  useEffect(() => {
    if (!currentRound || !currentKey) return;
    if (roundStates[currentKey]?.players !== null) return;
    fetch(`/api/club-foreigners/answers?club=${encodeURIComponent(currentRound.club)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((players: Player[]) => {
        setRoundStates((prev) => ({ ...prev, [currentKey]: { ...prev[currentKey], players } }));
      })
      .catch(() => {});
  }, [currentKey, currentRound]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !error && rounds.length > 0 && !showProgress) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [roundIndex, loading, error, rounds.length, showProgress]);

  // Flash a transient message; optionally record it as a wrong guess.
  function flashMessage(msg: string, addWrong: boolean, name?: string) {
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    setWrongGuessMsg(msg);
    wrongTimer.current = setTimeout(() => setWrongGuessMsg(null), 2500);
    if (addWrong && currentKey && currentState && name) {
      const newWrong = new Set(currentState.wrongGuesses);
      newWrong.add(normalizeGuess(name));
      setRoundStates((prev) => ({ ...prev, [currentKey]: { ...prev[currentKey], wrongGuesses: newWrong } }));
      persistRound(currentKey, currentState.guessedIds, newWrong);
    }
  }

  async function submitGuess(name: string, id: number | null = null) {
    if (!currentState || !currentKey || !currentRound || verifying) return;
    const players = currentState.players;
    if (!players) return;
    const roundTarget = currentRound.roundSize ?? DEFAULT_ROUND_TARGET;
    const guessedPlayers = players.filter((p) => currentState.guessedIds.has(p.id));
    if (guessedPlayers.length >= roundTarget) return;
    const countryOf = (p: Player) => p.country ?? p.nationality ?? "";
    const usedCountries = new Set(guessedPlayers.map(countryOf));

    // Accept a validated foreign player, enforcing one player per nationality.
    const accept = (p: Player) => {
      const c = countryOf(p);
      if (c && usedCountries.has(c)) {
        flashMessage(`You've already named a ${c} player`, false);
        return;
      }
      const newGuessedIds = new Set([...currentState.guessedIds, p.id]);
      setRoundStates((prev) => {
        const state = prev[currentKey];
        if (!state) return prev;
        const inList = state.players?.some((x) => x.id === p.id);
        const newPlayers = inList ? state.players! : [...(state.players ?? []), p];
        return { ...prev, [currentKey]: { ...state, players: newPlayers, guessedIds: newGuessedIds } };
      });
      persistRound(currentKey, newGuessedIds, currentState.wrongGuesses);
    };

    // Already-guessed player typed again → ignore.
    if (guessedPlayers.some((p) => matchesPlayer(name, p.name))) return;

    const matched = players.find((p) => !currentState.guessedIds.has(p.id) && matchesPlayer(name, p.name));
    if (matched) {
      accept(matched);
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyGuess(name, id, currentRound.club);
      if (result.valid && result.footballer) {
        accept(result.footballer);
      } else {
        const displayName = result.foundName ?? `"${name}"`;
        const msg =
          result.reason === "home_nation"
            ? `${displayName} isn't a foreigner at ${currentRound.club}`
            : result.reason === "not_retired"
              ? `Correct, but ${displayName} isn't retired yet!`
              : result.reason === "wrong_club"
                ? `${displayName} never played for ${currentRound.club}`
                : `${displayName} is not a valid answer`;
        flashMessage(msg, true, name);
      }
    } finally {
      setVerifying(false);
    }
  }

  function guessStatus(s: { id: number; name: string }) {
    if (!currentState) return null;
    if (currentState.guessedIds.has(s.id)) return "correct" as const;
    if (currentState.wrongGuesses.has(normalizeGuess(s.name))) return "incorrect" as const;
    return null;
  }

  function handleRandom() {
    const idx = Math.floor(Math.random() * rounds.length);
    setRoundIndex(idx);
  }

  const progressRounds: ProgressRound[] = rounds.map((r, i) => {
    const state = roundStates[r.club];
    const statePlayers = state?.players;
    const roundTarget = r.roundSize ?? DEFAULT_ROUND_TARGET;
    const validIds = statePlayers ? statePlayers.filter((p) => state!.guessedIds.has(p.id)).length : (state?.guessedIds.size ?? 0);
    const guessed = Math.min(validIds, roundTarget);
    return {
      name: (
        <span className="text-xs font-medium">
          <span className="text-gray-400 mr-1">#{i + 1}</span>
          {r.club}
        </span>
      ),
      icon: <MiniClubBadge club={r.club} wikipediaUrl={r.clubWikiUrl} />,
      guessed,
      total: roundTarget,
    };
  });

  const totalGuessed = rounds.filter((r) => {
    const state = roundStates[r.club];
    return (state?.guessedIds.size ?? 0) >= (r.roundSize ?? DEFAULT_ROUND_TARGET);
  }).length;
  const totalPlayers = rounds.length;

  const filteredProgressData = progressRounds
    .map((r, i) => ({ r, i }))
    .filter(({ i }) => {
      if (!progressSearch.trim()) return true;
      return rounds[i].club.toLowerCase().includes(progressSearch.toLowerCase());
    });
  const filteredProgressRounds = filteredProgressData.map((d) => d.r);
  const filteredOriginalIndices = filteredProgressData.map((d) => d.i);

  const players = currentState?.players ?? null;
  const target = currentRound?.roundSize ?? DEFAULT_ROUND_TARGET;

  const validGuessedIds = players
    ? new Set(players.filter((p) => currentState!.guessedIds.has(p.id)).map((p) => p.id))
    : (currentState?.guessedIds ?? new Set<number>());
  const guessedCount = validGuessedIds.size;
  const isDone = guessedCount >= target;

  const countryOf = (p: Player) => p.country ?? p.nationality ?? "";
  const guessedList = players ? players.filter((p) => validGuessedIds.has(p.id)) : [];
  const usedCountries = new Set(guessedList.map(countryOf));
  // One representative player per still-unused nationality (the club's top scorer
  // of apps for that country — the pool is pre-sorted by country size then apps),
  // biggest nationalities first. Its position is shown as the slot's hint.
  const unusedReps: Player[] = [];
  if (players) {
    const seen = new Set(usedCountries);
    for (const p of players) {
      const c = countryOf(p);
      if (c && !seen.has(c)) { seen.add(c); unusedReps.push(p); }
    }
  }
  const slots: { player: Player | null; hint: Player | null }[] = Array.from({ length: target }, (_, i) =>
    i < guessedList.length
      ? { player: guessedList[i], hint: null }
      : { player: null, hint: unusedReps[i - guessedList.length] ?? null },
  );

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
        <p className="text-gray-500 text-sm text-center">{error ?? "No rounds scheduled yet"}</p>
        <button onClick={() => (window.location.href = "/")} className="text-sm text-blue-600 underline">
          Back to games
        </button>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      <div className="bg-[#0b0c1a] divide-soft-b flex items-center justify-between px-3 py-2.5 shrink-0">
        <GameMenu />
        <span className="text-white font-display text-sm tracking-wide uppercase">Club Foreigners</span>
        <button className="text-white/90 hover:text-green-400 transition-colors p-1" onClick={() => setShowProgress((v) => !v)}>
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
              onRoundClick={(i) => { setRoundIndex(filteredOriginalIndices[i]); setShowProgress(false); }}
              label="completed"
            />
          </div>
          <div className="shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
            <input
              type="text"
              value={progressSearch}
              onChange={(e) => setProgressSearch(e.target.value)}
              placeholder="Filter by club…"
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
          <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
            {currentRound && (
              <div className="px-3 pt-4 pb-2 flex flex-col gap-3">
                <div className="relative bg-white rounded-2xl border border-gray-200 px-4 pt-6 pb-5 flex flex-col items-center gap-3 overflow-hidden">
                  {currentRound.foreignerCount < 25 ? (
                    <div className="absolute top-3.5 -right-7 rotate-45 w-24 text-center bg-red-500 text-white text-[9px] font-bold tracking-wider uppercase py-0.5 shadow-sm">Solid</div>
                  ) : currentRound.foreignerCount < 50 ? (
                    <div className="absolute top-3.5 -right-7 rotate-45 w-24 text-center bg-amber-400 text-white text-[9px] font-bold tracking-wider uppercase py-0.5 shadow-sm">Medium</div>
                  ) : (
                    <div className="absolute top-3.5 -right-7 rotate-45 w-24 text-center bg-green-500 text-white text-[9px] font-bold tracking-wider uppercase py-0.5 shadow-sm">Easy</div>
                  )}
                  <ClubBadge name={currentRound.club} wikiUrl={currentRound.clubWikiUrl} />
                  <span className="text-gray-400 text-[11px] text-center">A player from {target} different nationalities</span>
                </div>

                {players === null ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-gray-300" size={22} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {slots.map((s, i) => (
                      <CountrySlot key={i} index={i} player={s.player} hint={s.hint} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {currentRound && (
            <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
              <p className={`text-xs mb-2 ${verifying ? "text-yellow-400" : guessedCount > 0 ? "text-green-400" : "text-white/50"}`}>
                {verifying ? "Checking…" : isDone ? `All ${target} found! ✓` : `${guessedCount} / ${target} found`}
              </p>

              {wrongGuessMsg && (
                <div className="mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600 text-center animate-pulse">
                  {wrongGuessMsg}
                </div>
              )}

              {!isDone && (
                <div className="mb-3">
                  <GuessSearchInput autoScrape={true}
                    inputRef={inputRef}
                    disabled={verifying}
                    getKey={(f) => f.id}
                    getLabel={(f) => f.name}
                    getStatus={guessStatus}
                    onSelect={(name, item) => submitGuess(name, item?.id ?? null)}
                  />
                </div>
              )}

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
                  <button onClick={handleRandom} className="text-white/40 hover:text-white transition-colors">
                    <Shuffle size={13} />
                  </button>
                </div>

                <button
                  onClick={() => setRoundIndex((i) => Math.min(rounds.length - 1, i + 1))}
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
