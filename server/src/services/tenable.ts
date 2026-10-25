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
  footballer_id: number | null;
  name: string;
  nationality: string | null;
  photo_url: string | null;
  value: number;
  /** Shown next to the value, e.g. "apps", "goals", "£m", "#". */
  unit?: string;
}

export interface Candidate {
  type: string;
  params: Record<string, string>;
  metric: Metric;
  title: string;
  answer_count: number;
}

// Reserve / youth sides pollute club rounds ("Bayern Munich and Bayern Munich II"),
// so exclude them. Mirrors reserveRe in services/football.ts, which can't be used
// here because SQLite has no REGEXP by default.
export const NOT_RESERVE = (col: string) => `
  ${col} NOT LIKE '% II'   AND ${col} NOT LIKE '% III' AND ${col} NOT LIKE '% IV'
  AND ${col} NOT LIKE '% B' AND ${col} NOT LIKE '% C'
  AND ${col} NOT LIKE '%Reserve'  AND ${col} NOT LIKE '%Reserves'
  AND ${col} NOT LIKE '%Youth'    AND ${col} NOT LIKE '%Academy'
  AND ${col} NOT LIKE '%Under-%'  AND ${col} NOT LIKE '%U2_'
  AND ${col} NOT LIKE '%U1_'
`;

// Per-player, per-league totals — the base for most question types.
// Tenable is built from the Premier League and the Championship only.
//
// An allow-list rather than a deny-list: the data holds 100+ competitions whose
// names collide across countries and eras ("Primera División" is five different
// top flights; "First Division" is England's TOP flight pre-1992 and its SECOND
// tier after), and every one of those is a wrong answer waiting to happen.
// Both club and league rounds are restricted to these, so every round is drawn
// from the same two competitions.
export const ALLOWED_LEAGUES = [
  "Premier League",
  "EFL Championship",
  "Serie A",
  "La Liga",
  "Bundesliga",
];
const ALLOWED_LEAGUES_SQL = ALLOWED_LEAGUES.map((l) => `'${l}'`).join(", ");
const IN_ALLOWED = `COALESCE(cs.league, cs.division) IN (${ALLOWED_LEAGUES_SQL})`;
// Some sources spell leagues differently ("LaLiga" in the transfer windows), so
// match on a squashed, lower-cased form.
const ALLOWED_LEAGUES_LOOSE = ALLOWED_LEAGUES.map(
  (l) => `'${l.toLowerCase().replace(/ /g, "")}'`,
).join(", ");

const PLAYER_LEAGUE = `
  SELECT cs.footballer_id AS fid,
         COALESCE(cs.league, cs.division) AS league,
         SUM(COALESCE(cs.league_apps, 0))  AS apps,
         SUM(COALESCE(cs.league_goals, 0)) AS goals
  FROM career_statistics cs
  WHERE ${IN_ALLOWED}
  GROUP BY cs.footballer_id, COALESCE(cs.league, cs.division)
`;

// Per-player, per-club totals (all competitions' league rows for that club).
const PLAYER_CLUB = `
  SELECT cs.footballer_id AS fid,
         cs.club AS club,
         SUM(COALESCE(cs.league_apps, 0))  AS apps,
         SUM(COALESCE(cs.league_goals, 0)) AS goals
  FROM career_statistics cs
  WHERE cs.club IS NOT NULL AND cs.club NOT LIKE '%(loan)%'
    AND ${NOT_RESERVE('cs.club')} AND ${IN_ALLOWED}
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
  /**
   * Ordered rounds are a ranked top ten — an answer reveals at its own rank.
   * Unordered rounds ("name any 10 of the squad") have no meaningful ranking,
   * so answers fill the board in the order the player finds them.
   */
  ordered?: boolean;
  /** Unordered types ignore the metric; set this to run candidates once. */
  metricless?: boolean;
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

// ── 2b. Surname length × league ──────────────────────────────────────────────
// Letters only — spaces, hyphens and apostrophes don't count, so "Le Saux" is 6
// and "O'Shea" is 6.
const SURNAME_LETTERS = `LENGTH(REPLACE(REPLACE(REPLACE(f.surname, ' ', ''), '-', ''), '''', ''))`;
// Only 4-letter surnames make a good round: longer buckets are large and
// vague, and 3-letter surnames are too rare to ever reach ten (the whole
// Premier League has four — Lee, Obi, Flo, Foe).
const SURNAME_LENGTHS = [4];

const surnameLength: TenableType = {
  slug: "surname-length",
  label: "Surname length",
  description: "Top of a league filtered to surnames of an exact letter count.",
  example: "Most Premier League goals by players with a 4-letter surname",
  title: (p, m) =>
    `Most ${p.league} ${metricWord(m)} — players with a ${p.length}-letter surname`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT pl.league AS league, ${SURNAME_LETTERS} AS len, COUNT(*) AS n
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE f.surname IS NOT NULL AND f.surname <> '' AND pl.${col} > 0
         AND ${SURNAME_LETTERS} IN (${SURNAME_LENGTHS.join(", ")})
       GROUP BY pl.league, len
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY n DESC`,
    ).all() as { league: string; len: number; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { league: r.league, length: String(r.len) },
      metric,
      title: this.title({ league: r.league, length: String(r.len) }, metric),
      answer_count: r.n,
    }));
  },
  answers(p, metric) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND ${SURNAME_LETTERS} = ? AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${ROUND_SIZE}`,
    ).all(p.league, parseInt(p.length, 10)) as TenableAnswer[];
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
         FROM career_statistics cs
         WHERE ${IN_ALLOWED}
         GROUP BY cs.footballer_id)
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
         FROM career_statistics cs
         WHERE ${IN_ALLOWED}
         GROUP BY cs.footballer_id)
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

// ── 7. Two clubs ─────────────────────────────────────────────────────────────
// Distinct player/club pairs, loans excluded, used by both two-clubs and
// nationality-club.
const PLAYER_CLUB_DISTINCT = `
  SELECT DISTINCT cs.footballer_id AS fid, cs.club AS club
  FROM career_statistics cs
  WHERE cs.club IS NOT NULL AND cs.club NOT LIKE '%(loan)%'
    AND ${NOT_RESERVE('cs.club')} AND ${IN_ALLOWED}
`;

const twoClubs: TenableType = {
  slug: "two-clubs",
  label: "Two clubs",
  description: "Players who turned out for both of a pair of clubs.",
  example: "Name 10 players who played for both Liverpool and Chelsea",
  title: (p, m) =>
    `Name 10 players who turned out for both ${p.clubA} and ${p.clubB} (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH pc AS (${PLAYER_CLUB_DISTINCT}),
            tot AS (SELECT footballer_id fid, club,
                           SUM(COALESCE(league_apps,0)) apps,
                           SUM(COALESCE(league_goals,0)) goals
                    FROM career_statistics
                    WHERE club NOT LIKE '%(loan)%' AND ${NOT_RESERVE('club')}
                      AND COALESCE(league, division) IN (${ALLOWED_LEAGUES_SQL})
                    GROUP BY footballer_id, club)
       SELECT a.club AS clubA, b.club AS clubB, COUNT(*) AS n
       FROM pc a
       JOIN pc b ON a.fid = b.fid AND a.club < b.club
       JOIN tot ta ON ta.fid = a.fid AND ta.club = a.club
       JOIN tot tb ON tb.fid = b.fid AND tb.club = b.club
       WHERE ta.${col} + tb.${col} > 0
       GROUP BY a.club, b.club
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY n DESC`,
    ).all() as { clubA: string; clubB: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { clubA: r.clubA, clubB: r.clubB },
      metric,
      title: this.title({ clubA: r.clubA, clubB: r.clubB }, metric),
      answer_count: r.n,
    }));
  },
  answers(p, metric) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH tot AS (SELECT footballer_id fid, club,
                           SUM(COALESCE(league_apps,0)) apps,
                           SUM(COALESCE(league_goals,0)) goals
                    FROM career_statistics
                    WHERE club NOT LIKE '%(loan)%' AND ${NOT_RESERVE('club')}
                      AND COALESCE(league, division) IN (${ALLOWED_LEAGUES_SQL})
                    GROUP BY footballer_id, club)
       SELECT ${ANSWER_COLS}, (ta.${col} + tb.${col}) AS value
       FROM tot ta
       JOIN tot tb ON tb.fid = ta.fid AND tb.club = ?
       JOIN footballers f ON f.id = ta.fid
       WHERE ta.club = ? AND (ta.${col} + tb.${col}) > 0
       ORDER BY value DESC, f.name ASC LIMIT ${ROUND_SIZE}`,
    ).all(p.clubB, p.clubA) as TenableAnswer[];
  },
};

// ── 8. Nationality at a club ─────────────────────────────────────────────────
const nationalityClub: TenableType = {
  slug: "nationality-club",
  label: "Nationality at a club",
  description: "Players of one nation who turned out for one club.",
  example: "Name 10 French players who turned out for Arsenal",
  title: (p, m) =>
    `Name 10 ${p.nationality} players who turned out for ${p.club} (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH tot AS (SELECT footballer_id fid, club,
                           SUM(COALESCE(league_apps,0)) apps,
                           SUM(COALESCE(league_goals,0)) goals
                    FROM career_statistics
                    WHERE club NOT LIKE '%(loan)%' AND ${NOT_RESERVE('club')}
                      AND COALESCE(league, division) IN (${ALLOWED_LEAGUES_SQL})
                    GROUP BY footballer_id, club)
       SELECT tot.club AS club, f.nationality AS nationality, COUNT(*) AS n
       FROM tot JOIN footballers f ON f.id = tot.fid
       WHERE f.nationality IS NOT NULL AND f.nationality <> '' AND tot.${col} > 0
       GROUP BY tot.club, f.nationality
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY n DESC`,
    ).all() as { club: string; nationality: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { club: r.club, nationality: r.nationality },
      metric,
      title: this.title({ club: r.club, nationality: r.nationality }, metric),
      answer_count: r.n,
    }));
  },
  answers(p, metric) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH tot AS (SELECT footballer_id fid, club,
                           SUM(COALESCE(league_apps,0)) apps,
                           SUM(COALESCE(league_goals,0)) goals
                    FROM career_statistics
                    WHERE club NOT LIKE '%(loan)%' AND ${NOT_RESERVE('club')}
                      AND COALESCE(league, division) IN (${ALLOWED_LEAGUES_SQL})
                    GROUP BY footballer_id, club)
       SELECT ${ANSWER_COLS}, tot.${col} AS value
       FROM tot JOIN footballers f ON f.id = tot.fid
       WHERE tot.club = ? AND f.nationality = ? AND tot.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${ROUND_SIZE}`,
    ).all(p.club, p.nationality) as TenableAnswer[];
  },
};

// ── 8b. Overseas players at an English club ──────────────────────────────────
// Mirrors the Overseas Players game: any non-England nationality (so Scots and
// Welsh count, as they do there) at one of the curated English clubs.
// Derived from the career data rather than a hardcoded club list: a club counts
// as English if it has league rows in an English division.
const ENGLISH_DIVISIONS = [
  "Premier League", "First Division", "Second Division", "Third Division",
  "Fourth Division", "EFL Championship", "Championship",
  "League One", "League Two", "Third Division North", "Third Division South",
];
const ENGLISH_CLUBS_SQL = `
  SELECT DISTINCT club FROM career_statistics
  WHERE COALESCE(league, division) IN (${ENGLISH_DIVISIONS.map((d) => `'${d}'`).join(", ")})
`;

const overseasClub: TenableType = {
  slug: "overseas-club",
  label: "Overseas at an English club",
  description: "Non-English players who turned out for an English club.",
  example: "Name 10 overseas players who turned out for Chelsea",
  title: (p, m) =>
    `Name 10 overseas players who turned out for ${p.club} (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH tot AS (SELECT footballer_id fid, club,
                           SUM(COALESCE(league_apps,0)) apps,
                           SUM(COALESCE(league_goals,0)) goals
                    FROM career_statistics
                    WHERE club NOT LIKE '%(loan)%' AND ${NOT_RESERVE("club")}
                    GROUP BY footballer_id, club)
       SELECT tot.club AS club, COUNT(*) AS n
       FROM tot JOIN footballers f ON f.id = tot.fid
       WHERE tot.${col} > 0
         AND tot.club IN (${ENGLISH_CLUBS_SQL})
         AND f.nationality IS NOT NULL AND f.nationality <> ''
         AND LOWER(f.nationality) NOT IN ('england')
       GROUP BY tot.club
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
      `WITH tot AS (SELECT footballer_id fid, club,
                           SUM(COALESCE(league_apps,0)) apps,
                           SUM(COALESCE(league_goals,0)) goals
                    FROM career_statistics
                    WHERE club NOT LIKE '%(loan)%' AND ${NOT_RESERVE("club")}
                    GROUP BY footballer_id, club)
       SELECT ${ANSWER_COLS}, tot.${col} AS value
       FROM tot JOIN footballers f ON f.id = tot.fid
       WHERE tot.club = ? AND tot.${col} > 0
         AND f.nationality IS NOT NULL AND LOWER(f.nationality) NOT IN ('england')
       ORDER BY value DESC, f.name ASC LIMIT ${ROUND_SIZE}`,
    ).all(p.club) as TenableAnswer[];
  },
};

// ── 9. Transfer window ───────────────────────────────────────────────────────
// Naturally ranked by fee, so the metric is ignored.
const transferWindow: TenableType = {
  slug: "transfer-window",
  label: "Transfer window",
  description: "The biggest transfers of a single window, ranked by fee.",
  example: "The 10 biggest Premier League transfers of 2003–04",
  metricless: true,
  title: (p) => `The 10 biggest ${p.league} transfers of ${p.season}`,
  candidates() {
    const rows = sqlite.prepare(
      `SELECT w.id AS windowId, w.league AS league, w.season_label AS season, COUNT(*) AS n
       FROM transfer_window_players p
       JOIN transfer_windows w ON w.id = p.window_id
       WHERE p.fee_value IS NOT NULL AND p.fee_value > 0
         AND LOWER(REPLACE(w.league, ' ', '')) IN (${ALLOWED_LEAGUES_LOOSE})
       GROUP BY w.id
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY n DESC`,
    ).all() as { windowId: number; league: string; season: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { windowId: String(r.windowId), league: r.league, season: r.season },
      metric: "goals" as Metric,
      title: this.title({ league: r.league, season: r.season }, "goals"),
      answer_count: r.n,
    }));
  },
  answers(p) {
    return sqlite.prepare(
      `SELECT p.footballer_id AS footballer_id, p.player_name AS name,
              p.nationality AS nationality, f.photo_url AS photo_url,
              p.fee_value AS value, 'fee' AS unit
       FROM transfer_window_players p
       LEFT JOIN footballers f ON f.id = p.footballer_id
       WHERE p.window_id = ? AND p.fee_value IS NOT NULL AND p.fee_value > 0
       ORDER BY p.fee_value DESC, p.player_name ASC LIMIT ${ROUND_SIZE}`,
    ).all(parseInt(p.windowId, 10)) as TenableAnswer[];
  },
};

// ── 10. World Cup squad (unordered — name any 10) ────────────────────────────
const worldCupSquad: TenableType = {
  slug: "world-cup-squad",
  label: "World Cup squad",
  description: "Name any 10 players from a World Cup squad.",
  example: "Name 10 players from Brazil's 2002 World Cup squad",
  ordered: false,
  metricless: true,
  title: (p) => `Name 10 players from ${p.team}'s ${p.year} World Cup squad`,
  candidates() {
    const rows = sqlite.prepare(
      `SELECT s.id AS squadId, s.team AS team, s.year AS year, COUNT(*) AS n
       FROM world_cup_squad_players p
       JOIN world_cup_squads s ON s.id = p.squad_id
       GROUP BY s.id
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY s.year DESC, s.team ASC`,
    ).all() as { squadId: number; team: string; year: number; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { squadId: String(r.squadId), team: r.team, year: String(r.year) },
      metric: "goals" as Metric,
      title: this.title({ team: r.team, year: String(r.year) }, "goals"),
      answer_count: r.n,
    }));
  },
  answers(p) {
    // Returns the WHOLE squad — the player only needs any ten of them.
    return sqlite.prepare(
      `SELECT p.footballer_id AS footballer_id, p.name AS name,
              p.nationality AS nationality, f.photo_url AS photo_url,
              COALESCE(p.shirt_number, 0) AS value, 'shirt' AS unit
       FROM world_cup_squad_players p
       LEFT JOIN footballers f ON f.id = p.footballer_id
       WHERE p.squad_id = ?
       ORDER BY COALESCE(p.shirt_number, 99), p.name`,
    ).all(parseInt(p.squadId, 10)) as TenableAnswer[];
  },
};

export const TENABLE_TYPES: TenableType[] = [
  surnameInitial,
  surnameLength,
  nationality,
  club,
  leagueAllTime,
  twoClubs,
  nationalityClub,
  overseasClub,
  transferWindow,
  worldCupSquad,
  firstName,
  surname,
];

export function getType(slug: string): TenableType | undefined {
  return TENABLE_TYPES.find((t) => t.slug === slug);
}

// All candidates for a type. Metricless types (transfers, World Cup squads)
// have one natural ranking, so they're only enumerated once.
export function candidatesForType(slug: string): Candidate[] {
  const t = getType(slug);
  if (!t) return [];
  const list = t.metricless
    ? t.candidates("goals")
    : [...t.candidates("goals"), ...t.candidates("apps")];
  return list.sort((a, b) => b.answer_count - a.answer_count);
}

export function isOrdered(slug: string): boolean {
  return getType(slug)?.ordered !== false;
}

export function answersForRound(
  type: string,
  params: Record<string, string>,
  metric: Metric,
): TenableAnswer[] {
  return getType(type)?.answers(params, metric) ?? [];
}
