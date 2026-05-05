import { getExcludeParam, recordPlayed } from "@/lib/recentPlayers";

export interface WsmPlayer {
  id: number;
  name: string;
  wikipedia_url: string;
  stored_photo_url: string;
  total_goals: number;
}

export interface WsmLeaderboardEntry {
  id: number;
  player_name: string;
  time_ms: number;
  created_at: string;
}

export async function getWsmSession(): Promise<WsmPlayer[]> {
  const exclude = getExcludeParam("wsm");
  const res = await fetch(
    `/api/who-scored-more/session${exclude ? `?exclude=${exclude}` : ""}`,
  );
  if (!res.ok) throw new Error("Failed to load session");
  const data: WsmPlayer[] = await res.json();
  recordPlayed(
    "wsm",
    data.map((p) => p.id),
  );
  return data;
}

export async function submitWsmScore(
  player_name: string,
  time_ms: number,
): Promise<WsmLeaderboardEntry> {
  const res = await fetch("/api/wsm-leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_name, time_ms }),
  });
  if (!res.ok) throw new Error("Failed to submit score");
  return res.json();
}

export async function getWsmLeaderboard(): Promise<WsmLeaderboardEntry[]> {
  const res = await fetch("/api/wsm-leaderboard");
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return res.json();
}
