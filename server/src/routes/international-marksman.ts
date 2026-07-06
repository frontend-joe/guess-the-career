import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, sqlite } from "../db/client.ts";
import { footballers } from "../db/schema.ts";
import { normalizeClubAlias } from "../services/scraper.ts";
import {
  isSeniorNationalTeam,
  canonicalNationality,
  baseNation,
} from "../services/football.ts";
import { clubWikiUrl } from "../services/clubs.ts";

export const internationalMarksmanRouter = new Hono();

const MIN_GOALS = 25;
const MIN_MARKSMEN = 5;
// A round is the country's top-N highest scorers (the answers to guess).
const ROUND_TARGET = 5;

// The modern country a senior international side belongs to, or null if the team
// isn't a full senior national team (youth/B/Olympic/non-FIFA are excluded).
function stintCountry(club: string): string | null {
  return isSeniorNationalTeam(club) ? canonicalNationality(baseNation(club)) : null;
}

// Sum a player's senior international goals for one country across all its
// (possibly historical) team names.
function sumIntlGoals(
  stints: { club: string; goals: number | null }[],
  country: string,
): number {
  const target = canonicalNationality(country).toLowerCase();
  let total = 0;
  for (const s of stints) {
    const c = stintCountry(s.club);
    if (c && c.toLowerCase() === target) total += s.goals ?? 0;
  }
  return total;
}

function playedForCountry(
  stints: { club: string }[],
  country: string,
): boolean {
  const target = canonicalNationality(country).toLowerCase();
  return stints.some((s) => {
    const c = stintCountry(s.club);
    return c != null && c.toLowerCase() === target;
  });
}

interface StintRow {
  footballer_id: number;
  club: string;
  goals: number | null;
}

// Returns [country, marksmanCount] for every country with >= MIN_MARKSMEN players
// who have >= MIN_GOALS senior international goals for that country.
function findValidCountries(): [string, number][] {
  const rows = sqlite
    .prepare(
      `SELECT footballer_id, club, goals FROM career_stints WHERE stint_type = 'international'`,
    )
    .all() as StintRow[];

  // country -> (footballer_id -> summed senior international goals)
  const countryMap = new Map<string, Map<number, number>>();
  for (const { footballer_id, club, goals } of rows) {
    const country = stintCountry(club);
    if (!country) continue;
    if (!countryMap.has(country)) countryMap.set(country, new Map());
    const players = countryMap.get(country)!;
    players.set(footballer_id, (players.get(footballer_id) ?? 0) + (goals ?? 0));
  }

  const valid: [string, number][] = [];
  for (const [country, players] of countryMap) {
    let marksmen = 0;
    for (const total of players.values()) if (total >= MIN_GOALS) marksmen++;
    if (marksmen >= MIN_MARKSMEN) valid.push([country, marksmen]);
  }
  return valid;
}

// The exact international team names stored in the DB that canonicalise to the
// requested country (so a grouped country includes its historical sides).
function teamsForCountry(country: string): string[] {
  const target = canonicalNationality(country).toLowerCase();
  const rows = sqlite
    .prepare(
      `SELECT DISTINCT club FROM career_stints WHERE stint_type = 'international'`,
    )
    .all() as { club: string }[];
  return rows
    .map((r) => r.club)
    .filter((club) => {
      const c = stintCountry(club);
      return c != null && c.toLowerCase() === target;
    });
}

interface MarksmanPlayer {
  id: number;
  name: string;
  photo_url: string | null;
  goals: number;
  position: string | null;
  hintClub: string | null;
  clubWikiUrl: string | null;
  years: string | null;
}


// The club a player made the most senior appearances for + the years there — the
// hint shown per slot (mirrors the Uncapped game).
function hintClubFor(footballerId: number): {
  club: string | null;
  clubWikiUrl: string | null;
  years: string | null;
} {
  const stints = sqlite
    .prepare(
      `SELECT club, apps, years, club_wikipedia_url FROM career_stints WHERE footballer_id = ? AND stint_type = 'senior'`,
    )
    .all(footballerId) as {
    club: string;
    apps: number | null;
    years: string | null;
    club_wikipedia_url: string | null;
  }[];
  const byClub = new Map<string, { apps: number; name: string; wiki: string | null; years: string[] }>();
  for (const s of stints) {
    const key = normalizeClubAlias(s.club);
    const name = s.club.replace(/^→\s*/, "").replace(/\s*\((loan|trial)\)\s*$/i, "");
    const cur = byClub.get(key) ?? { apps: 0, name, wiki: s.club_wikipedia_url, years: [] };
    cur.apps += s.apps ?? 0;
    if (s.club_wikipedia_url && !cur.wiki) cur.wiki = s.club_wikipedia_url;
    if (s.years) cur.years.push(s.years);
    byClub.set(key, cur);
  }
  let best: { apps: number; name: string; wiki: string | null; years: string[] } | null = null;
  for (const v of byClub.values()) if (!best || v.apps > best.apps) best = v;
  return {
    club: best?.name ?? null,
    clubWikiUrl: best ? best.wiki ?? clubWikiUrl(best.name) : null,
    years: best ? yearsSpan(best.years.join("|")) : null,
  };
}

// Combine a player's international "years" strings for one country into a single
// span, e.g. "2004–2009|2011" -> "2004–2011".
function yearsSpan(raw: string | null): string | null {
  if (!raw) return null;
  const nums = raw.match(/\d{4}/g);
  if (!nums || nums.length === 0) return null;
  const years = nums.map(Number);
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min}–${max}`;
}

// All players with >= MIN_GOALS senior international goals for the country.
function getCountryMarksmen(country: string): MarksmanPlayer[] {
  const teams = teamsForCountry(country);
  if (teams.length === 0) return [];
  const ph = teams.map(() => "?").join(", ");
  const rows = sqlite
    .prepare(
      `
    SELECT f.id, f.name, f.photo_url, f.position,
           SUM(COALESCE(cs.goals, 0)) as total_goals
    FROM footballers f
    JOIN career_stints cs ON cs.footballer_id = f.id
      AND cs.stint_type = 'international'
      AND cs.club IN (${ph})
    GROUP BY f.id
    HAVING total_goals >= ${MIN_GOALS}
    ORDER BY total_goals DESC, f.name ASC
  `,
    )
    .all(...teams) as {
    id: number;
    name: string;
    photo_url: string | null;
    position: string | null;
    total_goals: number;
  }[];

  return rows.map((r) => {
    const hint = hintClubFor(r.id);
    return {
      id: r.id,
      name: r.name,
      photo_url: r.photo_url,
      goals: r.total_goals,
      position: r.position,
      hintClub: hint.club,
      clubWikiUrl: hint.clubWikiUrl,
      years: hint.years,
    };
  });
}

// GET /api/international-marksman/admin/countries
internationalMarksmanRouter.get("/admin/countries", (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(c.req.query("pageSize") ?? "25", 10)),
  );

  const validCountries = findValidCountries();

  // Seed all countries as enabled on first visit (when the table is empty).
  const existingCount = (
    sqlite
      .prepare(`SELECT COUNT(*) as n FROM international_marksman_enabled_countries`)
      .get() as { n: number }
  ).n;
  if (existingCount === 0 && validCountries.length > 0) {
    const insert = sqlite.prepare(
      `INSERT OR IGNORE INTO international_marksman_enabled_countries (country) VALUES (?)`,
    );
    const insertMany = sqlite.transaction((countries: string[]) => {
      for (const country of countries) insert.run(country);
    });
    insertMany(validCountries.map(([country]) => country));
  }

  const enabledRows = sqlite
    .prepare(`SELECT country FROM international_marksman_enabled_countries`)
    .all() as { country: string }[];
  const enabledSet = new Set(enabledRows.map((r) => r.country));

  const sorted = validCountries.sort((a, b) => b[1] - a[1]);
  const total = sorted.length;
  const enabledCount = sorted.filter(([country]) => enabledSet.has(country)).length;
  const page_data = sorted.slice((page - 1) * pageSize, page * pageSize);

  const data = page_data.map(([country, marksmanCount]) => ({
    country,
    marksmanCount,
    enabled: enabledSet.has(country),
  }));

  return c.json({ data, total, enabledCount, page, pageSize });
});

// GET /api/international-marksman/admin/countries/:country/players
internationalMarksmanRouter.get("/admin/countries/:country/players", (c) => {
  return c.json(getCountryMarksmen(c.req.param("country")));
});

// POST /api/international-marksman/admin/countries/enable
internationalMarksmanRouter.post(
  "/admin/countries/enable",
  zValidator("json", z.object({ country: z.string().min(1) })),
  (c) => {
    const { country } = c.req.valid("json");
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO international_marksman_enabled_countries (country) VALUES (?)`,
      )
      .run(canonicalNationality(country));
    return c.json({ ok: true });
  },
);

// DELETE /api/international-marksman/admin/countries/enable
internationalMarksmanRouter.delete(
  "/admin/countries/enable",
  zValidator("json", z.object({ country: z.string().min(1) })),
  (c) => {
    const { country } = c.req.valid("json");
    sqlite
      .prepare(
        `DELETE FROM international_marksman_enabled_countries WHERE LOWER(country) = LOWER(?)`,
      )
      .run(canonicalNationality(country));
    return c.json({ ok: true });
  },
);

// GET /api/international-marksman/schedule
internationalMarksmanRouter.get("/schedule", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT id, date, country, created_at FROM international_marksman_schedule ORDER BY date ASC`,
    )
    .all();
  return c.json(rows);
});

// GET /api/international-marksman/schedule/rounds
internationalMarksmanRouter.get("/schedule/rounds", (c) => {
  const scheduled = sqlite
    .prepare(
      `SELECT date, country FROM international_marksman_schedule ORDER BY date ASC`,
    )
    .all() as { date: string; country: string }[];
  if (scheduled.length === 0) return c.json([]);

  const countMap = new Map<string, number>();
  for (const [country, count] of findValidCountries()) countMap.set(country, count);

  return c.json(
    scheduled.map((row) => ({
      date: row.date,
      country: row.country,
      marksmanCount: countMap.get(canonicalNationality(row.country)) ?? 0,
    })),
  );
});

// PUT /api/international-marksman/schedule/:date
internationalMarksmanRouter.put(
  "/schedule/:date",
  zValidator("json", z.object({ country: z.string().min(1) })),
  (c) => {
    const date = c.req.param("date");
    const { country } = c.req.valid("json");
    const existing = sqlite
      .prepare(`SELECT id FROM international_marksman_schedule WHERE date = ?`)
      .get(date);
    if (existing) {
      sqlite
        .prepare(`UPDATE international_marksman_schedule SET country = ? WHERE date = ?`)
        .run(country, date);
    } else {
      sqlite
        .prepare(
          `INSERT INTO international_marksman_schedule (date, country) VALUES (?, ?)`,
        )
        .run(date, country);
    }
    return c.json({ ok: true });
  },
);

// DELETE /api/international-marksman/schedule/:date
internationalMarksmanRouter.delete("/schedule/:date", (c) => {
  sqlite
    .prepare(`DELETE FROM international_marksman_schedule WHERE date = ?`)
    .run(c.req.param("date"));
  return c.json({ ok: true });
});

// DELETE /api/international-marksman/schedule
internationalMarksmanRouter.delete("/schedule", (c) => {
  sqlite.prepare(`DELETE FROM international_marksman_schedule`).run();
  return c.json({ ok: true });
});

// GET /api/international-marksman/answers?country=Y — the round's top-N scorers.
internationalMarksmanRouter.get("/answers", (c) => {
  const country = c.req.query("country") ?? "";
  if (!country) return c.json({ error: "country required" }, 400);
  return c.json(getCountryMarksmen(country).slice(0, ROUND_TARGET));
});

// POST /api/international-marksman/verify
internationalMarksmanRouter.post(
  "/verify",
  zValidator(
    "json",
    z.object({
      footballerName: z.string().min(1),
      footballerId: z.number().int().nullish(),
      country: z.string().min(1),
    }),
  ),
  async (c) => {
    const { footballerName, footballerId, country } = c.req.valid("json");

    // The round's answers are the country's top-N highest scorers. A guess is only
    // valid if it resolves to one of them (validated against the DB — no
    // auto-scrape, since the top scorers are always already stored).
    const top = getCountryMarksmen(country).slice(0, ROUND_TARGET);
    const topById = new Map(top.map((p) => [p.id, p]));

    const intlOf = (id: number) =>
      sqlite
        .prepare(
          `SELECT club, goals FROM career_stints WHERE footballer_id = ? AND stint_type = 'international'`,
        )
        .all(id) as { club: string; goals: number | null }[];

    // Resolve the guessed footballer from the DB (by id, then by name).
    let footballer: { id: number; name: string } | undefined;
    if (footballerId != null) {
      footballer = await db
        .select({ id: footballers.id, name: footballers.name })
        .from(footballers)
        .where(eq(footballers.id, footballerId))
        .limit(1)
        .then((r) => r[0]);
    }
    if (!footballer) {
      footballer = await db
        .select({ id: footballers.id, name: footballers.name })
        .from(footballers)
        .where(
          sql`LOWER(normalize(${footballers.name})) = LOWER(normalize(${footballerName}))`,
        )
        .limit(1)
        .then((r) => r[0]);
    }

    if (footballer) {
      const hit = topById.get(footballer.id);
      if (hit) return c.json({ valid: true, footballer: hit, imported: false });
      // A real player, but not one of the top N.
      const intl = intlOf(footballer.id);
      const reason = playedForCountry(intl, country) ? "not_top" : "wrong_nation";
      return c.json({
        valid: false,
        foundName: footballer.name,
        goalsForCountry: sumIntlGoals(intl, country),
        imported: false,
        reason,
      });
    }

    return c.json({ valid: false, footballer: null, imported: false });
  },
);
