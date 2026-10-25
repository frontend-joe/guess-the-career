import { sqlite } from "../db/client.ts";

// Football Tenable — 10-answer list rounds.
//
// Rounds are derived from career_statistics + footballers at query time, so a
// round's answers stay correct as the scraped data improves. A "candidate" is
// any (type + params + metric) combination that currently yields >= MIN_ANSWERS
// players; the admin browses candidates and picks the ones to schedule.

export const MIN_ANSWERS = 10;
export const ROUND_SIZE = 10;

export type Metric = "goals" | "apps";

export interface TenableAnswer {
  footballer_id: number;
  name: string;
  nationality: string | null;
  photo_url: string | null;
  value: number;
}

export interface Candidate {
  type: string;
  params: Record<string, string>;
  metric: Metric;
  title: string;
  answer_count: number;
}

// Per-player, per-league totals — the base for most question types.
const PLAYER_LEAGUE = `
  SELECT cs.footballer_id AS fid,
         COALESCE(cs.league, cs.division) AS league,
         SUM(COALESCE(cs.league_apps, 0))  AS apps,
         SUM(COALESCE(cs.league_goals, 0)) AS goals
  FROM career_statistics cs
  WHERE COALESCE(cs.league, cs.division) IS NOT NULL
  GROUP BY cs.footballer_id, COALESCE(cs.league, cs.division)
`;

// Per-player, per-club totals (all competitions' league rows for that club).
const PLAYER_CLUB = `
  SELECT cs.footballer_id AS fid,
         cs.club AS club,
         SUM(COALESCE(cs.league_apps, 0))  AS apps,
         SUM(COALESCE(cs.league_goals, 0)) AS goals
  FROM career_statistics cs
  GROUP BY cs.footballer_id, cs.club
`;

const metricCol = (m: Metric) => (m === "apps" ? "apps" : "goals");
const metricWord = (m: Metric) => (m === "apps" ? "appearances" : "goals");

export interface TenableType {
  slug: string;
  label: string;
  description: string;
  /** Example question, shown on the admin card. */
  example: string;
  candidates(metric: Metric): Candidate[];
  answers(params: Record<string, string>, metric: Metric): TenableAnswer[];
  title(params: Record<string, string>, metric: Metric): string;
}

const ANSWER_COLS = `f.id AS footballer_id, f.name, f.nationality, f.photo_url`;

// ── 1. First name × league ───────────────────────────────────────────────────
const firstName: TenableType = {
  slug: "first-name",
  label: "First name",
  description: "Players sharing a first name, ranked within one league.",
  example: "Players named James with the most Premier League goals",
  title: (p, m) =>
    `Players named ${p.firstName} with the most ${p.league} ${metricWord(m)}`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT pl.league AS league, f.first_name AS firstName, COUNT(*) AS n
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE f.first_name IS NOT NULL AND f.first_name <> '' AND pl.${col} > 0
       GROUP BY pl.league, f.first_name
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY n DESC`,
    ).all() as { league: string; firstName: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { league: r.league, firstName: r.firstName },
      metric,
      title: this.title({ league: r.league, firstName: r.firstName }, metric),
      answer_count: r.n,
    }));
  },
  answers(p, metric) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND f.first_name = ? AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${ROUND_SIZE}`,
    ).all(p.league, p.firstName) as TenableAnswer[];
  },
};

// ── 2. Surname initial × league ──────────────────────────────────────────────
const surnameInitial: TenableType = {
  slug: "surname-initial",
  label: "Surname letter",
  description: "Top of a league filtered to one surname initial.",
  example: "Most Premier League goals by players whose surname begins with C",
  title: (p, m) =>
    `Most ${p.league} ${metricWord(m)} — surname beginning with ${p.letter}`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT pl.league AS league, UPPER(SUBSTR(f.surname,1,1)) AS letter, COUNT(*) AS n
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE f.surname IS NOT NULL AND f.surname <> '' AND pl.${col} > 0
         AND UPPER(SUBSTR(f.surname,1,1)) BETWEEN 'A' AND 'Z'
       GROUP BY pl.league, letter
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY n DESC`,
    ).all() as { league: string; letter: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { league: r.league, letter: r.letter },
      metric,
      title: this.title({ league: r.league, letter: r.letter }, metric),
      answer_count: r.n,
    }));
  },
  answers(p, metric) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND UPPER(SUBSTR(f.surname,1,1)) = ? AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${ROUND_SIZE}`,
    ).all(p.league, p.letter.toUpperCase()) as TenableAnswer[];
  },
};

// ── 3. Common surname (all leagues combined) ─────────────────────────────────
const surname: TenableType = {
  slug: "surname",
  label: "Common surname",
  description: "Players sharing a surname, ranked by career league totals.",
  example: "Name 10 players with the surname Silva",
  title: (p, m) =>
    `Name 10 players with the surname ${p.surname} (most career ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH tot AS (
         SELECT cs.footballer_id AS fid,
                SUM(COALESCE(cs.league_apps,0))  AS apps,
                SUM(COALESCE(cs.league_goals,0)) AS goals
         FROM career_statistics cs GROUP BY cs.footballer_id)
       SELECT f.surname AS surname, COUNT(*) AS n
       FROM tot JOIN footballers f ON f.id = tot.fid
       WHERE f.surname IS NOT NULL AND f.surname <> '' AND tot.${col} > 0
       GROUP BY LOWER(f.surname)
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY n DESC`,
    ).all() as { surname: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { surname: r.surname },
      metric,
      title: this.title({ surname: r.surname }, metric),
      answer_count: r.n,
    }));
  },
  answers(p, metric) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH tot AS (
         SELECT cs.footballer_id AS fid,
                SUM(COALESCE(cs.league_apps,0))  AS apps,
                SUM(COALESCE(cs.league_goals,0)) AS goals
         FROM career_statistics cs GROUP BY cs.footballer_id)
       SELECT ${ANSWER_COLS}, tot.${col} AS value
       FROM tot JOIN footballers f ON f.id = tot.fid
       WHERE LOWER(f.surname) = LOWER(?) AND tot.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${ROUND_SIZE}`,
    ).all(p.surname) as TenableAnswer[];
  },
};

// ── 4. Nationality × league ──────────────────────────────────────────────────
const nationality: TenableType = {
  slug: "nationality",
  label: "Nationality",
  description: "Top of a league filtered to one nationality.",
  example: "Most Premier League goals by Dutch players",
  title: (p, m) =>
    `Most ${p.league} ${metricWord(m)} by ${p.nationality} players`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT pl.league AS league, f.nationality AS nationality, COUNT(*) AS n
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE f.nationality IS NOT NULL AND f.nationality <> '' AND pl.${col} > 0
       GROUP BY pl.league, f.nationality
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY n DESC`,
    ).all() as { league: string; nationality: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { league: r.league, nationality: r.nationality },
      metric,
      title: this.title({ league: r.league, nationality: r.nationality }, metric),
      answer_count: r.n,
    }));
  },
  answers(p, metric) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND f.nationality = ? AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${ROUND_SIZE}`,
    ).all(p.league, p.nationality) as TenableAnswer[];
  },
};

// ── 5. Club ──────────────────────────────────────────────────────────────────
const club: TenableType = {
  slug: "club",
  label: "Club",
  description: "A club's all-time leaders.",
  example: "Most league appearances for Liverpool",
  title: (p, m) => `Most league ${metricWord(m)} for ${p.club}`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH pc AS (${PLAYER_CLUB})
       SELECT pc.club AS club, COUNT(*) AS n
       FROM pc JOIN footballers f ON f.id = pc.fid
       WHERE pc.${col} > 0 AND pc.club NOT LIKE '%(loan)%'
       GROUP BY pc.club
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY n DESC`,
    ).all() as { club: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { club: r.club },
      metric,
      title: this.title({ club: r.club }, metric),
      answer_count: r.n,
    }));
  },
  answers(p, metric) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pc AS (${PLAYER_CLUB})
       SELECT ${ANSWER_COLS}, pc.${col} AS value
       FROM pc JOIN footballers f ON f.id = pc.fid
       WHERE pc.club = ? AND pc.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${ROUND_SIZE}`,
    ).all(p.club) as TenableAnswer[];
  },
};

// ── 6. League all-time ───────────────────────────────────────────────────────
const leagueAllTime: TenableType = {
  slug: "league",
  label: "League all-time",
  description: "The outright top ten of a league.",
  example: "Most Premier League goals of all time",
  title: (p, m) => `Most ${p.league} ${metricWord(m)} of all time`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT pl.league AS league, COUNT(*) AS n
       FROM pl WHERE pl.${col} > 0
       GROUP BY pl.league HAVING n >= ${MIN_ANSWERS} ORDER BY n DESC`,
    ).all() as { league: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { league: r.league },
      metric,
      title: this.title({ league: r.league }, metric),
      answer_count: r.n,
    }));
  },
  answers(p, metric) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${ROUND_SIZE}`,
    ).all(p.league) as TenableAnswer[];
  },
};

export const TENABLE_TYPES: TenableType[] = [
  surnameInitial,
  nationality,
  club,
  leagueAllTime,
  firstName,
  surname,
];

export function getType(slug: string): TenableType | undefined {
  return TENABLE_TYPES.find((t) => t.slug === slug);
}

// All candidates for a type, across both metrics.
export function candidatesForType(slug: string): Candidate[] {
  const t = getType(slug);
  if (!t) return [];
  return [...t.candidates("goals"), ...t.candidates("apps")].sort(
    (a, b) => b.answer_count - a.answer_count,
  );
}

export function answersForRound(
  type: string,
  params: Record<string, string>,
  metric: Metric,
): TenableAnswer[] {
  return getType(type)?.answers(params, metric) ?? [];
}
