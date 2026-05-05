import { useState, useEffect, useRef } from "react";
import { Home, ChevronRight, Trophy, Loader2 } from "lucide-react";
import {
  getWsmSession,
  submitWsmScore,
  getWsmLeaderboard,
} from "@/api/who-scored-more";
import type { WsmPlayer, WsmLeaderboardEntry } from "@/api/who-scored-more";
import { PlayerAvatar } from "@/components/PlayerAvatar";

type GameStatus = "lobby" | "playing" | "correct" | "wrong" | "won";
type View = "game" | "leaderboard";

const PARTICLES = new Set([
  "van",
  "de",
  "von",
  "dos",
  "da",
  "di",
  "del",
  "della",
  "le",
  "la",
  "el",
]);

function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  if (parts.length >= 3 && PARTICLES.has(secondLast.toLowerCase()))
    return `${secondLast} ${last}`;
  return last;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function WhoScoredMorePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<WsmPlayer[]>([]);
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

  // Clean up interval on unmount
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
    setPlayers([]);
    getWsmSession()
      .then((data) => setPlayers(data))
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

  function handleGuess(guess: "more" | "less") {
    if (status !== "playing" || players.length === 0) return;
    const current = players[currentIndex];
    const challenger = players[currentIndex + 1];
    const correct =
      (guess === "more" && challenger.total_goals >= current.total_goals) ||
      (guess === "less" && challenger.total_goals <= current.total_goals);

    if (correct) {
      const isLast = currentIndex === players.length - 2;
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

  const current = players[currentIndex];
  const challenger = players[currentIndex + 1];

  return (
    <div className="h-dvh flex flex-col w-full max-w-[400px] mx-auto font-sans">
      {/* Header */}
      <div className="bg-[#1a1a2e] flex items-center justify-between px-3 py-2 shrink-0">
        <button
          className="text-white p-1"
          onClick={() => (window.location.href = "/play")}
        >
          <Home size={22} />
        </button>
        <span className="text-white font-bold text-sm tracking-widest uppercase">
          Who Scored More?
        </span>
        <div className="flex items-center gap-2">
          {players.length > 0 &&
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
                    Who Scored More?
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    10 rounds · Timer starts when you're ready
                  </p>
                </div>
                <button
                  onClick={handleStart}
                  className="bg-[#1a1a2e] text-white font-bold text-sm tracking-widest uppercase px-10 py-3 rounded-xl"
                >
                  Start
                </button>
              </div>
            )}

            {!loading && !error && status === "won" && (
              <WonScreen
                players={players}
                elapsedMs={elapsedMs}
                onPlayAgain={loadSession}
              />
            )}

            {!loading &&
              !error &&
              status !== "won" &&
              status !== "lobby" &&
              current &&
              challenger && (
                <div className="flex-1 flex flex-col justify-center px-4 py-6 gap-4">
                  <PlayerCard
                    player={current}
                    goalsVisible={true}
                    goalsStyle="neutral"
                    onClick={
                      status === "playing"
                        ? () => handleGuess("less")
                        : undefined
                    }
                  />
                  <div className="flex items-center justify-center py-1">
                    <span className="text-gray-400 text-xs uppercase tracking-widest font-semibold">
                      or
                    </span>
                  </div>
                  <PlayerCard
                    player={challenger}
                    goalsVisible={status !== "playing"}
                    goalsStyle={
                      status === "correct"
                        ? "green"
                        : status === "wrong"
                          ? "red"
                          : "neutral"
                    }
                    onClick={
                      status === "playing"
                        ? () => handleGuess("more")
                        : undefined
                    }
                  />
                </div>
              )}
          </>
        )}
      </div>

      {/* Bottom panel */}
      {view === "game" &&
        !loading &&
        !error &&
        status !== "won" &&
        status !== "lobby" && (
          <div className="bg-[#1a1a2e] shrink-0 px-3 pt-3 pb-4">
            {status === "playing" && current && challenger && (
              <div className="flex flex-col gap-2">
                <p className="text-white/60 text-xs text-center uppercase tracking-widest font-semibold">
                  Who scored more?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleGuess("less")}
                    className="flex-1 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                  >
                    {getLastName(current.name)}
                  </button>
                  <button
                    onClick={() => handleGuess("more")}
                    className="flex-1 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                  >
                    {getLastName(challenger.name)}
                  </button>
                </div>
              </div>
            )}
            {status === "correct" && (
              <button
                onClick={handleContinue}
                className="w-full flex items-center justify-center gap-1 bg-white text-[#1a1a2e] text-sm font-bold py-3 rounded-xl"
              >
                Continue
                <ChevronRight size={16} />
              </button>
            )}
            {status === "wrong" && (
              <div className="flex flex-col gap-2">
                <p className="text-white/60 text-xs text-center">
                  Wrong — {players[currentIndex + 1]?.name} scored{" "}
                  {players[currentIndex + 1]?.total_goals} goals
                </p>
                <button
                  onClick={loadSession}
                  className="w-full flex items-center justify-center bg-white text-[#1a1a2e] text-sm font-bold py-3 rounded-xl"
                >
                  Play Again
                </button>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

function PlayerCard({
  player,
  goalsVisible,
  goalsStyle,
  onClick,
}: {
  player: WsmPlayer;
  goalsVisible: boolean;
  goalsStyle: "neutral" | "green" | "red";
  onClick?: () => void;
}) {
  const goalsColor =
    goalsStyle === "green"
      ? "text-green-500"
      : goalsStyle === "red"
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
        storedPhotoUrl={player.stored_photo_url}
        wikipediaUrl={player.wikipedia_url}
        size="md"
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-base leading-tight truncate">
          {player.name}
        </p>
        <p className={`text-3xl font-bold mt-1 ${goalsColor}`}>
          {goalsVisible ? player.total_goals : "???"}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Career Goals</p>
      </div>
    </div>
  );
}

function WonScreen({
  players,
  elapsedMs,
  onPlayAgain,
}: {
  players: WsmPlayer[];
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
      await submitWsmScore(name.trim(), elapsedMs);
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
        {players.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-gray-400 text-xs font-mono shrink-0">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-gray-800 truncate">
                {p.name}
              </span>
            </div>
            <span className="text-sm font-bold text-gray-600 shrink-0 ml-2">
              ⚽ {p.total_goals}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onPlayAgain}
        className="bg-[#1a1a2e] text-white font-bold text-sm tracking-widest uppercase px-8 py-3 rounded-xl"
      >
        Play Again
      </button>
    </div>
  );
}

function LeaderboardView({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<WsmLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getWsmLeaderboard()
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
