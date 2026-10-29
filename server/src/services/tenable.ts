import { normalizeName, sqlite } from "../db/client.ts";
import { normalizeClubAlias } from "../services/scraper.ts";

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
// "First Division" here means England's pre-1992 top flight only. The 1992-2004
// First Division was the second tier and is stored as "EFL Championship", and
// the Belgian, Scottish, Cypriot and Irish First Divisions are left under their
// raw division name — see migration 0082.
export const ALLOWED_LEAGUES = [
  "Premier League",
  "EFL Championship",
  "First Division",
  "Serie A",
  "La Liga",
  "Bundesliga",
];
const ALLOWED_LEAGUES_SQL = ALLOWED_LEAGUES.map((l) => `'${l}'`).join(", ");
const IN_ALLOWED = `COALESCE(cs.league, cs.division) IN (${ALLOWED_LEAGUES_SQL})`;

// Club rounds ask "most appearances FOR THIS CLUB", so they count every league
// appearance for that club, not only the ones in our five leagues. Birmingham
// City's second tier was called "First Division" until 2004, so filtering rows
// by league threw away 200 of Bryan Hughes' 248 appearances. The allow-list
// still decides WHICH CLUBS get rounds — a club qualifies if it ever played in
// one of the five — but not which of its rows count.
const ALLOWED_CLUBS = `
  SELECT DISTINCT REPLACE(club, ' (loan)', '') AS club
  FROM career_statistics
  WHERE COALESCE(league, division) IN (${ALLOWED_LEAGUES_SQL})
`;
// Some sources spell leagues differently ("LaLiga" in the transfer windows), so
// match on a squashed, lower-cased form.
const ALLOWED_LEAGUES_LOOSE = ALLOWED_LEAGUES.map(
  (l) => `'${l.toLowerCase().replace(/ /g, "")}'`,
).join(", ");


// Roughly a quarter of players have no "Career statistics" table on Wikipedia
// (Dede, Solano) — but their infobox career IS scraped into career_stints with
// club totals. Recover those by working out which league the club was in
// DURING that spell, from the seasons other players' career_statistics record
// for the same club. Aston Villa is a Premier League club in 2004-05 and a
// Championship club in 2016-17; the season is what settles it, not the club.
// EVERY division, not just the five we build rounds from. The unanimity test
// below has to see the divisions we don't use, or a spell that straddled them
// looks unanimous: Birmingham City were in the First Division until 2002 and
// the Premier League after, so judging by Premier League rows alone credited a
// player's whole Birmingham career to the Premier League.
// Prefer club_seasons: it's scraped from the club's own "List of seasons"
// article, so it states every season outright instead of inferring them from
// whichever players happen to have career statistics. Fall back to that
// inference only for clubs with no seasons article.
//
// The two sources are never mixed for the same club-SEASON. Career statistics
// are sparse and occasionally mislabelled, and one stray row would add a
// second distinct league to a club-season the article already settles — which
// the unanimity test below reads as a straddled spell and throws away.
//
// Per season, though, not per club. This used to switch the inference off for
// every year of any club with an article, however little of the club's history
// that article covered — and "List of Udinese Calcio seasons" starts at
// 2000-01. Paolo Poggi's five years at Udinese, 172 appearances, resolved to
// nothing, and his Serie A total came out as the 83 he made at Torino, Roma
// and Piacenza. Bierhoff's and Amoroso's career statistics name the league for
// those very seasons; they were simply never consulted, because the article
// had an opinion about a different decade.
//
// Excluding by season keeps the reason the two were separated in the first
// place: where the article speaks it still wins outright, and the only rows
// now admitted cover seasons it says nothing about, which have nothing to
// contradict. A club_seasons row with no league settles nothing either, so it
// does not suppress anything.
export const CLUB_SEASON_LEAGUE = `
  SELECT club, season_year AS yr, league
  FROM club_seasons
  GROUP BY 1, 2, 3
  UNION
  SELECT REPLACE(club, ' (loan)', '') AS club,
         CAST(SUBSTR(season, 1, 4) AS INTEGER) AS yr,
         COALESCE(league, division) AS league
  FROM career_statistics cst
  WHERE COALESCE(league, division) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM club_seasons a
      WHERE a.club = REPLACE(cst.club, ' (loan)', '')
        AND a.season_year = CAST(SUBSTR(cst.season, 1, 4) AS INTEGER)
        AND a.league IS NOT NULL
    )
  GROUP BY 1, 2, 3
`;

// A stint's apps are a single total, so it can only be credited to a league if
// EVERY season it spans was in that same league (HAVING COUNT(DISTINCT) = 1).
// Spells straddling a promotion or relegation are dropped rather than guessed.
// Club rounds don't need the league worked out — "total appearances for Leeds"
// counts every division. So for club totals, take a missing-stats player's
// stints at any qualifying club as they are. John Sheridan's 230 Leeds
// appearances were in the old Second Division, which the league-resolved
// version below (rightly) can't attribute, and he vanished from Leeds rounds.
const STINT_CLUB_ANY = `
  SELECT st.footballer_id AS fid,
         REPLACE(REPLACE(st.club, '→ ', ''), ' (loan)', '') AS club,
         SUM(COALESCE(st.apps, 0))  AS apps,
         SUM(COALESCE(st.goals, 0)) AS goals
  FROM career_stints st
  WHERE st.stint_type = 'senior'
    AND NOT EXISTS (
      SELECT 1 FROM career_statistics x WHERE x.footballer_id = st.footballer_id
    )
    AND REPLACE(REPLACE(st.club, '→ ', ''), ' (loan)', '') IN (${ALLOWED_CLUBS})
  GROUP BY st.footballer_id, REPLACE(REPLACE(st.club, '→ ', ''), ' (loan)', '')
`;

// A spell's appearances are one career total from the infobox, so a spell that
// straddled a promotion used to be dropped. That silently reported a partial
// sum as a complete one: Paul Parker's Man Utd years (1991-96) were discarded
// and his Premier League total came out as 8 — the four games each at Derby and
// Chelsea — instead of the ~79 he actually played.
//
// Split it instead, pro-rata by season. club_seasons says exactly which league
// the club was in each year, so the division is grounded in fact even though
// the per-season apps are not: Parker's 105 Man Utd apps over one First
// Division and four Premier League seasons give him 84, against a real 79.
//
// The denominator counts EVERY season of the spell, including leagues we build
// no rounds from, so seasons spent outside them still dilute the share. Only
// then are the allowed leagues kept.
const STINT_RESOLVED = `
  WITH spell AS (
    SELECT st.id AS sid,
           st.footballer_id AS fid,
           REPLACE(REPLACE(st.club, '→ ', ''), ' (loan)', '') AS club,
           CAST(SUBSTR(st.years, 1, 4) AS INTEGER) AS y1,
           CAST(SUBSTR(st.years, -4) AS INTEGER) AS y2,
           COALESCE(st.apps, 0) AS apps,
           COALESCE(st.goals, 0) AS goals
    FROM career_stints st
    WHERE st.stint_type = 'senior'
      -- Scraped rows only displace the infobox where they can actually answer
      -- the question. Dirk Kuyt has all 21 seasons scraped and not one of them
      -- carries a division, so his six Liverpool rows — 51 goals, the right
      -- number — were filtered out for having no league, while merely existing
      -- switched off the fallback that reads Premier League off club_seasons
      -- and gets it right. Partial data was worse than none: he fell through
      -- both paths and vanished from Dutch Premier League rounds.
      --
      -- A row with an allowed league still wins, so nobody is counted twice:
      -- the fallback only runs where the career_statistics branch above
      -- contributes nothing to these leagues in the first place.
      AND NOT EXISTS (
        SELECT 1 FROM career_statistics x
        WHERE x.footballer_id = st.footballer_id
          AND COALESCE(x.league, x.division) IN (${ALLOWED_LEAGUES_SQL})
      )
  ),
  per_league AS (
    SELECT sp.sid, sp.fid, sp.club, sp.apps, sp.goals,
           cs.league AS league, COUNT(*) AS seasons
    FROM spell sp
    JOIN (${CLUB_SEASON_LEAGUE}) cs
      ON cs.club = sp.club AND cs.yr BETWEEN sp.y1 AND MAX(sp.y2 - 1, sp.y1)
    GROUP BY sp.sid, cs.league
  ),
  spell_total AS (
    SELECT sid, SUM(seasons) AS seasons FROM per_league GROUP BY sid
  )
  SELECT pl.fid AS fid, pl.club AS club, pl.league AS league,
         CAST(ROUND(pl.apps  * 1.0 * pl.seasons / st.seasons) AS INTEGER) AS apps,
         CAST(ROUND(pl.goals * 1.0 * pl.seasons / st.seasons) AS INTEGER) AS goals
  FROM per_league pl
  JOIN spell_total st ON st.sid = pl.sid
  WHERE pl.league IN (${ALLOWED_LEAGUES_SQL})
`;

const PLAYER_LEAGUE = `
  SELECT fid, league, SUM(apps) AS apps, SUM(goals) AS goals FROM (
    SELECT cs.footballer_id AS fid,
           COALESCE(cs.league, cs.division) AS league,
           SUM(COALESCE(cs.league_apps, 0))  AS apps,
           SUM(COALESCE(cs.league_goals, 0)) AS goals
    FROM career_statistics cs
    WHERE ${IN_ALLOWED}
    GROUP BY cs.footballer_id, COALESCE(cs.league, cs.division)
    UNION ALL
    SELECT sr.fid, sr.league, sr.apps, sr.goals
    FROM (${STINT_RESOLVED}) sr
  )
  GROUP BY fid, league
`;

// Per-player, per-club totals (all competitions' league rows for that club).
const PLAYER_CLUB = `
  SELECT fid, club, SUM(apps) AS apps, SUM(goals) AS goals FROM (
    -- All competitions, not just the league: "most goals for Real Madrid"
    -- means 242 for Puskás, not his 156 La Liga goals. Cup and European
    -- scoring is part of what a player did for a club, and the league-only
    -- figure reads as plain wrong against the number everyone knows.
    -- COALESCE down to the league column for the ~1% of rows with no total.
    SELECT cs.footballer_id AS fid,
           REPLACE(cs.club, ' (loan)', '') AS club,
           SUM(COALESCE(cs.total_apps,  cs.league_apps,  0)) AS apps,
           SUM(COALESCE(cs.total_goals, cs.league_goals, 0)) AS goals
    FROM career_statistics cs
    WHERE cs.club IS NOT NULL
      AND ${NOT_RESERVE("REPLACE(cs.club, ' (loan)', '')")}
      AND REPLACE(cs.club, ' (loan)', '') IN (${ALLOWED_CLUBS})
    GROUP BY cs.footballer_id, REPLACE(cs.club, ' (loan)', '')
    UNION ALL
    SELECT sc.fid, sc.club, sc.apps, sc.goals
    FROM (${STINT_CLUB_ANY}) sc
    WHERE ${NOT_RESERVE('sc.club')}
  )
  GROUP BY fid, club
`;


const metricCol = (m: Metric) => (m === "apps" ? "apps" : "goals");

// "Wolverhampton Wanderers'" not "Wolverhampton Wanderers's".
const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
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
  answers(params: Record<string, string>, metric: Metric, limit?: number): TenableAnswer[];
  title(params: Record<string, string>, metric: Metric): string;
}

const ANSWER_COLS = `f.id AS footballer_id, f.name, f.nationality, f.photo_url`;

// ── 1. First name × league ───────────────────────────────────────────────────
const firstName: TenableType = {
  slug: "first-name",
  label: "First name",
  description: "Players sharing a first name, ranked within one league.",
  example: "Players named James with the most Premier League goals",
  title: (p, m) => `${p.league} players named ${p.firstName} (most ${metricWord(m)})`,
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
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND f.first_name = ? AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.league, p.firstName) as TenableAnswer[];
  },
};

// ── 2. Surname initial × league ──────────────────────────────────────────────
const surnameInitial: TenableType = {
  slug: "surname-initial",
  label: "Surname letter",
  description: "Top of a league filtered to one surname initial.",
  example: "Most Premier League goals by players whose surname begins with C",
  title: (p, m) => `${p.league} players, surnames starting ${p.letter} (most ${metricWord(m)})`,
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
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND UPPER(SUBSTR(f.surname,1,1)) = ? AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
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
  title: (p, m) => `${p.league} players with ${p.length}-letter surnames (most ${metricWord(m)})`,
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
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND ${SURNAME_LETTERS} = ? AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.league, parseInt(p.length, 10)) as TenableAnswer[];
  },
};

// ── 3. Common surname (all leagues combined) ─────────────────────────────────
const surname: TenableType = {
  slug: "surname",
  label: "Common surname",
  description: "Players sharing a surname, ranked by career league totals.",
  example: "Name 10 players with the surname Silva",
  title: (p, m) => `Players called ${p.surname} (most career ${metricWord(m)})`,
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
  answers(p, metric, limit = ROUND_SIZE) {
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
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.surname) as TenableAnswer[];
  },
};

// ── 4. Nationality × league ──────────────────────────────────────────────────
const nationality: TenableType = {
  slug: "nationality",
  label: "Nationality",
  description: "Top of a league filtered to one nationality.",
  example: "Most Premier League goals by Dutch players",
  title: (p, m) => `${p.nationality} ${p.league} players (most ${metricWord(m)})`,
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
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND f.nationality = ? AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.league, p.nationality) as TenableAnswer[];
  },
};

// ── 5. Club ──────────────────────────────────────────────────────────────────
const club: TenableType = {
  slug: "club",
  label: "Club",
  description: "A club's all-time leaders.",
  example: "Most league appearances for Liverpool",
  title: (p, m) => `${p.club} players (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH pc AS (${PLAYER_CLUB})
       SELECT pc.club AS club, COUNT(*) AS n
       FROM pc JOIN footballers f ON f.id = pc.fid
       WHERE pc.${col} > 0
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
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pc AS (${PLAYER_CLUB})
       SELECT ${ANSWER_COLS}, pc.${col} AS value
       FROM pc JOIN footballers f ON f.id = pc.fid
       WHERE pc.club = ? AND pc.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.club) as TenableAnswer[];
  },
};

// ── 6. League all-time ───────────────────────────────────────────────────────
const leagueAllTime: TenableType = {
  slug: "league",
  label: "League all-time",
  description: "The outright top ten of a league.",
  example: "Most Premier League goals of all time",
  title: (p, m) => `${p.league} players (most ${metricWord(m)} of all time)`,
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
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.league) as TenableAnswer[];
  },
};

// ── 7. Two clubs ─────────────────────────────────────────────────────────────
// Distinct player/club pairs, loans excluded, used by both two-clubs and
// nationality-club.
const PLAYER_CLUB_DISTINCT = `
  SELECT DISTINCT cs.footballer_id AS fid, REPLACE(cs.club, ' (loan)', '') AS club
  FROM career_statistics cs
  WHERE cs.club IS NOT NULL
    AND ${NOT_RESERVE("REPLACE(cs.club, ' (loan)', '')")}
    AND REPLACE(cs.club, ' (loan)', '') IN (${ALLOWED_CLUBS})
`;

const twoClubs: TenableType = {
  slug: "two-clubs",
  label: "Two clubs",
  description: "Players who turned out for both of a pair of clubs.",
  example: "Name 10 players who played for both Liverpool and Chelsea",
  title: (p, m) => `${p.clubA} and ${p.clubB} players (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH pc AS (${PLAYER_CLUB_DISTINCT}),
            tot AS (${PLAYER_CLUB})
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
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH tot AS (${PLAYER_CLUB})
       SELECT ${ANSWER_COLS}, (ta.${col} + tb.${col}) AS value
       FROM tot ta
       JOIN tot tb ON tb.fid = ta.fid AND tb.club = ?
       JOIN footballers f ON f.id = ta.fid
       WHERE ta.club = ? AND (ta.${col} + tb.${col}) > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.clubB, p.clubA) as TenableAnswer[];
  },
};

// ── 8. Nationality at a club ─────────────────────────────────────────────────
const nationalityClub: TenableType = {
  slug: "nationality-club",
  label: "Nationality at a club",
  description: "Players of one nation who turned out for one club.",
  example: "Name 10 French players who turned out for Arsenal",
  title: (p, m) => `${p.nationality} ${p.club} players (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH tot AS (${PLAYER_CLUB})
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
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH tot AS (${PLAYER_CLUB})
       SELECT ${ANSWER_COLS}, tot.${col} AS value
       FROM tot JOIN footballers f ON f.id = tot.fid
       WHERE tot.club = ? AND f.nationality = ? AND tot.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
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
  title: (p, m) => `${possessive(p.club)} overseas players (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH tot AS (${PLAYER_CLUB})
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
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH tot AS (${PLAYER_CLUB})
       SELECT ${ANSWER_COLS}, tot.${col} AS value
       FROM tot JOIN footballers f ON f.id = tot.fid
       WHERE tot.club = ? AND tot.${col} > 0
         AND f.nationality IS NOT NULL AND LOWER(f.nationality) NOT IN ('england')
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
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
  title: (p) => `Biggest ${p.league} transfers, ${p.season}`,
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
  answers(p, _metric, limit = ROUND_SIZE) {
    return sqlite.prepare(
      `SELECT p.footballer_id AS footballer_id, p.player_name AS name,
              p.nationality AS nationality, f.photo_url AS photo_url,
              p.fee_value AS value, 'fee' AS unit
       FROM transfer_window_players p
       LEFT JOIN footballers f ON f.id = p.footballer_id
       WHERE p.window_id = ? AND p.fee_value IS NOT NULL AND p.fee_value > 0
       ORDER BY p.fee_value DESC, p.player_name ASC LIMIT ${limit}`,
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
  title: (p) => `${possessive(p.team)} ${p.year} World Cup squad`,
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
  answers(p, _metric, _limit = ROUND_SIZE) {
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

// ── 5b. Club × surname initial ───────────────────────────────────────────────
const clubSurnameInitial: TenableType = {
  slug: "club-surname-initial",
  label: "Club + surname letter",
  description: "One club's leaders, filtered to a surname initial.",
  example: "Aston Villa players, surnames starting B (most appearances)",
  title: (p, m) =>
    `${p.club} players, surnames starting ${p.letter} (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH pc AS (${PLAYER_CLUB})
       SELECT pc.club AS club, UPPER(SUBSTR(f.surname, 1, 1)) AS letter, COUNT(*) AS n
       FROM pc JOIN footballers f ON f.id = pc.fid
       WHERE pc.${col} > 0 AND f.surname IS NOT NULL AND f.surname <> ''
         AND UPPER(SUBSTR(f.surname, 1, 1)) BETWEEN 'A' AND 'Z'
       GROUP BY pc.club, letter
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY n DESC`,
    ).all() as { club: string; letter: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { club: r.club, letter: r.letter },
      metric,
      title: this.title({ club: r.club, letter: r.letter }, metric),
      answer_count: r.n,
    }));
  },
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    return sqlite.prepare(
      `WITH pc AS (${PLAYER_CLUB})
       SELECT ${ANSWER_COLS}, pc.${col} AS value
       FROM pc JOIN footballers f ON f.id = pc.fid
       WHERE pc.club = ? AND UPPER(SUBSTR(f.surname, 1, 1)) = ? AND pc.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.club, p.letter.toUpperCase()) as TenableAnswer[];
  },
};

export const TENABLE_TYPES: TenableType[] = [
  surnameInitial,
  surnameLength,
  nationality,
  club,
  clubSurnameInitial,
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

// Render a round's title from its type + params, so wording changes apply to
// rounds already selected without having to re-pick them.
export function titleFor(
  type: string,
  params: Record<string, string>,
  metric: Metric,
  fallback: string,
): string {
  try {
    return getType(type)?.title(params, metric) ?? fallback;
  } catch {
    return fallback;
  }
}

export function isOrdered(slug: string): boolean {
  return getType(slug)?.ordered !== false;
}

export function answersForRound(
  type: string,
  params: Record<string, string>,
  metric: Metric,
  limit = ROUND_SIZE,
): TenableAnswer[] {
  return getType(type)?.answers(params, metric, limit) ?? [];
}

// Where a player actually sits in the full ordering, so a guess just off the
// board can be told how close it was. Looks a long way past the top ten.
export const NEAR_MISS_WINDOW = 15;
export function rankOf(
  type: string,
  params: Record<string, string>,
  metric: Metric,
  footballerId: number,
): { rank: number; value: number; unit?: string } | null {
  const all = answersForRound(type, params, metric, 200);
  const i = all.findIndex((a) => a.footballer_id === footballerId);
  if (i < 0) return null;
  return { rank: i + 1, value: all[i].value, unit: all[i].unit };
}

// ── Clues ────────────────────────────────────────────────────────────────────
// The long-press hint behind a blank row. These live here rather than in the
// route because a multiplayer round has to freeze its clues at kick-off, and
// the frozen copy must be built by exactly the same code the solo game uses —
// two implementations would drift and the two games would disagree.

export interface TenableClue {
  nationality: string | null;
  position: string | null;
  years: string | null;
  club: string | null;
  clubWikiUrl: string | null;
  squadNumber: number | null;
  born: string | null;
  // Transfer rounds only. The career fields above describe the player; these
  // describe the MOVE, which is what the question is actually about.
  fromClub?: string | null;
  toClub?: string | null;
  fee?: string | null;
}

// Anything the question already gives away is suppressed — no point "hinting"
// the nationality on a Norway round.
export function impliedCluesFor(type: string): string[] {
  const implied: string[] = [];
  if (["nationality", "nationality-club", "world-cup-squad"].includes(type)) implied.push("nationality");
  if (["club", "two-clubs", "nationality-club", "overseas-club", "club-surname-initial"].includes(type)) implied.push("club");
  if (["surname-length", "surname-initial", "surname", "club-surname-initial"].includes(type)) implied.push("surname");
  return implied;
}

// A transfer round's clue is about the TRANSFER, not the career.
//
// The generic clue described the player: nationality, position, the club they
// made most appearances for, their shirt number. On "Biggest LaLiga transfers,
// 2003/04" that read "Manchester United, shirt 7" — true of Beckham, and
// nothing at all to do with the move being asked about, which is the half of
// the question that makes it guessable.
//
// Keyed by player name rather than footballer_id because a transfer row can
// name somebody the database has no footballer for at all.
export function transferCluesForWindow(windowId: number): Map<string, TenableClue> {
  const rows = sqlite.prepare(
    `SELECT player_name, nationality, position, from_club, to_club, fee_text, fee_value
     FROM transfer_window_players WHERE window_id = ?`,
  ).all(windowId) as {
    player_name: string;
    nationality: string | null;
    position: string | null;
    from_club: string | null;
    to_club: string | null;
    fee_text: string | null;
    fee_value: number | null;
  }[];

  const clues = new Map<string, TenableClue>();
  for (const r of rows) {
    clues.set(normalizeName(r.player_name).trim(), {
      nationality: r.nationality,
      position: r.position,
      years: null,
      club: null,
      clubWikiUrl: null,
      squadNumber: null,
      born: null,
      fromClub: r.from_club,
      toClub: r.to_club,
      // The written fee where there is one ("£25m"), since it is the number
      // people remember; the raw value only as a fallback.
      fee: r.fee_text ?? (r.fee_value != null ? String(r.fee_value) : null),
    });
  }
  return clues;
}

export function cluesForFootballers(ids: number[]): Map<number, TenableClue> {
  const clues = new Map<number, TenableClue>();
  if (!ids.length) return clues;

  const ph = ids.map(() => "?").join(", ");
  const meta = sqlite.prepare(
    `SELECT id, nationality, COALESCE(custom_position, position) AS position, born
     FROM footballers WHERE id IN (${ph})`,
  ).all(...ids) as { id: number; nationality: string | null; position: string | null; born: string | null }[];

  // Career span and main club from the scraped infobox career.
  const stints = sqlite.prepare(
    `SELECT footballer_id, years, club, COALESCE(apps, 0) AS apps
     FROM career_stints WHERE stint_type = 'senior' AND footballer_id IN (${ph})`,
  ).all(...ids) as { footballer_id: number; years: string; club: string; apps: number }[];

  // Shirt number: Guess the XI line-ups first, then World Cup squads.
  const numbers = sqlite.prepare(
    `SELECT footballer_id, squad_number AS n FROM xi_players
     WHERE squad_number IS NOT NULL AND footballer_id IN (${ph})
     UNION ALL
     SELECT footballer_id, shirt_number AS n FROM world_cup_squad_players
     WHERE shirt_number IS NOT NULL AND footballer_id IN (${ph})`,
  ).all(...ids, ...ids) as { footballer_id: number; n: number }[];

  // Crest for the club they played most for, so the hint can show a badge.
  const clubCrest = sqlite.prepare(
    `SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`,
  );

  for (const m of meta) {
    const mine = stints.filter((s) => s.footballer_id === m.id);
    const years = mine.flatMap((s) => (s.years.match(/\d{4}/g) ?? []).map(Number));
    const main = mine.slice().sort((a, b) => b.apps - a.apps)[0];
    const num = numbers.find((n) => n.footballer_id === m.id);
    const club = main ? main.club.replace(/^→ /, "").replace(/ \(loan\)$/, "") : null;
    const crest = club
      ? (clubCrest.get(normalizeClubAlias(club)) as { wikipedia_url: string | null } | undefined)
      : undefined;
    clues.set(m.id, {
      nationality: m.nationality,
      position: m.position,
      years: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : null,
      club,
      clubWikiUrl: crest?.wikipedia_url ?? null,
      squadNumber: num?.n ?? null,
      born: m.born,
    });
  }
  return clues;
}
