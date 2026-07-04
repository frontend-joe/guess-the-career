import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { Loader2, ChevronLeft, ChevronRight, Shuffle, Check } from "lucide-react";
import { GameMenu } from "@/components/GameMenu";
import { GuessSearchInput } from "@/components/GuessSearchInput";
import { NationalityFlag } from "@/components/NationalityFlag";
import { MiniClubBadge } from "@/components/MiniClubBadge";
import { PositionBadge } from "@/components/PositionBadge";
import { getFootballerCard, type FootballerCard, type CardStint } from "@/api/footballers";
import { getBookendsScheduleRounds, type BookendsScheduleRound } from "@/api/bookends-schedule";

// ─── localStorage ─────────────────────────────────────────────────────────────
const PROGRESS_KEY = "bookends_progress";
function loadProgress(): { solved: number[]; givenUp: number[] } {
  try { const raw = localStorage.getItem(PROGRESS_KEY); return raw ? JSON.parse(raw) : { solved: [], givenUp: [] } } catch { return { solved: [], givenUp: [] } }
}
function saveProgress(solved: Set<number>, givenUp: Set<number>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ solved: [...solved], givenUp: [...givenUp] }));
}

// ─── Card helpers (mirrors PlayerInfoModal) ───────────────────────────────────
function formatDob(born: string | null): string | null {
  if (!born) return null;
  const m = born.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return born;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return born;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function formatHeight(cm: number | null): string | null {
  if (!cm) return null;
  const totalInches = Math.round(cm / 2.54);
  const ft = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${(cm / 100).toFixed(2)} m (${ft} ft ${inches} in)`;
}
function appsGoals(s: CardStint): string {
  const apps = s.apps ?? 0;
  return s.goals != null ? `${apps} (${s.goals})` : `${apps}`;
}
function clubParts(club: string): { name: string; tag: "loan" | "trial" | null } {
  const isLoan = club.startsWith("→") || /\(loan\)/i.test(club);
  const isTrial = /\(trial\)/i.test(club);
  const name = club.replace(/^→\s*/, "").replace(/\s*\((loan|trial)\)/gi, "").trim();
  return { name, tag: isLoan ? "loan" : isTrial ? "trial" : null };
}

function CareerTable({ title, stints, international }: { title: string; stints: CardStint[]; international?: boolean }) {
  if (stints.length === 0) return null;
  return (
    <div>
      <div className="bg-gray-100 text-gray-700 text-left px-3 font-display text-sm tracking-tight py-1.5 border-y border-gray-200">{title}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400">
            <th className="text-left font-medium px-3 py-1 w-16">Years</th>
            <th className="text-left font-medium px-1 py-1">Team</th>
            <th className="text-right font-medium px-3 py-1 whitespace-nowrap">{international ? "Caps (Gls)" : "Apps (Gls)"}</th>
          </tr>
        </thead>
        <tbody>
          {stints.map((s, i) => {
            const { name, tag } = clubParts(s.club);
            return (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-1.5 text-gray-500 tabular-nums align-top whitespace-nowrap">{s.years}</td>
                <td className="px-1 py-1.5">
                  <span className="flex items-center gap-1.5">
                    {tag === "loan" && <span className="text-gray-500 shrink-0">→</span>}
                    {!international && tag !== "loan" && <MiniClubBadge club={name} wikipediaUrl={s.club_wikipedia_url} size={16} />}
                    <span className="text-gray-800">{name}{tag && ` (${tag})`}</span>
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums align-top">{appsGoals(s)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BioRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <tr className="border-t border-gray-100 align-top">
      <th className="text-left font-semibold text-gray-500 px-3 py-1.5 w-28">{label}</th>
      <td className="px-3 py-1.5 text-gray-800">{value}</td>
    </tr>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function BookendsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rounds, setRounds] = useState<BookendsScheduleRound[]>([]);
  const [index, setIndex] = useState(0);
  const [card, setCard] = useState<FootballerCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [wrong, setWrong] = useState<string[]>([]);
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const [givenUp, setGivenUp] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = loadProgress();
    setSolved(new Set(p.solved));
    setGivenUp(new Set(p.givenUp));
    getBookendsScheduleRounds()
      .then((data) => {
        setRounds(data);
        const n = parseInt(searchParams.get("n") ?? "1", 10);
        setIndex(Number.isFinite(n) ? Math.max(0, Math.min(n - 1, data.length - 1)) : 0);
      })
      .catch(() => setError("Failed to load schedule"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const round = rounds[index] ?? null;

  useEffect(() => {
    if (!round) return;
    setSearchParams({ n: String(index + 1) }, { replace: true });
    setCard(null);
    setWrong([]);
    setStatus("playing");
    getFootballerCard(round.footballerId)
      .then((c) => {
        setCard(c);
        if (solved.has(c.id)) setStatus("won");
        else if (givenUp.has(c.id)) setStatus("lost");
      })
      .catch(() => {});
  }, [index, round?.footballerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && status === "playing") setTimeout(() => inputRef.current?.focus(), 50);
  }, [index, loading, status]);

  const revealed = status !== "playing";

  function submitGuess(name: string, id: number | null) {
    if (!card || status !== "playing") return;
    const correct = (id != null && id === card.id) || name.trim().toLowerCase() === card.name.toLowerCase();
    if (correct) {
      setStatus("won");
      const next = new Set(solved); next.add(card.id); setSolved(next); saveProgress(next, givenUp);
    } else {
      setWrong((w) => [...w, name]);
    }
  }

  function quit() {
    if (!card || status !== "playing") return;
    setStatus("lost");
    const next = new Set(givenUp); next.add(card.id); setGivenUp(next); saveProgress(solved, next);
  }

  const senior = card?.stints.filter((s) => s.stint_type === "senior") ?? [];
  const intl = card?.stints.filter((s) => s.stint_type === "international") ?? [];

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      {/* Header */}
      <div className="bg-[#0b0c1a] divide-soft-b relative flex items-center justify-between px-3 py-2.5 shrink-0">
        <GameMenu />
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-display text-sm tracking-wide uppercase">Bookend Players</span>
        {rounds.length > 0 && <span className="text-white/60 text-sm font-mono">{index + 1} / {rounds.length}</span>}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
        ) : error || rounds.length === 0 ? (
          <div className="flex items-center justify-center h-full px-6"><p className="text-gray-500 text-sm text-center">{error ?? "No rounds scheduled yet."}</p></div>
        ) : !card ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
        ) : (
          <div className="px-3 pt-3 pb-2">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Photo + name header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-display text-xl text-gray-900 leading-tight tracking-tight">
                  {revealed ? card.name : "Mystery player"}
                </h2>
              </div>

              {/* Bio (no full name — it'd give it away) */}
              <table className="w-full text-sm">
                <tbody>
                  <BioRow label="Nationality" value={card.nationality ? <span className="flex items-center gap-1.5"><NationalityFlag nationality={card.nationality} size={14} />{card.nationality}</span> : null} />
                  <BioRow label="Date of birth" value={formatDob(card.born)} />
                  <BioRow label="Birth place" value={card.birthplace} />
                  <BioRow label="Height" value={formatHeight(card.height_cm)} />
                  <BioRow label="Position" value={card.position ? <span className="flex items-center gap-1.5"><PositionBadge position={card.position} />{card.position}</span> : null} />
                </tbody>
              </table>

              <div className="pb-2">
                <CareerTable title="Senior career" stints={senior} />
                <CareerTable title="International career" stints={intl} international />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      {!loading && !error && rounds.length > 0 && card && (
        <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
          {status === "won" && (
            <p className="text-xs mb-2 text-green-400 flex items-center gap-1"><Check size={14} />Correct! It was {card.name}</p>
          )}
          {status === "lost" && (
            <p className="text-xs mb-2 text-red-400">It was {card.name}</p>
          )}

          {status === "playing" && wrong.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {wrong.map((g, i) => (
                <span key={i} className="text-[11px] bg-red-500/20 text-red-300 rounded px-1.5 py-0.5 line-through">{g}</span>
              ))}
            </div>
          )}

          {status === "playing" && (
            <div className="mb-3 flex items-center gap-2">
              <div className="flex-1">
                <GuessSearchInput
                  inputRef={inputRef}
                  getKey={(f) => f.id}
                  getLabel={(f) => f.name}
                  getStatus={() => null}
                  onSelect={(name, item) => submitGuess(name, item?.id ?? null)}
                />
              </div>
              <button onClick={quit} className="text-white/60 hover:text-white text-xs font-bold uppercase tracking-wide px-2 shrink-0">Quit</button>
            </div>
          )}

          {/* Nav row */}
          <div className="relative flex items-center justify-between pt-1">
            <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30"><ChevronLeft size={16} />Previous</button>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 text-xs font-mono">
              <span><span className="text-white">#{index + 1}</span><span className="text-white/50">/{rounds.length}</span></span>
              <button onClick={() => setIndex(Math.floor(Math.random() * rounds.length))} className="text-white/40 hover:text-white transition-colors"><Shuffle size={13} /></button>
            </div>
            <button onClick={() => setIndex((i) => Math.min(rounds.length - 1, i + 1))} disabled={index === rounds.length - 1} className="flex items-center gap-0.5 text-white text-sm font-bold uppercase tracking-wide disabled:opacity-30">Next<ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
