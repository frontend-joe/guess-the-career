import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { Home, Loader2, Trophy, X, ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import {
  getForeignersScheduleRounds,
  type ForeignersScheduleRound,
} from "@/api/foreigners-schedule";
import { OverallProgressScreen, type ProgressRound } from "@/components/OverallProgressScreen";
import { MiniClubBadge } from "@/components/MiniClubBadge";
import { GuessSearchInput } from "@/components/GuessSearchInput";
import { nationalityToFlagUrl } from "@/lib/flags";

// ─── localStorage ───────────────────────────────────────────────────────────
const PROGRESS_KEY = "foreigners_progress";
interface SavedProgress { [nat: string]: { guessedIds: number[]; wrongGuesses?: string[] } }
function loadProgress(): SavedProgress {
  try { const raw = localStorage.getItem(PROGRESS_KEY); return raw ? JSON.parse(raw) : {} } catch { return {} }
}
function saveProgress(p: SavedProgress) { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)) }
function persistRound(key: string, guessedIds: Set<number>, wrongGuesses: Set<string>) {
  const saved = loadProgress()
  saved[key] = { guessedIds: [...guessedIds], wrongGuesses: [...wrongGuesses] }
  saveProgress(saved)
}

// ─── Name matching ──────────────────────────────────────────────────────────
const TRANSLITERATE: Record<string, string> = { ı: "i", ł: "l", ø: "o", đ: "d", ð: "d", æ: "a", œ: "o", ħ: "h", ŋ: "n", ŧ: "t", þ: "th", ß: "ss" };
const TRANSLIT_RE = /[ıłøđðæœħŋŧþß]/g;
function normalizeGuess(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(TRANSLIT_RE, (c) => TRANSLITERATE[c] ?? c).trim();
}
function damerauDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
  }
  return dp[m][n];
}
function matchesPlayer(guess: string, playerName: string): boolean {
  const g = normalizeGuess(guess), p = normalizeGuess(playerName);
  if (g === p) return true;
  const lastName = p.split(" ").at(-1) ?? "";
  if (lastName.length >= 4 && g === lastName) return true;
  if (lastName.length >= 4 && g.length >= 4 && damerauDistance(g, lastName) === 1) return true;
  return false;
}

interface Player { id: number; name: string; photo_url: string | null; apps?: number; hintClub?: string | null; clubWikiUrl?: string | null }

function PlayerSlot({ index, player }: { index: number; player: Player | null }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${player ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${player ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`}>{index + 1}</span>
      {player ? (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="w-5 flex items-center justify-center shrink-0">
            <MiniClubBadge club={player.hintClub ?? ""} wikipediaUrl={player.clubWikiUrl ?? null} />
          </span>
          <span className="text-sm font-semibold text-gray-800 truncate">{player.name}</span>
          {player.apps != null && <span className="ml-auto text-xs font-semibold text-gray-500 tabular-nums shrink-0">{player.apps} apps</span>}
        </div>
      ) : (
        <div className="h-px bg-gray-200 flex-1 rounded-full" />
      )}
    </div>
  );
}

interface RoundState { round: ForeignersScheduleRound; players: Player[] | null; guessedIds: Set<number>; wrongGuesses: Set<string> }

interface VerifyResult {
  valid: boolean;
  footballer: { id: number; name: string; photo_url: string | null } | null;
  hintClub?: string | null;
  clubWikiUrl?: string | null;
  apps?: number;
  foundName?: string;
  imported: boolean;
  reason?: "not_retired" | "wrong_nationality" | "wrong_club" | "wrong_both";
}

async function verifyGuess(footballerName: string, footballerId: number | null, nationality: string): Promise<VerifyResult> {
  try {
    const body: Record<string, unknown> = { footballerName, nationality };
    if (footballerId != null) body.footballerId = footballerId;
    const res = await fetch("/api/foreigners/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return { valid: false, footballer: null, imported: false };
    return await res.json();
  } catch { return { valid: false, footballer: null, imported: false } }
}

export function ForeignersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rounds, setRounds] = useState<ForeignersScheduleRound[]>([]);
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
    getForeignersScheduleRounds()
      .then((data) => {
        setRounds(data);
        const saved = loadProgress();
        const states: Record<string, RoundState> = {};
        data.forEach((r) => {
          const prog = saved[r.nationality];
          states[r.nationality] = { round: r, players: null, guessedIds: new Set(prog?.guessedIds ?? []), wrongGuesses: new Set(prog?.wrongGuesses ?? []) };
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

  const currentKey = currentRound ? currentRound.nationality : null;
  const currentState = currentKey ? roundStates[currentKey] : null;

  useEffect(() => {
    if (!currentRound || !currentKey) return;
    if (roundStates[currentKey]?.players !== null) return;
    fetch(`/api/foreigners/answers?nationality=${encodeURIComponent(currentRound.nationality)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((players: Player[]) => setRoundStates((prev) => ({ ...prev, [currentKey]: { ...prev[currentKey], players } })))
      .catch(() => {});
  }, [currentKey, currentRound]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !error && rounds.length > 0 && !showProgress) setTimeout(() => inputRef.current?.focus(), 50);
  }, [roundIndex, loading, error, rounds.length, showProgress]);

  async function submitGuess(name: string, id: number | null = null) {
    if (!currentState || !currentKey || !currentRound || verifying) return;
    const players = currentState.players;
    if (!players) return;
    const target = currentRound.roundSize;
    const activeGuesses = players.filter((p) => currentState.guessedIds.has(p.id)).length;
    if (activeGuesses >= target) return;
    if (players.filter((p) => currentState.guessedIds.has(p.id)).some((p) => matchesPlayer(name, p.name))) return;

    const matched = players.filter((p) => !currentState.guessedIds.has(p.id) && matchesPlayer(name, p.name));
    if (matched.length > 0) {
      const newGuessedIds = new Set([...currentState.guessedIds, ...matched.map((p) => p.id)]);
      setRoundStates((prev) => ({ ...prev, [currentKey]: { ...prev[currentKey], guessedIds: newGuessedIds } }));
      persistRound(currentKey, newGuessedIds, currentState.wrongGuesses);
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyGuess(name, id, currentRound.nationality);
      if (result.valid && result.footballer) {
        const f = { ...result.footballer, hintClub: result.hintClub, clubWikiUrl: result.clubWikiUrl, apps: result.apps };
        const newGuessedIds = new Set([...currentState.guessedIds, f.id]);
        setRoundStates((prev) => {
          const state = prev[currentKey]; if (!state) return prev;
          const alreadyInList = state.players?.some((p) => p.id === f.id);
          const newPlayers = alreadyInList ? state.players! : [...(state.players ?? []), f];
          return { ...prev, [currentKey]: { ...state, players: newPlayers, guessedIds: new Set([...state.guessedIds, f.id]) } };
        });
        persistRound(currentKey, newGuessedIds, currentState.wrongGuesses);
      } else {
        if (wrongTimer.current) clearTimeout(wrongTimer.current);
        const displayName = result.foundName ?? `"${name}"`;
        const msg = result.reason === "not_retired" ? `Correct, but ${displayName} isn't retired yet!`
          : result.reason === "wrong_club" ? `${displayName} didn't play for an English club`
          : result.reason === "wrong_nationality" ? `${displayName} isn't ${currentRound.nationality}`
          : `${displayName} is not a valid answer`;
        setWrongGuessMsg(msg);
        wrongTimer.current = setTimeout(() => setWrongGuessMsg(null), 2500);
        const newWrong = new Set(currentState.wrongGuesses); newWrong.add(normalizeGuess(name));
        setRoundStates((prev) => ({ ...prev, [currentKey]: { ...prev[currentKey], wrongGuesses: newWrong } }));
        persistRound(currentKey, currentState.guessedIds, newWrong);
      }
    } finally { setVerifying(false) }
  }

  function guessStatus(s: { id: number; name: string }) {
    if (!currentState) return null;
    if (currentState.guessedIds.has(s.id)) return "correct" as const;
    if (currentState.wrongGuesses.has(normalizeGuess(s.name))) return "incorrect" as const;
    return null;
  }

  function handleRandom() { setRoundIndex(Math.floor(Math.random() * rounds.length)) }

  const progressRounds: ProgressRound[] = rounds.map((r, i) => {
    const state = roundStates[r.nationality];
    const validIds = state?.players ? state.players.filter((p) => state.guessedIds.has(p.id)).length : (state?.guessedIds.size ?? 0);
    const target = r.roundSize;
    return {
      name: (<span className="text-xs font-medium"><span className="text-gray-400 mr-1">#{i + 1}</span>{r.nationality}</span>),
      icon: <span className="w-5 h-4 inline-flex items-center justify-center">{nationalityToFlagUrl(r.nationality) ? <img src={nationalityToFlagUrl(r.nationality)!} alt={r.nationality} className="w-5 h-3.5 object-cover border border-[#ebebeb]" /> : null}</span>,
      guessed: Math.min(validIds, target),
      total: target,
    };
  });

  const totalGuessed = rounds.filter((r) => (roundStates[r.nationality]?.guessedIds.size ?? 0) >= r.roundSize).length;
  const totalPlayers = rounds.length;

  const filteredProgress = progressRounds.map((r, i) => ({ r, i })).filter(({ i }) => !progressSearch.trim() || rounds[i].nationality.toLowerCase().includes(progressSearch.toLowerCase()));
  const filteredProgressRounds = filteredProgress.map((d) => d.r);
  const filteredOriginalIndices = filteredProgress.map((d) => d.i);

  const players = currentState?.players ?? null;
  const target = currentRound?.roundSize ?? 5;
  const validGuessedIds = players ? new Set(players.filter((p) => currentState!.guessedIds.has(p.id)).map((p) => p.id)) : (currentState?.guessedIds ?? new Set<number>());
  const guessedCount = validGuessedIds.size;
  const isDone = guessedCount >= target;
  const foundPlayers: (Player | null)[] = Array.from({ length: target }, (_, i) => {
    if (!players) return null;
    return players.filter((p) => validGuessedIds.has(p.id))[i] ?? null;
  });

  const flagUrl = currentRound ? nationalityToFlagUrl(currentRound.nationality) : null;

  if (loading) return <div className="h-dvh flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  if (error || rounds.length === 0) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 bg-gray-50 px-6">
        <p className="text-gray-500 text-sm text-center">{error ?? "No rounds scheduled yet"}</p>
        <button onClick={() => (window.location.href = "/")} className="text-sm text-blue-600 underline">Back to games</button>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      <div className="bg-[#1a1a2e] flex items-center justify-between px-3 py-2 shrink-0">
        <button className="text-white p-1" onClick={() => (window.location.href = "/")}><Home size={22} /></button>
        <span className="text-white font-bold text-sm tracking-widest uppercase">Foreigners</span>
        <button className="text-white p-1" onClick={() => setShowProgress((v) => !v)}>{showProgress ? <X size={20} /> : <Trophy size={20} />}</button>
      </div>

      {showProgress ? (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
          <div className="flex-1 overflow-y-auto">
            <OverallProgressScreen
              totalGuessed={totalGuessed}
              totalPlayers={totalPlayers}
              rounds={filteredProgressRounds}
              onRoundClick={(i) => { setRoundIndex(filteredOriginalIndices[i]); setShowProgress(false) }}
              label="completed"
            />
          </div>
          <div className="shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
            <input type="text" value={progressSearch} onChange={(e) => setProgressSearch(e.target.value)} placeholder="Filter by country…" autoComplete="off" autoCorrect="off" spellCheck={false} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400" style={{ fontSize: "16px" }} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
            {currentRound && (
              <div className="px-3 pt-4 pb-2 flex flex-col gap-3">
                <div className="bg-white rounded-2xl border border-gray-200 px-4 pt-3 pb-4 flex flex-col items-center gap-3">
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Foreigners in England</span>
                  {flagUrl && <img src={flagUrl} alt={currentRound.nationality} className="w-16 h-12 object-cover rounded-md border border-gray-200" />}
                  <span className="text-gray-800 font-bold text-lg">{currentRound.nationality}</span>
                  <span className="text-gray-400 text-[11px] text-center">Name {target} {currentRound.nationality} players who played for an English club</span>
                </div>

                {players === null ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {foundPlayers.map((player, i) => <PlayerSlot key={i} index={i} player={player} />)}
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
              {wrongGuessMsg && <div className="mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600 text-center animate-pulse">{wrongGuessMsg}</div>}
              {!isDone && (
                <div className="mb-3">
                  <GuessSearchInput inputRef={inputRef} disabled={verifying} getKey={(f) => f.id} getLabel={(f) => f.name} getStatus={guessStatus} onSelect={(name, item) => submitGuess(name, item?.id ?? null)} />
                </div>
              )}
              <div className="relative flex items-center justify-between pt-1">
                <button onClick={() => setRoundIndex((i) => Math.max(0, i - 1))} disabled={roundIndex === 0} className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"><ChevronLeft size={16} />Previous</button>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 text-xs font-mono">
                  <span><span className="text-white">#{roundIndex + 1}</span><span className="text-white/50">/{rounds.length}</span></span>
                  <button onClick={handleRandom} className="text-white/40 hover:text-white transition-colors"><Shuffle size={13} /></button>
                </div>
                <button onClick={() => setRoundIndex((i) => Math.min(rounds.length - 1, i + 1))} disabled={roundIndex === rounds.length - 1} className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30">Next<ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
