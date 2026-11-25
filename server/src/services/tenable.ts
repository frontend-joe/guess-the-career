import { normalizeName, sqlite } from "../db/client.ts";
import { normalizeClubAlias } from "../services/scraper.ts";
import { generalType } from "./general.ts";
import { deriveList, getListDef, listSummaries } from "./randomLists.ts";
import { ROUND_GROUPS, getGroup } from "./continents.ts";
import { POSITION_BUCKETS } from "./positions.ts";

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
  /**
   * How the value should READ on the board badge, when the number cannot speak
   * for itself: "6,650", "17.1m". Football answers have no use for it — a goal
   * tally is already the number you want — but one formatting rule cannot serve
   * river kilometres and country populations at once, so an authored round says
   * what its badge says.
   */
  display?: string;
  /**
   * Other names this answer is accepted under: the Yellow River is the Huang
   * He, Czechia is the Czech Republic. Spelling tolerance is the matcher's job;
   * this is for the answers that are genuinely called something else, which no
   * amount of edit distance reaches.
   */
  aliases?: string[];
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
// A club's canonical name, keyed by the Wikipedia article it links to.
//
// An infobox spells a club the way it was spelled at the time. Joe Bradford
// played 1920–35 for "Birmingham", which did not become Birmingham City until
// 1943 — so his 249 goals, more than anybody has scored for that club, sat in
// the database unreachable by a round keyed on the modern name. Wikipedia
// already knows they are one club: the infobox links "Birmingham" straight at
// Birmingham_City_F.C.
//
// So the link is the identity and the text is only a label. `clubs` holds
// several spellings per article ("Bournemouth", "AFC Bournemouth"), so the one
// chosen is the one the career-statistics tables actually use — anything else
// would be a name ALLOWED_CLUBS and club_seasons have never heard of.
const CLUB_BY_URL = `
  SELECT url, club FROM (
    SELECT c.wikipedia_url AS url, c.name AS club,
           ROW_NUMBER() OVER (
             PARTITION BY c.wikipedia_url ORDER BY cc.n DESC, c.name
           ) AS rn
    FROM clubs c
    JOIN (
      -- PLAYERS in leagues we build rounds from, not rows in the whole table.
      -- Row count picked the wrong name in production: something spells
      -- Birmingham City "Birmingham" often enough to win on rows, while
      -- having two goalscorers to the real name's hundred-odd. Counting the
      -- players a round would actually be made of settles it the way the
      -- rounds do, and restricting to allowed leagues means the name chosen
      -- is always one ALLOWED_CLUBS contains.
      SELECT REPLACE(cs.club, ' (loan)', '') AS club,
             COUNT(DISTINCT cs.footballer_id) AS n
      FROM career_statistics cs
      WHERE COALESCE(cs.league, cs.division) IN (${ALLOWED_LEAGUES_SQL})
      GROUP BY REPLACE(cs.club, ' (loan)', '')
    ) cc ON cc.club = c.name
    WHERE c.wikipedia_url IS NOT NULL
  )
  WHERE rn = 1
`;

// A career-statistics row's club, under the name the rest of the database uses
// for it — the same chain the stint branch below has had all along, finally
// applied to the table the boards are actually built from.
//
// Strip the loan arrow and marker, fold the alias map, then let the club's
// ARTICLE settle the spelling. Without it the boards took career_statistics
// at its word, and one club written two ways was two clubs: Hellas Verona and
// Verona each had their own round with half the players on it, and Dario
// Šimić's four seasons at "Internazionale Milano" were not Inter Milan's as
// far as any round was concerned.
const CS_CLUB_RAW = `normalize_club_alias(REPLACE(REPLACE(cs.club, '→ ', ''), ' (loan)', ''))`;
// The same two ways in a stint has: the row's own link, or the name's entry in
// the clubs table. Aliased first, so "Internazionale Milano" asks the clubs
// table about "Inter Milan" rather than about a name it has never heard of.
const CS_CLUB_URL = `COALESCE(cs.club_wikipedia_url, ccn.wikipedia_url)`;
const CS_CLUB = `COALESCE(ccbu.club, ${CS_CLUB_RAW})`;
const CS_CLUB_JOINS = `
  LEFT JOIN clubs ccn ON ccn.name = ${CS_CLUB_RAW}
  LEFT JOIN (${CLUB_BY_URL}) ccbu ON ccbu.url = ${CS_CLUB_URL}
`;

// Club rounds ask "most appearances FOR THIS CLUB", so they count every league
// appearance for that club, not only the ones in our five leagues. Birmingham
// City's second tier was called "First Division" until 2004, so filtering rows
// by league threw away 200 of Bryan Hughes' 248 appearances. The allow-list
// still decides WHICH CLUBS get rounds — a club qualifies if it ever played in
// one of the five — but not which of its rows count.
//
// Canonical names only, for the same reason PLAYER_CLUB uses them: a club that
// qualified under one spelling and was counted under another would vanish from
// the rounds entirely. CLUB_BY_URL picks the name carrying the most players in
// these leagues, so whatever it picks is a name this list already holds.
const ALLOWED_CLUBS = `
  SELECT DISTINCT ${CS_CLUB} AS club
  FROM career_statistics cs
  ${CS_CLUB_JOINS}
  WHERE COALESCE(cs.league, cs.division) IN (${ALLOWED_LEAGUES_SQL})
`;

const STINT_CLUB_RAW = `REPLACE(REPLACE(st.club, '→ ', ''), ' (loan)', '')`;

// A stint's club, under the name the rest of the database uses for it.
//
// The article wins outright wherever it gives an answer. An earlier version
// only used it where the infobox text appeared nowhere in career_statistics,
// meaning to be conservative, and that guard defeated the whole fix: one
// single row somewhere spelling the club "Birmingham" was enough to make the
// old name look "known", and Joe Bradford stayed invisible. It was also the
// slower of the two.
//
// Preferring the article is safe because CLUB_BY_URL already resolves each
// article to the spelling carrying the MOST career-statistics rows — so it is
// the dominant name by construction, not an arbitrary one.
const STINT_CLUB = `COALESCE(cbu.club, ${STINT_CLUB_RAW})`;

// How a stint reaches its article. Most stints store no link of their own —
// the first version of this joined on st.club_wikipedia_url alone and did
// nothing in production for exactly that reason. I had read Joe Bradford's
// URL off the footballer-card API, which FILLS ONE IN from the clubs table
// when the stint has none, and mistook the synthesised value for stored data.
//
// So the name is the way in: `clubs` carries "Birmingham" as a name in its own
// right, pointing at Birmingham_City_F.C., which is the whole chain this needs.
const STINT_CLUB_URL = `COALESCE(st.club_wikipedia_url, cn.wikipedia_url)`;

// Which clubs a player's career table already accounts for, one row per
// player per club, under the canonical name.
//
// This is the gate on the stint branch below, and it is per CLUB. It used to
// be per PLAYER — a single career-statistics row anywhere disqualified every
// stint that player had — which quietly punished the players whose table is
// PARTIAL. Dalian Atkinson's scraped table starts at Real Sociedad in 1990,
// so his four years at Ipswich and his season at Sheffield Wednesday were
// thrown away despite both spells sitting in career_stints with apps and
// goals on them. A player with no table at all was rescued; a player with
// most of one was not.
const CS_CLUB_KEYS = `
  SELECT DISTINCT cs.footballer_id AS fid, club_key(${CS_CLUB}) AS k
  FROM career_statistics cs
  ${CS_CLUB_JOINS}
  WHERE cs.club IS NOT NULL
`;

const STINT_CLUB_ANY = `
  SELECT st.footballer_id AS fid,
         ${STINT_CLUB} AS club,
         SUM(COALESCE(st.apps, 0))  AS apps,
         SUM(COALESCE(st.goals, 0)) AS goals
  FROM career_stints st
  LEFT JOIN clubs cn ON cn.name = ${STINT_CLUB_RAW}
  LEFT JOIN (${CLUB_BY_URL}) cbu ON cbu.url = ${STINT_CLUB_URL}
  -- An anti-join, not a correlated NOT EXISTS: the key set is built once
  -- rather than per stint row, and CS_CLUB_JOINS drags CLUB_BY_URL along
  -- with it. Same shape the youth-only exclusion uses in PLAYER_CLUB.
  LEFT JOIN (${CS_CLUB_KEYS}) csk
    ON csk.fid = st.footballer_id AND csk.k = club_key(${STINT_CLUB})
  WHERE st.stint_type = 'senior'
    -- The career table has nothing for THIS player at THIS club, so the
    -- stint is the only record of the spell there is. Where the table does
    -- cover the club it still wins outright: it is per season and per
    -- competition, and the stint is one rounded infobox total.
    AND csk.fid IS NULL
    AND ${STINT_CLUB} IN (${ALLOWED_CLUBS})
  GROUP BY st.footballer_id, ${STINT_CLUB}
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
           -- Deliberately the raw infobox spelling, NOT the canonical name
           -- STINT_CLUB_ANY uses. The rename fix belongs here too in
           -- principle, but it cannot be afforded: this club is joined to
           -- club_seasons below, and joining on an expression rather than a
           -- column defeats the index that join lives on. Measured on the
           -- real database, a Premier League round went from 119ms to 59
           -- SECONDS — a freeze that would hang a live game and block every
           -- other write for a minute. A club that changed its name is
           -- therefore still missing from LEAGUE rounds; it is on the club
           -- rounds, which is where it was actually asked for.
           ${STINT_CLUB_RAW} AS club,
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
// A whole career in the leagues we hold, by player. Spelled out twice inside
// the surname round before anything else needed it; one copy now, because two
// would drift and the rounds that share it would quietly disagree about what
// a career is.
const CAREER_LEAGUE_TOTAL = `
  SELECT cs.footballer_id AS fid,
         SUM(COALESCE(cs.league_apps,0))  AS apps,
         SUM(COALESCE(cs.league_goals,0)) AS goals
  FROM career_statistics cs
  WHERE ${IN_ALLOWED}
  GROUP BY cs.footballer_id
`;

// Everything a player did, counted, with no allow-list in front of it.
//
// CAREER_LEAGUE_TOTAL counts only the five leagues, and ALLOWED_CLUBS only
// clubs that have played in them. Both are right for a round whose question
// is about those leagues, and wrong for one that is not: "Brazilian
// goalkeepers" has no business excluding Rogério Ceni for spending his
// career at São Paulo.
const CAREER_TOTAL_ANY = `
  SELECT cs.footballer_id AS fid,
         SUM(COALESCE(cs.total_apps,  cs.league_apps,  0)) AS apps,
         SUM(COALESCE(cs.total_goals, cs.league_goals, 0)) AS goals
  FROM career_statistics cs
  GROUP BY cs.footballer_id
`;

// A club somebody was only ever a boy at.
//
// Wikipedia's career-statistics table sometimes carries a line for an
// academy season — David Seaman has "Leeds United 1981–82", nil in the
// league and a single appearance under Other — and that line was enough to
// make him one of Leeds United's goalkeepers. Nobody in a room would say he
// played for Leeds, and his own infobox agrees: Leeds is his YOUTH career
// and his senior career starts at Peterborough.
//
// Appearances cannot separate the two cases. Ali Al-Habsi signed for West
// Bromwich Albion as a senior keeper and never got on, nought everywhere,
// and he belongs on that board. What separates them is what the club was TO
// the player, which is exactly what the infobox's two sections say.
//
// Only youth-and-never-senior counts. A club that appears in both — came
// through the academy and then played — is a club they played for, and the
// row stays. Matching is by club_key on each side, because the statistics
// table and the infobox spell the same club differently often enough
// ("Verona" against "Hellas Verona") that anything stricter would throw out
// real spells.
const YOUTH_ONLY_CLUB = `
  SELECT y.footballer_id AS fid, club_key(y.club) AS k
  FROM career_stints y
  WHERE y.stint_type = 'youth'
    AND NOT EXISTS (
      SELECT 1 FROM career_stints sr
      WHERE sr.footballer_id = y.footballer_id
        AND sr.stint_type = 'senior'
        AND club_key(REPLACE(REPLACE(sr.club, '→ ', ''), ' (loan)', '')) = club_key(y.club)
    )
`;

const PLAYER_CLUB = `
  SELECT fid, club, SUM(apps) AS apps, SUM(goals) AS goals FROM (
    -- All competitions, not just the league: "most goals for Real Madrid"
    -- means 242 for Puskás, not his 156 La Liga goals. Cup and European
    -- scoring is part of what a player did for a club, and the league-only
    -- figure reads as plain wrong against the number everyone knows.
    -- COALESCE down to the league column for the ~1% of rows with no total.
    SELECT cs.footballer_id AS fid,
           ${CS_CLUB} AS club,
           SUM(COALESCE(cs.total_apps,  cs.league_apps,  0)) AS apps,
           SUM(COALESCE(cs.total_goals, cs.league_goals, 0)) AS goals
    FROM career_statistics cs
    ${CS_CLUB_JOINS}
    LEFT JOIN (${YOUTH_ONLY_CLUB}) yo
      ON yo.fid = cs.footballer_id AND yo.k = club_key(${CS_CLUB})
    WHERE cs.club IS NOT NULL
      AND ${NOT_RESERVE(CS_CLUB)}
      AND ${CS_CLUB} IN (${ALLOWED_CLUBS})
      AND yo.k IS NULL
    GROUP BY cs.footballer_id, ${CS_CLUB}
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

// "French Fulham players", not "France Fulham players".
//
// Nationality is stored as the country — which is right for a clue card, where
// "France" is a fact about the player — but a title is a sentence, and a
// sentence wants the adjective. There is no rule that derives one: -ish, -ian,
// -ese, -i and the handfuls that share nothing with their country's name are
// all live, so this is a list. Anything missing falls through unchanged, which
// reads as it does today rather than inventing a word.
//
// Two notes on the awkward entries. Both Congos answer to "Congolese"; only one
// of them has the players to ever reach a board, so the collision is theoretical.
// "Serbia and Montenegro" and the other compound states keep their country name,
// because "Serbian and Montenegrin Fulham players" says something else entirely.
const DEMONYMS: Record<string, string> = {
  Albania: "Albanian",
  Algeria: "Algerian",
  Angola: "Angolan",
  Argentina: "Argentine",
  Armenia: "Armenian",
  Australia: "Australian",
  Austria: "Austrian",
  Barbados: "Barbadian",
  Belarus: "Belarusian",
  Belgium: "Belgian",
  Benin: "Beninese",
  Bermuda: "Bermudian",
  "Bosnia and Herzegovina": "Bosnian",
  Brazil: "Brazilian",
  Bulgaria: "Bulgarian",
  "Burkina Faso": "Burkinabé",
  Burundi: "Burundian",
  Cameroon: "Cameroonian",
  Canada: "Canadian",
  "Cape Verde": "Cape Verdean",
  "Cayman Islands": "Caymanian",
  "Central African Republic": "Central African",
  Chile: "Chilean",
  China: "Chinese",
  Colombia: "Colombian",
  Congo: "Congolese",
  "Costa Rica": "Costa Rican",
  Croatia: "Croatian",
  Cuba: "Cuban",
  Cyprus: "Cypriot",
  "Czech Republic": "Czech",
  Czechia: "Czech",
  "DR Congo": "Congolese",
  Denmark: "Danish",
  "Dominican Republic": "Dominican",
  Ecuador: "Ecuadorian",
  Egypt: "Egyptian",
  England: "English",
  Estonia: "Estonian",
  Finland: "Finnish",
  France: "French",
  Gabon: "Gabonese",
  Gambia: "Gambian",
  Georgia: "Georgian",
  Germany: "German",
  Ghana: "Ghanaian",
  Gibraltar: "Gibraltarian",
  Greece: "Greek",
  Grenada: "Grenadian",
  Guinea: "Guinean",
  "Guinea-Bissau": "Bissau-Guinean",
  Guyana: "Guyanese",
  Haiti: "Haitian",
  Honduras: "Honduran",
  Hungary: "Hungarian",
  Iceland: "Icelandic",
  India: "Indian",
  Iran: "Iranian",
  Iraq: "Iraqi",
  Ireland: "Irish",
  Israel: "Israeli",
  Italy: "Italian",
  "Ivory Coast": "Ivorian",
  Jamaica: "Jamaican",
  Japan: "Japanese",
  Kenya: "Kenyan",
  Kosovo: "Kosovan",
  Latvia: "Latvian",
  Liberia: "Liberian",
  Lithuania: "Lithuanian",
  Luxembourg: "Luxembourgish",
  Mali: "Malian",
  Malta: "Maltese",
  Mexico: "Mexican",
  Moldova: "Moldovan",
  Montenegro: "Montenegrin",
  Montserrat: "Montserratian",
  Morocco: "Moroccan",
  Mozambique: "Mozambican",
  Netherlands: "Dutch",
  "New Zealand": "New Zealand",
  Nigeria: "Nigerian",
  "North Macedonia": "Macedonian",
  "Northern Ireland": "Northern Irish",
  Norway: "Norwegian",
  Oman: "Omani",
  Pakistan: "Pakistani",
  Panama: "Panamanian",
  Paraguay: "Paraguayan",
  Peru: "Peruvian",
  Philippines: "Filipino",
  Poland: "Polish",
  Portugal: "Portuguese",
  Romania: "Romanian",
  Russia: "Russian",
  Réunion: "Réunionese",
  "Saudi Arabia": "Saudi",
  Scotland: "Scottish",
  Senegal: "Senegalese",
  Serbia: "Serbian",
  "Sierra Leone": "Sierra Leonean",
  Slovakia: "Slovak",
  Slovenia: "Slovenian",
  "South Africa": "South African",
  "South Korea": "South Korean",
  Spain: "Spanish",
  Sweden: "Swedish",
  Switzerland: "Swiss",
  Suriname: "Surinamese",
  Tanzania: "Tanzanian",
  Togo: "Togolese",
  "Trinidad and Tobago": "Trinidadian",
  Tunisia: "Tunisian",
  Turkey: "Turkish",
  "U.S.": "American",
  USA: "American",
  Uganda: "Ugandan",
  Ukraine: "Ukrainian",
  "United States": "American",
  Uruguay: "Uruguayan",
  Uzbekistan: "Uzbek",
  Venezuela: "Venezuelan",
  Wales: "Welsh",
  Yugoslavia: "Yugoslav",
  Zaire: "Zairean",
  Zambia: "Zambian",
  Zimbabwe: "Zimbabwean",
};

export const demonym = (country: string) => DEMONYMS[country] ?? country;

export interface TenableType {
  slug: string;
  /**
   * Which game this type belongs to. Football is the default because every
   * type written before there was a second category is one of its.
   */
  category?: string;
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
  /**
   * For types where orderedness is a property of the ROUND rather than of the
   * question shape. A football type is one or the other for good — "most
   * capped" is always a ranking, "name the squad" never is — but an authored
   * round decides for itself, and the ten longest rivers and ten countries
   * beginning with S are the same type.
   */
  orderedFor?(params: Record<string, string>): boolean;
  /**
   * How deep the pool has to be before this type offers a round, when
   * MIN_ANSWERS is not the right bar.
   *
   * A ranked round wants exactly ten and the tenth is the answer, so ten is
   * the bar. An unordered one asks for any ten OF a pool, and a pool of ten
   * is not "any ten" — it is every single one, with no room to forget
   * anybody. Half of the first specific-position boards were like that.
   *
   * Used by candidates() when offering a round and by the prune, so a round
   * stops being offered and stops existing on the same test.
   */
  minAnswers?: number;
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

// Which letter round a surname belongs to.
//
// SQLite's UPPER is ASCII-only, so "Özil" and "Østenstad" bucketed under Ö and
// Ø — letters that are not BETWEEN 'A' AND 'Z', so those players fell out of
// every letter round rather than landing in a wrong one. Mesut Özil has 19
// Premier League goals and was simply absent from the O board.
//
// normalize() is the same accent folding the guess matcher uses, which is what
// makes this right rather than merely different: a name is bucketed by the
// letter a person would say it starts with, and matched by the same rule.
//
// Only the FIRST character goes through it. Folding the whole surname would
// be the same answer at several times the work, and this runs over every
// player in the league on each derivation.
//
// The outer SUBSTR keeps the result one character. A few letters transliterate
// to two — ß to "ss", þ to "th" — and "TH" is BETWEEN 'A' AND 'Z', so without
// it an Icelandic surname would quietly invent a letter round called TH.
const SURNAME_INITIAL = `UPPER(SUBSTR(normalize(SUBSTR(f.surname, 1, 1)), 1, 1))`;

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
       SELECT pl.league AS league, ${SURNAME_INITIAL} AS letter, COUNT(*) AS n
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE f.surname IS NOT NULL AND f.surname <> '' AND pl.${col} > 0
         AND ${SURNAME_INITIAL} BETWEEN 'A' AND 'Z'
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
       WHERE pl.league = ? AND ${SURNAME_INITIAL} = ? AND pl.${col} > 0
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
      `WITH tot AS (${CAREER_LEAGUE_TOTAL})
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
      `WITH tot AS (${CAREER_LEAGUE_TOTAL})
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
  title: (p, m) => `${demonym(p.nationality)} ${p.league} players (most ${metricWord(m)})`,
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

// ── 4b. Continent or region × league ─────────────────────────────────────────
//
// The same question as the club one next door, asked of a league: "Eastern
// European Serie A players", "Scandinavian Premier League players". A league
// is the wider net of the two — a club's Scandinavians are a handful, a
// league's are a generation — so this is where the smaller regions get boards
// at all.
const continentLeague: TenableType = {
  slug: "continent-league",
  label: "Where they are from, in a league",
  description: "Top of a league filtered to one continent or region.",
  example: "Most Serie A appearances by Eastern European players",
  title: (p, m) =>
    `${getGroup(p.continent)?.adjective ?? p.continent} ${p.league} players (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const out: Candidate[] = [];
    for (const group of ROUND_GROUPS) {
      const ph = group.nations.map(() => "?").join(", ");
      const rows = sqlite.prepare(
        `WITH pl AS (${PLAYER_LEAGUE})
         SELECT pl.league AS league, COUNT(*) AS n
         FROM pl JOIN footballers f ON f.id = pl.fid
         WHERE f.nationality IS NOT NULL AND LOWER(f.nationality) IN (${ph})
           AND pl.${col} > 0
         GROUP BY pl.league
         HAVING n >= ${MIN_ANSWERS}
         ORDER BY n DESC`,
      ).all(...group.nations.map((n) => n.toLowerCase())) as { league: string; n: number }[];
      for (const r of rows) {
        out.push({
          type: this.slug,
          params: { continent: group.slug, league: r.league },
          metric,
          title: this.title({ continent: group.slug, league: r.league }, metric),
          answer_count: r.n,
        });
      }
    }
    return out;
  },
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    const group = getGroup(p.continent);
    if (!group) return [];
    const ph = group.nations.map(() => "?").join(", ");
    return sqlite.prepare(
      `WITH pl AS (${PLAYER_LEAGUE})
       SELECT ${ANSWER_COLS}, pl.${col} AS value
       FROM pl JOIN footballers f ON f.id = pl.fid
       WHERE pl.league = ? AND LOWER(f.nationality) IN (${ph}) AND pl.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.league, ...group.nations.map((n) => n.toLowerCase())) as TenableAnswer[];
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
  SELECT DISTINCT cs.footballer_id AS fid, ${CS_CLUB} AS club
  FROM career_statistics cs
  ${CS_CLUB_JOINS}
  WHERE cs.club IS NOT NULL
    AND ${NOT_RESERVE(CS_CLUB)}
    AND ${CS_CLUB} IN (${ALLOWED_CLUBS})
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
  title: (p, m) => `${demonym(p.nationality)} ${p.club} players (most ${metricWord(m)})`,
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

// ── 8b. Position at a club (unordered — name any 10) ─────────────────────────
//
// "Arsenal goalkeepers", "Barcelona midfielders". The question a room can
// always have a go at: you do not need to know who made the most
// appearances, you need to remember who kept goal.
//
// Unordered, and not because ranking is hard — PLAYER_CLUB would rank them
// quite happily — but because the ranking would be a different question.
// "Arsenal goalkeepers by appearances" is a top ten that four people get
// three of; "name any ten Arsenal goalkeepers" is a pub argument with
// seventeen right answers, and the pool at a big club is deep enough that
// finding ten is the game. So the whole pool is the board and any ten of it
// wins, exactly like a World Cup squad.
//
// Membership is the player's WHOLE position list, which is the point. Dennis
// Bergkamp belongs on the forwards board and on the midfielders board
// because he was both, and reading only the first word of his infobox would
// leave him off one of them. See services/positions.ts.
const POSITION_PLURAL = new Map(POSITION_BUCKETS.map((b) => [b.bucket as string, b.plural]));

const IS_BUCKET = (col: string) =>
  `position_buckets(f.custom_position, f.position) LIKE '%|' || ${col} || '|%'`;

// A board with no number on it.
//
// These rounds ask who was one of a group — Arsenal's goalkeepers, Brazil's
// goalkeepers — and the pool is the answer, so nothing is ranked and the row
// numbers are not drawn. An appearance count next to the name therefore
// scores nothing and explains nothing; it just looks like a ranking that
// isn't one, and it invites an argument about a figure the round never
// asked about.
//
// Both apps suppress the badge when there is no unit and the number is zero,
// which is how a squad round's shirt numbers stay off the board. Emitting
// that pair is what "no badge" means on the wire, so this needs no new app.
const NO_BADGE = "0 AS value";

// Twice the board. "Name any ten of these twelve" is not a question about
// what you know, it is a question about whether you can think of the two you
// are allowed to miss — and at ten it is a memory test with no margin at all.
const POSITION_MIN = ROUND_SIZE * 2;

const clubPosition: TenableType = {
  slug: "club-position",
  minAnswers: POSITION_MIN,
  label: "Position at a club",
  description: "Name any 10 of a club's goalkeepers, defenders, midfielders or forwards.",
  example: "Name 10 Arsenal goalkeepers",
  ordered: false,
  metricless: true,
  title: (p) => `${p.club} ${POSITION_PLURAL.get(p.position) ?? p.position}`,
  candidates() {
    const rows = sqlite.prepare(
      `WITH tot AS (${PLAYER_CLUB})
       SELECT tot.club AS club, b.bucket AS bucket, COUNT(*) AS n
       FROM tot
       JOIN footballers f ON f.id = tot.fid
       JOIN (${POSITION_BUCKETS.map((b) => `SELECT '${b.bucket}' AS bucket`).join(" UNION ALL ")}) b
         ON ${IS_BUCKET("b.bucket")}
       GROUP BY tot.club, b.bucket
       HAVING n >= ${POSITION_MIN}
       ORDER BY n DESC`,
    ).all() as { club: string; bucket: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { club: r.club, position: r.bucket },
      metric: "apps" as Metric,
      title: this.title({ club: r.club, position: r.bucket }, "apps"),
      answer_count: r.n,
    }));
  },
  answers(p, _metric, _limit = ROUND_SIZE) {
    // The WHOLE pool, like a World Cup squad — the room only needs any ten.
    //
    // No badge. See NO_BADGE: the question is whether they were one of the
    // club's keepers, and an appearance count answers a question nobody
    // asked — wrongly, often enough. Ali Al-Habsi signed for West Bromwich
    // Albion in 2019 and never got on; he was still one of their keepers.
    //
    // Appearances still ORDER the pool, because the snapshot is only the
    // first two hundred and the players worth having are the ones who played.
    return sqlite.prepare(
      `WITH tot AS (${PLAYER_CLUB})
       SELECT ${ANSWER_COLS}, ${NO_BADGE}
       FROM tot
       JOIN footballers f ON f.id = tot.fid
       WHERE tot.club = ? AND ${IS_BUCKET("?")}
       ORDER BY tot.apps DESC, f.name ASC`,
    ).all(p.club, p.position) as TenableAnswer[];
  },
};

// ── 8b2. Position by nationality (unordered — name any 10) ───────────────────
//
// "Brazilian goalkeepers", "Italian defenders". The club round next door asks
// who kept goal for Arsenal; this asks who kept goal for Brazil's entire
// footballing history, which is a bigger room and an easier one — you do not
// need to have followed a club to have an opinion about Brazilian keepers.
//
// Ranked by career league appearances on the badge only, like the club
// version: the board is the whole pool and any ten of it wins.
const nationalityPosition: TenableType = {
  slug: "nationality-position",
  minAnswers: POSITION_MIN,
  label: "Position by nationality",
  description: "Name any 10 of a country's goalkeepers, defenders, midfielders or forwards.",
  example: "Name 10 Brazilian goalkeepers",
  ordered: false,
  metricless: true,
  title: (p) => `${demonym(p.nationality)} ${POSITION_PLURAL.get(p.position) ?? p.position}`,
  candidates() {
    // Membership is being in the database at all, not having played
    // somewhere we happen to hold a league table for. The database is
    // already a curated three thousand, so "Brazilian and a goalkeeper" is
    // the whole question.
    const rows = sqlite.prepare(
      `SELECT f.nationality AS nationality, b.bucket AS bucket, COUNT(*) AS n
       FROM footballers f
       JOIN (${POSITION_BUCKETS.map((b) => `SELECT '${b.bucket}' AS bucket`).join(" UNION ALL ")}) b
         ON ${IS_BUCKET("b.bucket")}
       WHERE f.nationality IS NOT NULL AND f.nationality <> ''
       GROUP BY f.nationality, b.bucket
       HAVING n >= ${POSITION_MIN}
       ORDER BY n DESC`,
    ).all() as { nationality: string; bucket: string; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { nationality: r.nationality, position: r.bucket },
      metric: "apps" as Metric,
      title: this.title({ nationality: r.nationality, position: r.bucket }, "apps"),
      answer_count: r.n,
    }));
  },
  answers(p, _metric, _limit = ROUND_SIZE) {
    // No badge, for the reasons at NO_BADGE — and most sharply here. A
    // career-statistics table is what the appearance count is summed from,
    // and roughly a quarter of players on file have no such table on
    // Wikipedia at all: everything they did is in the infobox instead. Zetti
    // kept goal 155 times for São Paulo and read "0 apps" on a board of
    // Brazilian goalkeepers, which is not a hard number to argue with.
    //
    // LEFT JOIN, so those players are still answers, which they always were.
    return sqlite.prepare(
      `WITH tot AS (${CAREER_TOTAL_ANY})
       SELECT ${ANSWER_COLS}, ${NO_BADGE}
       FROM footballers f
       LEFT JOIN tot ON tot.fid = f.id
       WHERE f.nationality = ? AND ${IS_BUCKET("?")}
       ORDER BY COALESCE(tot.apps, 0) DESC, f.name ASC`,
    ).all(p.nationality, p.position) as TenableAnswer[];
  },
};

// ── 8c. Continent or region at a club ──────────────────────────────────────────────────
//
// "South American Arsenal players", "African Roma players". The nationality
// round next door asks one country at a time, which at a club is often a
// question with four answers and no board — but a club's Africans or its South
// Americans are a group everybody who follows it can picture, and nobody can
// list.
//
// Europe is deliberately not among them: see Continent.asksRounds.
const continentClub: TenableType = {
  slug: "continent-club",
  label: "Where they are from, at a club",
  description: "Players from one continent or region who turned out for one club.",
  example: "Name 10 South American players who turned out for Arsenal",
  title: (p, m) =>
    `${getGroup(p.continent)?.adjective ?? p.continent} ${p.club} players (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const out: Candidate[] = [];
    for (const cont of ROUND_GROUPS) {
      const ph = cont.nations.map(() => "?").join(", ");
      const rows = sqlite.prepare(
        `WITH tot AS (${PLAYER_CLUB})
         SELECT tot.club AS club, COUNT(*) AS n
         FROM tot JOIN footballers f ON f.id = tot.fid
         WHERE f.nationality IS NOT NULL AND LOWER(f.nationality) IN (${ph})
           AND tot.${col} > 0
         GROUP BY tot.club
         HAVING n >= ${MIN_ANSWERS}
         ORDER BY n DESC`,
      ).all(...cont.nations.map((n) => n.toLowerCase())) as { club: string; n: number }[];
      for (const r of rows) {
        out.push({
          type: this.slug,
          params: { continent: cont.slug, club: r.club },
          metric,
          title: this.title({ continent: cont.slug, club: r.club }, metric),
          answer_count: r.n,
        });
      }
    }
    return out;
  },
  answers(p, metric, limit = ROUND_SIZE) {
    const col = metricCol(metric);
    const cont = getGroup(p.continent);
    if (!cont) return [];
    const ph = cont.nations.map(() => "?").join(", ");
    return sqlite.prepare(
      `WITH tot AS (${PLAYER_CLUB})
       SELECT ${ANSWER_COLS}, tot.${col} AS value
       FROM tot JOIN footballers f ON f.id = tot.fid
       WHERE tot.club = ? AND LOWER(f.nationality) IN (${ph}) AND tot.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.club, ...cont.nations.map((n) => n.toLowerCase())) as TenableAnswer[];
  },
};

// ── 8b. Overseas players at an English club ──────────────────────────────────
// Which country a club belongs to, for "overseas" to mean anything.
//
// Read off the leagues it has actually played in, and ONLY the leagues one
// country uses. "Premier League" is deliberately absent: England does not own
// the name, and a career table writes Ukraine's top flight and Russia's the
// same way. One such row — Cristiano Lucarelli, Shakhtar Donetsk, 2007-08 —
// was enough to file Shakhtar as English and drop "Shakhtar Donetsk's
// overseas players" into a list of rounds built from Chelsea and Everton.
//
// English clubs lose nothing by the omission: they all have Championship or
// First Division history behind them. A club with no unambiguous league at
// all simply has no country, and gets no round, which is the right answer for
// a club we cannot place.
// Every English tier, not just the two that happen to be in ALLOWED_LEAGUES.
// Picking from that list alone cost Oldham Athletic its country — a club whose
// unambiguous history is League One and the old Second Division — and with it
// a round it had always had.
const LEAGUE_COUNTRY: Record<string, string> = {
  "First Division": "England",
  "Second Division": "England",
  "Third Division": "England",
  "Fourth Division": "England",
  "Third Division North": "England",
  "Third Division South": "England",
  "EFL Championship": "England",
  Championship: "England",
  "League One": "England",
  "League Two": "England",
  "Serie A": "Italy",
  "La Liga": "Spain",
  Bundesliga: "Germany",
};

const CLUB_COUNTRY = `
  SELECT club, country FROM (
    SELECT REPLACE(cs.club, ' (loan)', '') AS club,
           CASE COALESCE(cs.league, cs.division)
             ${Object.entries(LEAGUE_COUNTRY)
               .map(([lg, c]) => `WHEN '${lg}' THEN '${c}'`)
               .join("\n             ")}
           END AS country,
           ROW_NUMBER() OVER (
             PARTITION BY REPLACE(cs.club, ' (loan)', '')
             -- Most players decides it, for the handful of clubs that have
             -- turned out in more than one country's league.
             ORDER BY COUNT(DISTINCT cs.footballer_id) DESC
           ) AS rn
    FROM career_statistics cs
    WHERE COALESCE(cs.league, cs.division) IN (${Object.keys(LEAGUE_COUNTRY)
      .map((l) => `'${l}'`)
      .join(", ")})
    GROUP BY 1, 2
  )
  WHERE rn = 1
`;

const overseasClub: TenableType = {
  slug: "overseas-club",
  label: "Overseas players at a club",
  description: "Players from outside the club's own country who turned out for it.",
  example: "Name 10 overseas players who turned out for Chelsea",
  title: (p, m) => `${possessive(p.club)} overseas players (most ${metricWord(m)})`,
  candidates(metric) {
    const col = metricCol(metric);
    const rows = sqlite.prepare(
      `WITH tot AS (${PLAYER_CLUB}), cc AS (${CLUB_COUNTRY})
       SELECT tot.club AS club, COUNT(*) AS n
       FROM tot
       JOIN footballers f ON f.id = tot.fid
       JOIN cc ON cc.club = tot.club
       WHERE tot.${col} > 0
         AND f.nationality IS NOT NULL AND f.nationality <> ''
         AND LOWER(f.nationality) <> LOWER(cc.country)
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
    // The country is looked up rather than passed in the params: a round
    // frozen before this was anything but English has only a club name in it,
    // and the answers still have to come out right.
    return sqlite.prepare(
      `WITH tot AS (${PLAYER_CLUB}), cc AS (${CLUB_COUNTRY})
       SELECT ${ANSWER_COLS}, tot.${col} AS value
       FROM tot
       JOIN footballers f ON f.id = tot.fid
       JOIN cc ON cc.club = tot.club
       WHERE tot.club = ? AND tot.${col} > 0
         AND f.nationality IS NOT NULL
         AND LOWER(f.nationality) <> LOWER(cc.country)
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

// ── 10. Ballon d'Or ──────────────────────────────────────────────────────────
//
// The one round whose ranking was not derived from anything: a jury voted, the
// order is the order, and no amount of better data will ever move it. That
// makes it the most stable round in the game — every other football round is
// an argument with a database that keeps improving underneath it.
//
// The board's slot is the position in this list, and the badge is the vote
// count, because the gap is the story: Ronaldo beat Messi by 165 points in
// 2008 and that is worth seeing on the board.
const ballonDor: TenableType = {
  slug: "ballon-dor",
  label: "Ballon d'Or",
  description: "The final voting order of a single Ballon d'Or.",
  example: "The 2008 Ballon d'Or final ranking",
  metricless: true,
  title: (p) => `The ${p.year} Ballon d'Or final ranking`,
  candidates() {
    const rows = sqlite.prepare(
      `SELECT bd.id AS ballonDorId, bd.year AS year, COUNT(*) AS n
       FROM ballon_dor_players p
       JOIN ballon_dors bd ON bd.id = p.ballon_dor_id
       GROUP BY bd.id
       HAVING n >= ${MIN_ANSWERS}
       ORDER BY bd.year DESC`,
    ).all() as { ballonDorId: number; year: number; n: number }[];
    return rows.map((r) => ({
      type: this.slug,
      params: { ballonDorId: String(r.ballonDorId), year: String(r.year) },
      metric: "goals" as Metric,
      title: this.title({ year: String(r.year) }, "goals"),
      answer_count: r.n,
    }));
  },
  answers(p, _metric, limit = ROUND_SIZE) {
    // The older ballots were reported as an order with no numbers attached.
    // Those years carry no unit, which is how the board knows to draw the name
    // alone rather than a badge reading zero next to a correct answer.
    //
    // Ties are left exactly as they were voted rather than broken by a rule
    // the jury never applied. Henry and Zidane both polled 14 in 2001, so they
    // take the ninth and tenth slots and both badges read 14 — which says
    // "these two are level" on the board without needing to be explained.
    return sqlite.prepare(
      `SELECT p.footballer_id AS footballer_id, p.name AS name,
              p.nationality AS nationality, f.photo_url AS photo_url,
              COALESCE(p.points, 0) AS value,
              CASE WHEN p.points IS NOT NULL THEN 'pts' END AS unit
       FROM ballon_dor_players p
       LEFT JOIN footballers f ON f.id = p.footballer_id
       WHERE p.ballon_dor_id = ?
       ORDER BY p.rank ASC, p.name ASC LIMIT ${limit}`,
    ).all(parseInt(p.ballonDorId, 10)) as TenableAnswer[];
  },
};

// ── 11. World Cup squad (unordered — name any 10) ────────────────────────────
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

// ── 12. Random list (unordered — name any 10) ────────────────────────────────
//
// The Random Lists mode already asks the best questions in the database —
// full-backs over 6ft, players with an animal in their name — and they were
// only ever playable on their own, one list a day, alone in a browser. They
// are a Tenable round in every respect that matters: a rule, a pool of players
// it is true of, and no sensible way to rank them. So they become one.
//
// Unordered, like a World Cup squad: the pool is 23 to 200 deep and nobody is
// going to name all of it, so finding any ten wins. The list's own stat goes
// on the badge, because "6'2"" is the point of a height list and 188 is not.
const randomList: TenableType = {
  slug: "random-list",
  label: "Random list",
  description: "Name any 10 players a bespoke rule is true of.",
  example: "Full-backs taller than 6ft (183cm)",
  ordered: false,
  metricless: true,
  // The subtitle, not the title. "An animal in their name" is a joke you have
  // to be in on; "Players with an animal hiding in their name" is the rule,
  // and on a board where a wrong answer goes red the rule is what is owed.
  title: (p) => getListDef(p.listId)?.subtitle ?? p.listId,
  candidates() {
    return listSummaries()
      .filter((l) => l.poolCount >= MIN_ANSWERS)
      .map((l) => ({
        type: this.slug,
        params: { listId: l.id },
        metric: "goals" as Metric,
        title: l.subtitle,
        answer_count: l.poolCount,
      }));
  },
  answers(p) {
    // The WHOLE pool, like a squad: every one of them is a right answer.
    return (deriveList(p.listId) ?? []).map((pl) => ({
      footballer_id: pl.id,
      name: pl.name,
      nationality: pl.nationality,
      photo_url: pl.photo_url,
      value: pl.value,
      display: pl.stat,
    }));
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
       SELECT pc.club AS club, ${SURNAME_INITIAL} AS letter, COUNT(*) AS n
       FROM pc JOIN footballers f ON f.id = pc.fid
       WHERE pc.${col} > 0 AND f.surname IS NOT NULL AND f.surname <> ''
         AND ${SURNAME_INITIAL} BETWEEN 'A' AND 'Z'
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
       WHERE pc.club = ? AND ${SURNAME_INITIAL} = ? AND pc.${col} > 0
       ORDER BY value DESC, f.name ASC LIMIT ${limit}`,
    ).all(p.club, p.letter.toUpperCase()) as TenableAnswer[];
  },
};

// ── 12. Club record signings / record sales ──────────────────────────────────
//
// Both come from the same transfermarkt scrape, mirrored into two sets of
// tables, and they ask the same question from opposite ends: who a club paid
// the most for, and who it was paid the most for. One factory, two types.
//
// These are ordered, and unusually safe to order. Every other ranked type is a
// derived aggregate that shifts as the scrape improves; this one arrives
// already ranked, by fee, from the single source that priced it, so there is no
// argument about where the ninth-biggest signing sits.
//
// What the data has no room for is a TAIL. The scrape stops at ten rows per
// club, which is exactly the board, so a guess just off it cannot be told it
// came eleventh — it is a plain miss. Every other ordered type freezes fifty
// and has that feedback to give. Nothing to fix here: the eleventh-biggest
// signing is not in the data at all, and inventing a rank for it would be
// worse than saying nothing.
const PRICED = `p.fee_value IS NOT NULL AND p.fee_value > 0`;

// Transfermarkt writes "Rangers FC" and "Villarreal CF". Nobody says the suffix
// out loud, and a round title is read out loud. Title only — the stored club
// name is what the scrape keys on and is left alone.
const clubLabel = (name: string) => name.replace(/\s+(?:FC|CF)$/i, "");

// Filled in by recordTransferType below, so the clue lookup at the bottom of
// the file cannot drift from the type it belongs to.
const RECORD_TRANSFERS = new Map<string, RecordTransferTables>();

interface RecordTransferTables {
  /** Table prefix, e.g. 'record_signings'. */
  tables: string;
  /**
   * Which end of the move the OTHER club is. Both tables keep it in the same
   * `from_club` column: on a signings row it is who the player was bought
   * from, on a sales row it is who they were sold to.
   */
  otherEnd: "fromClub" | "toClub";
}

function recordTransferType(
  cfg: RecordTransferTables & {
    slug: string;
    label: string;
    description: string;
    example: string;
    /** How the title reads after the club's name. */
    noun: string;
  },
): TenableType {
  const clubs = `${cfg.tables}_clubs`;
  const players = `${cfg.tables}_players`;
  RECORD_TRANSFERS.set(cfg.slug, cfg);
  return {
    slug: cfg.slug,
    label: cfg.label,
    description: cfg.description,
    example: cfg.example,
    // Fee is the only ranking these have, and it is not goals or apps.
    metricless: true,
    title: (p) => `${possessive(clubLabel(p.club))} ${cfg.noun}`,
    candidates() {
      const rows = sqlite.prepare(
        `SELECT c.id AS clubId, c.club AS club, COUNT(*) AS n
         FROM ${players} p JOIN ${clubs} c ON c.id = p.club_id
         WHERE ${PRICED} AND c.active = 1
         GROUP BY c.id
         HAVING n >= ${MIN_ANSWERS}
         ORDER BY n DESC, c.club ASC`,
      ).all() as { clubId: number; club: string; n: number }[];
      return rows.map((r) => ({
        type: this.slug,
        params: { clubId: String(r.clubId), club: r.club },
        metric: "goals" as Metric,
        title: this.title({ club: r.club }, "goals"),
        answer_count: r.n,
      }));
    },
    answers(p, _metric, limit = ROUND_SIZE) {
      return sqlite.prepare(
        `SELECT p.footballer_id AS footballer_id, p.player_name AS name,
                p.nationality AS nationality, f.photo_url AS photo_url,
                p.fee_value AS value, 'fee' AS unit
         FROM ${players} p
         LEFT JOIN footballers f ON f.id = p.footballer_id
         WHERE p.club_id = ? AND ${PRICED}
         ORDER BY p.fee_value DESC, p.player_name ASC LIMIT ${limit}`,
      ).all(parseInt(p.clubId, 10)) as TenableAnswer[];
    },
  };
}

const recordSignings = recordTransferType({
  slug: "record-signings",
  label: "Club record signings",
  description: "The most a club has ever paid, ranked by fee.",
  example: "Arsenal's record signings",
  tables: "record_signings",
  otherEnd: "fromClub",
  noun: "record signings",
});

const recordSales = recordTransferType({
  slug: "record-sales",
  label: "Club record sales",
  description: "The most a club has ever been paid, ranked by fee.",
  example: "Southampton's biggest sales",
  tables: "record_sales",
  otherEnd: "toClub",
  noun: "biggest sales",
});

export const TENABLE_TYPES: TenableType[] = [
  surnameInitial,
  surnameLength,
  nationality,
  continentLeague,
  club,
  clubSurnameInitial,
  leagueAllTime,
  twoClubs,
  nationalityClub,
  clubPosition,
  nationalityPosition,
  continentClub,
  overseasClub,
  transferWindow,
  ballonDor,
  worldCupSquad,
  randomList,
  recordSignings,
  recordSales,
  firstName,
  surname,
  generalType,
];

export interface TenableCategory {
  slug: string;
  label: string;
  description: string;
}

// The games Tenable is made of. One board, one set of rules, more than one
// subject — and a category is the only thing that tells them apart, from the
// admin menu down to which rounds a room is offered.
export const TENABLE_CATEGORIES: TenableCategory[] = [
  {
    slug: "football",
    label: "Football",
    description: "Derived from the footballer database — leagues, clubs, nations, names.",
  },
  {
    slug: "general",
    label: "General",
    description: "Authored lists — any subject, answers typed in by hand.",
  },
];

export function getCategory(slug: string): TenableCategory | undefined {
  return TENABLE_CATEGORIES.find((c) => c.slug === slug);
}

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
//
// Unordered rounds used to be prefixed "Name any 10:", on the reasoning that
// ten slots under "Defenders with 50+ senior career goals" read as THE ten
// defenders when it is any ten of forty-eight. The board says it better than
// the title can: an unordered one draws no rank numbers down the left, so the
// slots are plainly a list rather than places. The prefix was a caption on a
// picture that already made sense, and it was on the front of every title in
// the picker, where it is the one part that is the same on all of them.
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

export function isOrdered(slug: string, params?: Record<string, string>): boolean {
  const t = getType(slug);
  if (!t) return true;
  if (t.orderedFor && params) return t.orderedFor(params);
  return t.ordered !== false;
}

/** Which game a round belongs to. Anything unrecognised is football's. */
export function categoryOf(slug: string): string {
  return getType(slug)?.category ?? "football";
}

// One person, one slot. The database occasionally holds the same player
// twice — Wikipedia serves an article under both a raw-unicode URL and a
// percent-encoded one, so a scrape that looked up ".../Lothar_Matth%C3%A4us"
// did not find ".../Lothar_Matthäus" and made a second Lothar Matthäus. The
// two records carry identical career statistics, so the derivation ranked
// them side by side and a Germany Serie A board showed him on 115 twice.
//
// The URL comparison is fixed where the duplicate is created, but a board is
// worth defending in its own right: whatever the data says, a name cannot
// occupy two slots, because a guess reveals a NAME and nobody can say which
// of the two rows they meant. Overfetch, drop the repeats, then cut to size,
// so losing one still leaves a full ten.
const DUPLICATE_MARGIN = 10;

function dedupeByName(rows: TenableAnswer[]): TenableAnswer[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    // Authored rounds are left alone: their answers are typed by hand, and a
    // repeat there is somebody's deliberate list, not a scraping accident.
    if (r.footballer_id == null) return true;
    const key = normalizeName(r.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function answersForRound(
  type: string,
  params: Record<string, string>,
  metric: Metric,
  limit = ROUND_SIZE,
): TenableAnswer[] {
  const rows = getType(type)?.answers(params, metric, limit + DUPLICATE_MARGIN) ?? [];
  const deduped = dedupeByName(rows);
  // A limit is a cut-off in a RANKING: the top ten, and a tail kept to tell a
  // near miss how near it was. An unordered round has no ranking to cut — its
  // answers are a pool and every one of them is right — so cutting it would
  // quietly turn correct answers into wrong ones. Two hundred Africans who
  // played in England are two hundred right answers.
  return isOrdered(type, params) ? deduped.slice(0, limit) : deduped;
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
  /**
   * How old they are, not the date they were born.
   *
   * The date was the clue for a while and it is the wrong unit: a room gets
   * "1989-02-26" and does the subtraction out loud, which is arithmetic
   * homework in the middle of a party game. The number they were going to
   * work out is the clue.
   *
   * Computed when the clue is built rather than when it is read, so a round
   * frozen today still says 36 when the recording is watched in five years.
   * Everything else in a clue is a snapshot; this is too.
   *
   * It is an age for somebody still alive. Nothing on file records a death,
   * so a player who has died reads as the age they would have been — the
   * birth date had the same gap, one subtraction further away.
   */
  age: number | null;
  // Transfer rounds only. The career fields above describe the player; these
  // describe the MOVE, which is what the question is actually about.
  fromClub?: string | null;
  toClub?: string | null;
  fee?: string | null;
}

// Anything the question already gives away is suppressed — no point "hinting"
// the nationality on a Norway round.
export function impliedCluesFor(type: string, params?: Record<string, string>): string[] {
  const implied: string[] = [];
  // A random list carries its own, because the giveaway is the RULE and not
  // the shape of the question: "Full-backs over 6ft" hands you the position,
  // "An animal in their name" hands you nothing.
  if (type === "random-list" && params?.listId) {
    return getListDef(params.listId)?.impliedClues ?? [];
  }
  if (["nationality", "nationality-club", "world-cup-squad", "nationality-position"].includes(type)) implied.push("nationality");
  if (["club", "two-clubs", "nationality-club", "overseas-club", "club-surname-initial", "continent-club", "club-position"].includes(type)) implied.push("club");
  if (["surname-length", "surname-initial", "surname", "club-surname-initial"].includes(type)) implied.push("surname");
  // "Arsenal goalkeepers" has already said what the position is, and the
  // clue card would spend a clue restating the question.
  if (type === "club-position" || type === "nationality-position") implied.push("position");
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
      age: null,
      fromClub: r.from_club,
      toClub: r.to_club,
      // The written fee where there is one ("£25m"), since it is the number
      // people remember; the raw value only as a fallback.
      fee: r.fee_text ?? (r.fee_value != null ? String(r.fee_value) : null),
    });
  }
  return clues;
}

// Same idea as transferCluesForWindow, for a club's record signings or sales:
// the question is about the MOVE, so the clue is the move.
//
// Keyed by player name for the same reason — a scraped transfer row can name
// somebody the footballer database has no record of.
export function recordTransferClues(
  cfg: RecordTransferTables,
  clubId: number,
): Map<string, TenableClue> {
  const rows = sqlite.prepare(
    `SELECT player_name, nationality, position, from_club, fee_text, fee_value, season_label
     FROM ${cfg.tables}_players WHERE club_id = ?`,
  ).all(clubId) as {
    player_name: string;
    nationality: string | null;
    position: string | null;
    from_club: string | null;
    fee_text: string | null;
    fee_value: number | null;
    season_label: string | null;
  }[];

  const clues = new Map<string, TenableClue>();
  for (const r of rows) {
    clues.set(normalizeName(r.player_name).trim(), {
      nationality: r.nationality,
      position: r.position,
      // The season the move happened, under the "Years" label both apps
      // already draw. A single transfer has no career span to put there.
      years: r.season_label,
      club: null,
      clubWikiUrl: null,
      squadNumber: null,
      age: null,
      // Only the FAR end of the move is a clue. The near end is the club in
      // the question: naming Arsenal on "Arsenal's record signings" tells
      // nobody anything, and both tables keep the far end in from_club.
      fromClub: cfg.otherEnd === "fromClub" ? r.from_club : null,
      toClub: cfg.otherEnd === "toClub" ? r.from_club : null,
      // The written fee where there is one ("€116.60m"), since it is the
      // number people remember; the raw value only as a fallback.
      fee: r.fee_text ?? (r.fee_value != null ? String(r.fee_value) : null),
    });
  }
  return clues;
}

// Does this round describe moves rather than careers, and if so what are they?
//
// One dispatcher rather than a check at each call site, because there is more
// than one place that writes a board's clues: the freeze, and the rebuild after
// a guess is counted that the database did not know. The rebuild only knew
// about career clues, so correcting somebody on a transfer round used to wipe
// every fee, from and to off the board it had just rewritten.
export function moveCluesFor(
  type: string,
  params: Record<string, string>,
): Map<string, TenableClue> | null {
  if (type === "transfer-window" && params.windowId) {
    return transferCluesForWindow(parseInt(params.windowId, 10));
  }
  const record = RECORD_TRANSFERS.get(type);
  if (record && params.clubId) {
    return recordTransferClues(record, parseInt(params.clubId, 10));
  }
  return null;
}

/**
 * The real surnames of these players, as the database records them.
 *
 * Worth asking rather than guessing. Taking the last word of a name gets
 * "Sar" for Edwin van der Sar, "Gea" for David de Gea, "Jr" for Alan Kelly Jr.
 * and "Zhi" for Zheng Zhi — whose surname is Zheng, the FIRST word. The
 * footballers table already holds the answer for all of them, split when the
 * player was imported, so a board can carry it instead of a heuristic.
 *
 * Only players have one. An authored answer, or a scraped transfer row naming
 * somebody with no footballer record, has no id to look up and falls back to
 * the last word — which is the best available guess and what every board did
 * before this.
 */
export function surnamesForFootballers(ids: number[]): Map<number, string> {
  if (!ids.length) return new Map()
  const rows = sqlite
    .prepare(
      `SELECT id, surname FROM footballers
       WHERE id IN (${ids.map(() => '?').join(',')}) AND surname IS NOT NULL AND surname != ''`,
    )
    .all(...ids) as { id: number; surname: string }[]
  return new Map(rows.map((r) => [r.id, r.surname]))
}

/**
 * Whole years between a birth date and today, counted the way a person counts
 * them: your birthday has to have been and gone.
 *
 * Not days divided by 365.25, which is a year out for anybody in the week
 * either side of their birthday — and a clue that is a year wrong is worse
 * than no clue, because it is believed.
 */
function ageOn(born: string | null, today = new Date()): number | null {
  const m = born?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  let age = today.getFullYear() - y;
  // getMonth is 0-based; the stored month is not.
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
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
    // An infobox writes an unfinished spell "2020–", with nothing after the
    // dash, and that open end is the only thing on file that says a player
    // has not retired. Without it the span closed on the year they joined
    // their CURRENT club: Patrik Schick, at Leverkusen since 2020 and still
    // scoring, read "2014–2020", which is a clue about a career that ended.
    const stillPlaying = mine.some((s) => /\d{4}\s*[–—-]\s*$/.test(s.years));
    const main = mine.slice().sort((a, b) => b.apps - a.apps)[0];
    const num = numbers.find((n) => n.footballer_id === m.id);
    const club = main ? main.club.replace(/^→ /, "").replace(/ \(loan\)$/, "") : null;
    const crest = club
      ? (clubCrest.get(normalizeClubAlias(club)) as { wikipedia_url: string | null } | undefined)
      : undefined;
    clues.set(m.id, {
      nationality: m.nationality,
      position: m.position,
      years: years.length
        ? stillPlaying
          ? `${Math.min(...years)}–`
          : `${Math.min(...years)}–${Math.max(...years)}`
        : null,
      club,
      clubWikiUrl: crest?.wikipedia_url ?? null,
      squadNumber: num?.n ?? null,
      age: ageOn(m.born),
    });
  }
  return clues;
}
