import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { GameMenu } from "@/components/GameMenu";
import { GuessSearchInput } from "@/components/GuessSearchInput";
import { NationalityFlag } from "@/components/NationalityFlag";
import { PositionBadge } from "@/components/PositionBadge";
import { MiniClubBadge } from "@/components/MiniClubBadge";
import { useShowPlayer } from "@/contexts/PlayerModalContext";
import { getFamilyGame, type Family, type FamilyMember } from "@/api/football-families";

// ─── localStorage ─────────────────────────────────────────────────────────────
const PROGRESS_KEY = "football_families_progress";
function loadProgress(): { guessedIds: number[]; wrongGuesses?: string[] } {
  try { const raw = localStorage.getItem(PROGRESS_KEY); return raw ? JSON.parse(raw) : { guessedIds: [] } } catch { return { guessedIds: [] } }
}
function saveProgress(guessedIds: Set<number>, wrongGuesses: Set<string>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ guessedIds: [...guessedIds], wrongGuesses: [...wrongGuesses] }));
}

// ─── Name matching ────────────────────────────────────────────────────────────
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

// Display certain relationships as a symmetric family label.
function relationshipLabel(rel: string | null): string {
  if (!rel) return "Related";
  const r = rel.toLowerCase();
  if (r === "uncle" || r === "nephew") return "Uncle/nephew";
  if (r === "son" || r === "father" || r === "dad") return "Father/son";
  if (r === "brother") return "Brothers";
  if (r === "half-brother") return "Half-brothers";
  if (r === "cousin") return "Cousins";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

// ─── Member row ───────────────────────────────────────────────────────────────
function MemberRow({ m, guessed }: { m: FamilyMember; guessed: boolean }) {
  const showPlayer = useShowPlayer();
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${guessed ? "bg-green-50" : ""}`}>
      <span className="flex items-center gap-1.5 shrink-0">
        {m.nationality && <NationalityFlag nationality={m.nationality} size={16} />}
        {m.clubName && <MiniClubBadge club={m.clubName} wikipediaUrl={m.clubWikiUrl} />}
        {m.position && <PositionBadge position={m.position} />}
      </span>
      {guessed ? (
        <button type="button" onClick={() => showPlayer(m.footballerId)} className="text-sm font-semibold text-gray-800 truncate text-left hover:underline flex-1">
          {m.name}
        </button>
      ) : (
        <div className="h-px bg-gray-200 flex-1 rounded-full" />
      )}
      {m.years && <span className="text-xs text-gray-400 tabular-nums shrink-0">{m.years}</span>}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function FootballFamiliesPage() {
  const [families, setFamilies] = useState<Family[] | null>(null);
  const [guessedIds, setGuessedIds] = useState<Set<number>>(new Set());
  const [wrongGuesses, setWrongGuesses] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getFamilyGame()
      .then((data) => {
        setFamilies(data);
        const saved = loadProgress();
        setGuessedIds(new Set(saved.guessedIds));
        setWrongGuesses(new Set(saved.wrongGuesses ?? []));
      })
      .catch(() => setError("Failed to load game"));
  }, []);

  useEffect(() => {
    if (families && !error) setTimeout(() => inputRef.current?.focus(), 50);
  }, [families, error]);

  const allMembers = families?.flatMap((f) => f.members) ?? [];
  const uniqueIds = [...new Set(allMembers.map((m) => m.footballerId))];
  const total = uniqueIds.length;
  const guessedCount = uniqueIds.filter((id) => guessedIds.has(id)).length;
  const isDone = total > 0 && guessedCount >= total;

  function submitGuess(name: string) {
    const matched = allMembers.filter((m) => !guessedIds.has(m.footballerId) && matchesPlayer(name, m.name));
    if (matched.length > 0) {
      const next = new Set(guessedIds);
      matched.forEach((m) => next.add(m.footballerId));
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
    if (allMembers.some((m) => guessedIds.has(m.footballerId) && matchesPlayer(s.name, m.name))) return "correct" as const;
    if (wrongGuesses.has(normalizeGuess(s.name))) return "incorrect" as const;
    return null;
  }

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      <div className="bg-[#0b0c1a] divide-soft-b flex items-center justify-between px-3 py-2.5 shrink-0">
        <GameMenu />
        <span className="text-white font-display text-sm tracking-wide uppercase">Football Families</span>
        <span className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
            <p className="text-gray-500 text-sm text-center">{error}</p>
            <button onClick={() => (window.location.href = "/")} className="text-sm text-blue-600 underline">Back to games</button>
          </div>
        ) : families === null ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
        ) : total === 0 ? (
          <div className="flex items-center justify-center h-full px-6">
            <p className="text-gray-500 text-sm text-center">No families added yet — check back soon.</p>
          </div>
        ) : (
          <div className="px-3 pt-4 pb-2 flex flex-col gap-3">
            {families.map((f, i) => (
              <div key={i} className="relative mt-1">
                <span className="absolute -top-2 left-3 z-10 px-1.5 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {relationshipLabel(f.relationship)}
                </span>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                  {f.members.map((m) => (
                    <MemberRow key={m.footballerId} m={m} guessed={guessedIds.has(m.footballerId)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {families !== null && total > 0 && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
          <p className={`text-xs mb-2 ${guessedCount > 0 ? "text-green-400" : "text-white/50"}`}>
            {isDone ? `All ${total} found! ✓` : `${guessedCount} / ${total} found`}
          </p>
          {!isDone && (
            <GuessSearchInput
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
