import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { GameMenu } from "@/components/GameMenu";
import { GuessSearchInput } from "@/components/GuessSearchInput";
import { NationalityFlag } from "@/components/NationalityFlag";
import { PositionBadge } from "@/components/PositionBadge";
import { MiniClubBadge } from "@/components/MiniClubBadge";
import { useShowPlayer } from "@/contexts/PlayerModalContext";
import { getAnswers, type DualNationalityPlayer } from "@/api/dual-nationality";
import { useCompactMode } from "@/contexts/CompactModeContext";
import { useSettings } from "@/contexts/SettingsContext";
import { GameSettingsButton } from "@/components/GameSettingsButton";

// ─── localStorage ─────────────────────────────────────────────────────────────
const PROGRESS_KEY = "dual_nationality_progress";
interface SavedProgress {
  guessedIds: number[];
  wrongGuesses?: string[];
}
function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : { guessedIds: [] };
  } catch {
    return { guessedIds: [] };
  }
}
function saveProgress(guessedIds: Set<number>, wrongGuesses: Set<string>) {
  localStorage.setItem(
    PROGRESS_KEY,
    JSON.stringify({ guessedIds: [...guessedIds], wrongGuesses: [...wrongGuesses] }),
  );
}

// ─── Name matching ────────────────────────────────────────────────────────────
const TRANSLITERATE: Record<string, string> = {
  ı: "i", ł: "l", ø: "o", đ: "d", ð: "d", æ: "a", œ: "o", ħ: "h", ŋ: "n", ŧ: "t", þ: "th", ß: "ss",
};
const TRANSLIT_RE = /[ıłøđðæœħŋŧþß]/g;
function normalizeGuess(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(TRANSLIT_RE, (c) => TRANSLITERATE[c] ?? c).trim();
}
function damerauDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
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

// ─── Player row ───────────────────────────────────────────────────────────────
function PlayerRow({ player, guessed }: { player: DualNationalityPlayer; guessed: boolean }) {
  const showPlayer = useShowPlayer();
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border transition-colors ${guessed ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
      <span className="flex items-center gap-1.5 shrink-0">
        {player.nations.map((n, i) => (
          <NationalityFlag key={i} nationality={n.name} size={16} />
        ))}
        {player.position && <PositionBadge position={player.position} />}
      </span>
      {guessed ? (
        <button
          type="button"
          onClick={() => showPlayer(player.footballerId)}
          className="text-sm font-semibold text-gray-800 truncate text-left hover:underline flex-1"
        >
          {player.name}
        </button>
      ) : (
        <div className="h-px bg-gray-200 flex-1 rounded-full" />
      )}
      {(player.clubName || player.clubYears) && (
        <span className="flex items-center gap-1.5 shrink-0">
          {player.clubName && <MiniClubBadge club={player.clubName} wikipediaUrl={player.clubWikiUrl} />}
          {player.clubYears && <span className="text-xs text-gray-400 tabular-nums">{player.clubYears}</span>}
        </span>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function DualNationalityPage() {
  const { compact } = useCompactMode();
  const { requiredToPass } = useSettings("dual_nationality");
  const [players, setPlayers] = useState<DualNationalityPlayer[] | null>(null);
  const [guessedIds, setGuessedIds] = useState<Set<number>>(new Set());
  const [wrongGuesses, setWrongGuesses] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAnswers()
      .then((data) => {
        // Stable order: primary nation, then name.
        data.sort((a, b) => (a.nations[0]?.name ?? "").localeCompare(b.nations[0]?.name ?? "") || a.name.localeCompare(b.name));
        setPlayers(data);
        const saved = loadProgress();
        setGuessedIds(new Set(saved.guessedIds));
        setWrongGuesses(new Set(saved.wrongGuesses ?? []));
      })
      .catch(() => setError("Failed to load players"));
  }, []);

  useEffect(() => {
    if (players && !error) setTimeout(() => inputRef.current?.focus(), 50);
  }, [players, error]);

  function submitGuess(name: string) {
    if (!players) return;
    const matched = players.filter((p) => !guessedIds.has(p.footballerId) && matchesPlayer(name, p.name));
    if (matched.length > 0) {
      const next = new Set(guessedIds);
      matched.forEach((p) => next.add(p.footballerId));
      setGuessedIds(next);
      saveProgress(next, wrongGuesses);
    } else {
      const next = new Set(wrongGuesses);
      next.add(normalizeGuess(name));
      setWrongGuesses(next);
      saveProgress(guessedIds, next);
    }
  }

  function guessStatus(s: { id: number; name: string }) {
    if (!players) return null;
    if (players.some((p) => guessedIds.has(p.footballerId) && matchesPlayer(s.name, p.name))) return "correct" as const;
    if (wrongGuesses.has(normalizeGuess(s.name))) return "incorrect" as const;
    return null;
  }

  const total = players?.length ?? 0;
  const guessedCount = players ? players.filter((p) => guessedIds.has(p.footballerId)).length : 0;
  const passTarget = requiredToPass(total);
  const shownGuessed = Math.min(guessedCount, passTarget);
  const isDone = total > 0 && guessedCount >= passTarget;

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      {/* Header */}
      <div className="bg-[#0b0c1a] divide-soft-b relative flex items-center justify-between px-3 py-2.5 shrink-0">
        <GameMenu />
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-display text-sm tracking-wide uppercase">Dual Nationality</span>
        <GameSettingsButton gameKey="dual_nationality" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
            <p className="text-gray-500 text-sm text-center">{error}</p>
            <button onClick={() => (window.location.href = "/")} className="text-sm text-blue-600 underline">Back to games</button>
          </div>
        ) : players === null ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-gray-300" size={28} />
          </div>
        ) : total === 0 ? (
          <div className="flex items-center justify-center h-full px-6">
            <p className="text-gray-500 text-sm text-center">No players added yet — check back soon.</p>
          </div>
        ) : (
          <div className={`px-3 pt-4 pb-2 flex flex-col gap-2${compact ? " mt-auto" : ""}`}>
            {players.map((p) => (
              <PlayerRow key={p.footballerId} player={p} guessed={guessedIds.has(p.footballerId)} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom panel */}
      {players !== null && total > 0 && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
          <p className={`text-xs mb-2 ${guessedCount > 0 ? "text-green-400" : "text-white/50"}`}>
            {isDone ? `All ${passTarget} found! ✓` : `${shownGuessed} / ${passTarget} found`}
          </p>
          {!isDone && (
            <GuessSearchInput autoScrape={false}
              inputRef={inputRef}
              getKey={(f) => f.id}
              getLabel={(f) => f.name}
              getStatus={guessStatus}
              onSelect={(name) => submitGuess(name)}
            />
          )}
        </div>
      )}
    </div>
  );
}
