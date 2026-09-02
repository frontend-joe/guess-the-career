import { useState, useEffect, useRef } from "react";
import { ChevronRight, Trophy, Loader2 } from "lucide-react";
import { GameMenu } from "@/components/GameMenu";
import {
  getWpmSession,
  submitWpmScore,
  getWpmLeaderboard,
} from "@/api/who-played-more";
import type { WpmPair, WpmLeaderboardEntry } from "@/api/who-played-more";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { GameSettingsButton } from "@/components/GameSettingsButton";

type GameStatus = "lobby" | "playing" | "correct" | "wrong" | "won";
type View = "game" | "leaderboard";


function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function WhoPlayedMorePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<WpmPair[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<GameStatus>("lobby");
  const [view, setView] = useState<View>("game");

  // Timer
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current!);
    }, 100);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (startTimeRef.current) setElapsedMs(Date.now() - startTimeRef.current);
  }

  function resetTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
    setElapsedMs(0);
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  function loadSession() {
    resetTimer();
    setLoading(true);
    setError(null);
    setCurrentIndex(0);
    setStatus("lobby");
    setPairs([]);
    getWpmSession()
      .then((data) => setPairs(data))
      .catch(() => setError("Failed to load session. Please try again."))
      .finally(() => setLoading(false));
  }

  function handleStart() {
    startTimer();
    setStatus("playing");
  }

  useEffect(() => {
    loadSession();
  }, []);

  function handleGuess(picked: "player1" | "player2") {
    if (status !== "playing" || pairs.length === 0) return;
    const pair = pairs[currentIndex];
    const correct =
      picked === "player1"
        ? pair.player1.apps >= pair.player2.apps
        : pair.player2.apps >= pair.player1.apps;

    if (correct) {
      const isLast = currentIndex === pairs.length - 1;
      if (isLast) stopTimer();
      setStatus(isLast ? "won" : "correct");
    } else {
      setStatus("wrong");
    }
  }

  function handleContinue() {
    setCurrentIndex((i) => i + 1);
    setStatus("playing");
  }

  const pair = pairs[currentIndex];

  // Fetch the club logo once per pair (shared by both player cards)
  const [clubLogoUrl, setClubLogoUrl] = useState<string | false | null>(null);
  useEffect(() => {
    const url = pair?.club_wikipedia_url;
    if (!url) { setClubLogoUrl(false); return; }
    const title = url.split("/wiki/")[1];
    if (!title) { setClubLogoUrl(false); return; }
    setClubLogoUrl(null);
    const controller = new AbortController();
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setClubLogoUrl(data?.thumbnail?.source ?? false))
      .catch((err) => { if (err.name !== "AbortError") setClubLogoUrl(false); });
    return () => controller.abort();
  }, [pair?.club_wikipedia_url]);

  return (
    <div className="h-dvh flex flex-col w-full max-w-100 mx-auto font-sans">
      {/* Header */}
      <div className="bg-[#0b0c1a] divide-soft-b flex items-center justify-between px-3 py-2.5 shrink-0">
        <GameMenu />
        <span className="text-white font-display text-sm tracking-wide uppercase">
          Who Played More?
        </span>
        <div className="flex items-center gap-2">
          {pairs.length > 0 &&
            status !== "won" &&
            status !== "lobby" &&
            view === "game" && (
              <span className="text-white/60 text-sm font-mono">
                {formatTime(elapsedMs)}
              </span>
            )}
          <button
            className={`p-1 transition-colors ${view === "leaderboard" ? "text-yellow-400" : "text-white/60 hover:text-white"}`}
            onClick={() =>
              setView((v) => (v === "leaderboard" ? "game" : "leaderboard"))
            }
          >
            <Trophy size={20} />
          </button>
          <GameSettingsButton gameKey="who_played_more" />
        </div>
      </div>

      {/* Scrollable area */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 flex flex-col">
        {view === "leaderboard" && (
          <LeaderboardView onBack={() => setView("game")} />
        )}

        {view === "game" && (
          <>
            {loading && (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Loading session…
              </div>
            )}

            {error && (
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

            {!loading && !error && status === "lobby" && (
              <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
                <div>
                  <Trophy size={44} className="text-yellow-500 mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-gray-800">
                    Who Played More?
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    10 rounds · Timer starts when you're ready
                  </p>
                </div>
                <button
                  onClick={handleStart}
                  className="bg-[#1a1a2e] text-white font-display text-sm tracking-wide uppercase px-10 py-3 rounded-xl"
                >
                  Start
                </button>
              </div>
            )}

            {!loading && !error && status === "won" && (
              <WonScreen
                pairs={pairs}
                elapsedMs={elapsedMs}
                onPlayAgain={loadSession}
              />
            )}

            {!loading &&
              !error &&
              status !== "won" &&
              status !== "lobby" &&
              pair && (
                <div className="flex-1 flex flex-col justify-center px-4 py-6 gap-4">
                  <PlayerCard
                    player={pair.player1}
                    club={pair.club}
                    clubLogoUrl={clubLogoUrl}
                    appsVisible={status !== "playing"}
                    appsStyle={
                      status === "playing" ? "neutral" : pair.player1.apps >= pair.player2.apps ? "green" : "red"
                    }
                    onClick={
                      status === "playing"
                        ? () => handleGuess("player1")
                        : undefined
                    }
                  />
                  <div className="flex items-center justify-center h-10">
                    {status === "playing" && (
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest text-center">
                        Who played more for {pair.club}?
                      </p>
                    )}
                    {status === "correct" && (
                      <button
                        onClick={handleContinue}
                        className="w-full h-full flex items-center justify-center gap-1 bg-[#1a1a2e] text-white text-xs font-bold rounded-lg"
                      >
                        Continue
                        <ChevronRight size={12} />
                      </button>
                    )}
                    {status === "wrong" && (
                      <button
                        onClick={loadSession}
                        className="w-full h-full flex items-center justify-center bg-[#1a1a2e] text-white text-xs font-bold rounded-lg"
                      >
                        Play Again
                      </button>
                    )}
                  </div>
                  <PlayerCard
                    player={pair.player2}
                    club={pair.club}
                    clubLogoUrl={clubLogoUrl}
                    appsVisible={status !== "playing"}
                    appsStyle={
                      status === "playing" ? "neutral" : pair.player2.apps >= pair.player1.apps ? "green" : "red"
                    }
                    onClick={
                      status === "playing"
                        ? () => handleGuess("player2")
                        : undefined
                    }
                  />
                </div>
              )}
          </>
        )}
      </div>

    </div>
  );
}

function ClubBadge({ club, logoUrl }: { club: string; logoUrl: string | false | null }) {
  return (
    <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
      {logoUrl === null && <div className="w-10 h-10 rounded bg-gray-100 animate-pulse" />}
      {logoUrl === false && <span className="text-lg font-bold text-gray-300">{club.charAt(0)}</span>}
      {logoUrl && <img src={logoUrl} alt={club} className="w-12 h-12 object-contain p-0.5" />}
    </div>
  );
}

function PlayerCard({
  player,
  club,
  clubLogoUrl,
  appsVisible,
  appsStyle,
  onClick,
}: {
  player: { id: number; name: string; wikipedia_url: string; photo_url: string | null; apps: number };
  club: string;
  clubLogoUrl: string | false | null;
  appsVisible: boolean;
  appsStyle: "neutral" | "green" | "red";
  onClick?: () => void;
}) {
  const appsColor =
    appsStyle === "green"
      ? "text-green-500"
      : appsStyle === "red"
        ? "text-red-500"
        : "text-gray-900";

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${onClick ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}`}
    >
      <PlayerAvatar
        id={player.id}
        name={player.name}
        storedPhotoUrl={player.photo_url ?? undefined}
        wikipediaUrl={player.wikipedia_url}
        size="md"
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-base leading-tight truncate">
          {player.name}
        </p>
        <p className={`text-3xl font-bold mt-1 ${appsColor}`}>
          {appsVisible ? player.apps : "???"}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Apps at {club}</p>
      </div>
      <ClubBadge club={club} logoUrl={clubLogoUrl} />
    </div>
  );
}

function WonScreen({
  pairs,
  elapsedMs,
  onPlayAgain,
}: {
  pairs: WpmPair[];
  elapsedMs: number;
  onPlayAgain: () => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitWpmScore(name.trim(), elapsedMs);
      setSubmitted(true);
    } catch {
      setSubmitError("Failed to save score. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-5">
      <div className="text-center">
        <Trophy size={40} className="text-yellow-500 mx-auto mb-2" />
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
          Perfect!
        </p>
        <p className="text-5xl font-bold text-green-500 mt-2">10 / 10</p>
        <p className="text-lg font-mono font-bold text-gray-500 mt-2">
          ⏱ {formatTime(elapsedMs)}
        </p>
      </div>

      {/* Leaderboard submission */}
      <div className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
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
              className="w-full flex items-center justify-center gap-2 bg-[#1a1a2e] text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-40 transition-opacity"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Submit to Leaderboard
            </button>
          </>
        )}
      </div>

      <div className="w-full flex flex-col gap-2">
        {pairs.map((pair, i) => {
          const winner =
            pair.player1.apps >= pair.player2.apps ? pair.player1 : pair.player2;
          const loser =
            pair.player1.apps >= pair.player2.apps ? pair.player2 : pair.player1;
          return (
            <div
              key={i}
              className="bg-white rounded-lg px-3 py-2 border border-gray-100"
            >
              <p className="text-xs text-gray-400 mb-1">{pair.club}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-sm font-semibold text-green-600 truncate">
                    {winner.name}
                  </span>
                  <span className="text-sm font-bold text-gray-500 shrink-0">
                    {winner.apps}
                  </span>
                </div>
                <span className="text-xs text-gray-300 shrink-0">vs</span>
                <div className="flex items-center gap-1 min-w-0 justify-end">
                  <span className="text-sm font-bold text-gray-400 shrink-0">
                    {loser.apps}
                  </span>
                  <span className="text-sm text-gray-400 truncate">
                    {loser.name}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onPlayAgain}
        className="bg-[#1a1a2e] text-white font-display text-sm tracking-wide uppercase px-8 py-3 rounded-xl"
      >
        Play Again
      </button>
    </div>
  );
}

function LeaderboardView({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<WpmLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getWpmLeaderboard()
      .then(setEntries)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col flex-1 px-4 py-6">
      <div className="flex items-center gap-2 mb-5">
        <Trophy size={20} className="text-yellow-500 shrink-0" />
        <h2 className="text-base font-bold text-gray-800">Leaderboard</h2>
      </div>

      {loading && (
        <div className="flex items-center justify-center flex-1 gap-2 text-gray-400 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading…
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm text-center mt-8">
          Failed to load leaderboard.
        </p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-gray-400 text-sm text-center mt-8">
          No scores yet — be the first!
        </p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`text-sm font-bold shrink-0 w-6 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-gray-300"}`}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-gray-800 truncate">
                  {entry.player_name}
                </span>
              </div>
              <span className="text-sm font-mono font-bold text-gray-600 shrink-0 ml-2">
                {formatTime(entry.time_ms)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onBack}
        className="mt-6 w-full bg-[#1a1a2e] text-white font-bold text-sm py-3 rounded-xl"
      >
        Back to Game
      </button>
    </div>
  );
}
