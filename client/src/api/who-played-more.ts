import { getExcludeParam, recordPlayed } from "@/lib/recentPlayers";

export interface WpmPlayer {
  id: number;
  name: string;
  wikipedia_url: string;
  photo_url: string | null;
  apps: number;
}

export interface WpmPair {
  player1: WpmPlayer;
  player2: WpmPlayer;
  club: string;
  club_wikipedia_url: string | null;
}

export interface WpmLeaderboardEntry {
  id: number;
  player_name: string;
  time_ms: number;
  created_at: string;
}

export async function getWpmSession(): Promise<WpmPair[]> {
  const exclude = getExcludeParam("wpm");
  const res = await fetch(
    `/api/who-played-more/session${exclude ? `?exclude=${exclude}` : ""}`,
  );
  if (!res.ok) throw new Error("Failed to load session");
  const data: { pairs: WpmPair[] } = await res.json();
  const allIds = data.pairs.flatMap((p) => [p.player1.id, p.player2.id]);
  recordPlayed("wpm", allIds);
  return data.pairs;
}

export async function submitWpmScore(
  player_name: string,
  time_ms: number,
): Promise<WpmLeaderboardEntry> {
  const res = await fetch("/api/wpm-leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_name, time_ms }),
  });
  if (!res.ok) throw new Error("Failed to submit score");
  return res.json();
}

export async function getWpmLeaderboard(): Promise<WpmLeaderboardEntry[]> {
  const res = await fetch("/api/wpm-leaderboard");
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return res.json();
}
