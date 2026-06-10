import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, sqlite } from "../db/client.ts";
import { footballers, career_stints } from "../db/schema.ts";
import {
  normalizeClubAlias,
  scrapeWikipedia,
  isRetired,
} from "../services/scraper.ts";

export const transfersRouter = new Hono();

const MIN_PLAYERS = 5;

const reserveRe =
  /\s(B|C|II|III|IV|reserves?|under[- ]?\d+|u\d+|youth|academy)$/i;

function isReserve(canonicalClub: string): boolean {
  return reserveRe.test(canonicalClub.trim());
}

// A transfer is always FROM a permanent club. Loans are one-directional: they
// emit `lastPermanentClub ⇒ loanClub` but never become a "from" themselves.
// This avoids spurious loan→loan transfers (e.g. Bendtner: Arsenal loaned to
// Birmingham then Sunderland is NOT a Birmingham⇒Sunderland move) and correctly
// bridges the real permanent transfer across interleaved loan rows.
// Loan stints have their raw `club` prefixed with "→ ".
function transferPairs(stints: { club: string }[]): Set<string> {
  const pairs = new Set<string>();
  let lastPermanent: string | null = null;
  for (const s of stints) {
    const isLoan = s.club.trim().startsWith("→");
    const canonical = normalizeClubAlias(s.club);
    if (
      lastPermanent &&
      lastPermanent !== canonical &&
      !isReserve(lastPermanent) &&
      !isReserve(canonical)
    ) {
      pairs.add(`${lastPermanent}|||${canonical}`);
    }
    if (!isLoan) lastPermanent = canonical;
  }
  return pairs;
}

// `hasTransfer` checks an ordered stint list for a given from→to transfer.
function hasTransfer(
  stints: { club: string }[],
  fromClub: string,
  toClub: string,
): boolean {
  return transferPairs(stints).has(
    `${normalizeClubAlias(fromClub)}|||${normalizeClubAlias(toClub)}`,
  );
}

// The year of the transfer = the start year of the destination stint for the
// matching from→to move (uses the same permanent/loan walk as transferPairs).
function transferYear(
  stints: { club: string; years: string }[],
  fromClub: string,
  toClub: string,
): string | null {
  const fromC = normalizeClubAlias(fromClub);
  const toC = normalizeClubAlias(toClub);
  let lastPermanent: string | null = null;
  for (const s of stints) {
    const isLoan = s.club.trim().startsWith("→");
    const canonical = normalizeClubAlias(s.club);
    if (lastPermanent === fromC && canonical === toC) {
      const m = s.years.match(/\d{4}/);
      return m ? m[0] : s.years.trim() || null;
    }
    if (!isLoan) lastPermanent = canonical;
  }
  return null;
}

interface StintRow {
  footballer_id: number;
  club: string;
}

// Build Map<"from|||to", Set<footballerId>> from every consecutive senior-stint
// pair across all players. Powers the admin list, /answers and round counts.
function buildTransferMap(): Map<string, Set<number>> {
  const rows = sqlite
    .prepare(
      `SELECT footballer_id, club FROM career_stints WHERE stint_type = 'senior' ORDER BY footballer_id, sort_order`,
    )
    .all() as StintRow[];

  const map = new Map<string, Set<number>>();
  let i = 0;
  while (i < rows.length) {
    const fid = rows[i].footballer_id;
    const stints: { club: string }[] = [];
    let j = i;
    while (j < rows.length && rows[j].footballer_id === fid) {
      stints.push({ club: rows[j].club });
      j++;
    }
    for (const key of transferPairs(stints)) {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(fid);
    }
    i = j;
  }
  return map;
}

function findValidTransfers(): [string, string, number][] {
  const map = buildTransferMap();
  const out: [string, string, number][] = [];
  for (const [key, set] of map) {
    if (set.size >= MIN_PLAYERS) {
      const [from, to] = key.split("|||");
      out.push([from, to, set.size]);
    }
  }
  return out;
}

function clubWikiUrl(club: string): string | null {
  const row = sqlite
    .prepare(
      `SELECT wikipedia_url FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1`,
    )
    .get(club) as { wikipedia_url: string | null } | undefined;
  return row?.wikipedia_url ?? null;
}

interface TransferPlayer {
  id: number;
  name: string;
  photo_url: string | null;
  nationality: string | null;
  position: string | null;
  year: string | null;
}

function getTransferPlayers(
  fromClub: string,
  toClub: string,
): TransferPlayer[] {
  const fromC = normalizeClubAlias(fromClub);
  const toC = normalizeClubAlias(toClub);
  const ids = [...(buildTransferMap().get(`${fromC}|||${toC}`) ?? [])];
  if (ids.length === 0) return [];
  const ph = ids.map(() => "?").join(", ");

  const players = sqlite
    .prepare(
      `SELECT id, name, photo_url, nationality, position FROM footballers WHERE id IN (${ph})`,
    )
    .all(...ids) as {
    id: number;
    name: string;
    photo_url: string | null;
    nationality: string | null;
    position: string | null;
  }[];

  // Compute each player's transfer year from their ordered senior stints.
  const stintRows = sqlite
    .prepare(
      `SELECT footballer_id, club, years FROM career_stints WHERE stint_type = 'senior' AND footballer_id IN (${ph}) ORDER BY footballer_id, sort_order`,
    )
    .all(...ids) as { footballer_id: number; club: string; years: string }[];
  const byPlayer = new Map<number, { club: string; years: string }[]>();
  for (const r of stintRows) {
    if (!byPlayer.has(r.footballer_id)) byPlayer.set(r.footballer_id, []);
    byPlayer.get(r.footballer_id)!.push({ club: r.club, years: r.years });
  }

  // Stable per-combo pseudo-random order so the game's "random 5" hint set is
  // consistent across reloads/devices but isn't just alphabetical/chronological.
  const seed = `${fromC}|||${toC}`;
  const rank = (id: number) => {
    let h = 2166136261;
    const s = `${seed}:${id}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  return players
    .map((p) => ({
      id: p.id,
      name: p.name,
      photo_url: p.photo_url,
      nationality: p.nationality,
      position: p.position,
      year: transferYear(byPlayer.get(p.id) ?? [], fromClub, toClub),
    }))
    .sort((a, b) => rank(a.id) - rank(b.id));
}

function seniorStints(footballerId: number): { club: string }[] {
  return sqlite
    .prepare(
      `SELECT club FROM career_stints WHERE footballer_id = ? AND stint_type = 'senior' ORDER BY sort_order`,
    )
    .all(footballerId) as { club: string }[];
}

// GET /api/transfers/admin/pairs
transfersRouter.get("/admin/pairs", (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(c.req.query("pageSize") ?? "25", 10)),
  );

  const valid = findValidTransfers();

  // Seed all pairs as enabled on first visit (when the table is empty).
  const existingCount = (
    sqlite
      .prepare(`SELECT COUNT(*) as n FROM transfers_enabled_pairs`)
      .get() as { n: number }
  ).n;
  if (existingCount === 0 && valid.length > 0) {
    const insert = sqlite.prepare(
      `INSERT OR IGNORE INTO transfers_enabled_pairs (from_club, to_club) VALUES (?, ?)`,
    );
    const insertMany = sqlite.transaction((pairs: [string, string][]) => {
      for (const [from, to] of pairs) insert.run(from, to);
    });
    insertMany(valid.map(([from, to]) => [from, to]));
  }

  const enabledRows = sqlite
    .prepare(`SELECT from_club, to_club FROM transfers_enabled_pairs`)
    .all() as { from_club: string; to_club: string }[];
  const enabledSet = new Set(
    enabledRows.map((r) => `${r.from_club}|||${r.to_club}`),
  );

  const sorted = valid.sort((a, b) => b[2] - a[2]);
  const total = sorted.length;
  const enabledCount = sorted.filter(([from, to]) =>
    enabledSet.has(`${from}|||${to}`),
  ).length;
  const page_data = sorted.slice((page - 1) * pageSize, page * pageSize);

  const data = page_data.map(([fromClub, toClub, playerCount]) => ({
    fromClub,
    fromClubWikiUrl: clubWikiUrl(fromClub),
    toClub,
    toClubWikiUrl: clubWikiUrl(toClub),
    playerCount,
    enabled: enabledSet.has(`${fromClub}|||${toClub}`),
  }));

  return c.json({ data, total, enabledCount, page, pageSize });
});

// GET /api/transfers/admin/pairs/players?from=&to=
transfersRouter.get("/admin/pairs/players", (c) => {
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  if (!from || !to) return c.json({ error: "from and to required" }, 400);
  return c.json(getTransferPlayers(from, to));
});

// POST /api/transfers/admin/pairs/enable
transfersRouter.post(
  "/admin/pairs/enable",
  zValidator(
    "json",
    z.object({ fromClub: z.string().min(1), toClub: z.string().min(1) }),
  ),
  (c) => {
    const { fromClub, toClub } = c.req.valid("json");
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO transfers_enabled_pairs (from_club, to_club) VALUES (?, ?)`,
      )
      .run(normalizeClubAlias(fromClub), normalizeClubAlias(toClub));
    return c.json({ ok: true });
  },
);

// DELETE /api/transfers/admin/pairs/enable
transfersRouter.delete(
  "/admin/pairs/enable",
  zValidator(
    "json",
    z.object({ fromClub: z.string().min(1), toClub: z.string().min(1) }),
  ),
  (c) => {
    const { fromClub, toClub } = c.req.valid("json");
    sqlite
      .prepare(
        `DELETE FROM transfers_enabled_pairs WHERE LOWER(from_club) = LOWER(?) AND LOWER(to_club) = LOWER(?)`,
      )
      .run(normalizeClubAlias(fromClub), normalizeClubAlias(toClub));
    return c.json({ ok: true });
  },
);

// GET /api/transfers/schedule — admin list
transfersRouter.get("/schedule", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT id, date, from_club, to_club, created_at FROM transfers_schedule ORDER BY date ASC`,
    )
    .all() as {
    id: number;
    date: string;
    from_club: string;
    to_club: string;
    created_at: string;
  }[];
  return c.json(rows);
});

// GET /api/transfers/schedule/rounds — game data with wiki urls + counts
transfersRouter.get("/schedule/rounds", (c) => {
  const scheduled = sqlite
    .prepare(
      `SELECT date, from_club, to_club FROM transfers_schedule ORDER BY date ASC`,
    )
    .all() as { date: string; from_club: string; to_club: string }[];

  if (scheduled.length === 0) return c.json([]);

  const map = buildTransferMap();
  const rounds = scheduled.map((row) => {
    const fromC = normalizeClubAlias(row.from_club);
    const toC = normalizeClubAlias(row.to_club);
    return {
      date: row.date,
      fromClub: row.from_club,
      fromClubWikiUrl: clubWikiUrl(row.from_club),
      toClub: row.to_club,
      toClubWikiUrl: clubWikiUrl(row.to_club),
      playerCount: map.get(`${fromC}|||${toC}`)?.size ?? 0,
    };
  });

  return c.json(rounds);
});

// PUT /api/transfers/schedule/:date
transfersRouter.put(
  "/schedule/:date",
  zValidator(
    "json",
    z.object({ fromClub: z.string().min(1), toClub: z.string().min(1) }),
  ),
  (c) => {
    const date = c.req.param("date");
    const { fromClub, toClub } = c.req.valid("json");
    const existing = sqlite
      .prepare(`SELECT id FROM transfers_schedule WHERE date = ?`)
      .get(date);
    if (existing) {
      sqlite
        .prepare(
          `UPDATE transfers_schedule SET from_club = ?, to_club = ? WHERE date = ?`,
        )
        .run(fromClub, toClub, date);
    } else {
      sqlite
        .prepare(
          `INSERT INTO transfers_schedule (date, from_club, to_club) VALUES (?, ?, ?)`,
        )
        .run(date, fromClub, toClub);
    }
    return c.json({ ok: true });
  },
);

// DELETE /api/transfers/schedule/:date
transfersRouter.delete("/schedule/:date", (c) => {
  const date = c.req.param("date");
  sqlite.prepare(`DELETE FROM transfers_schedule WHERE date = ?`).run(date);
  return c.json({ ok: true });
});

// DELETE /api/transfers/schedule
transfersRouter.delete("/schedule", (c) => {
  sqlite.prepare(`DELETE FROM transfers_schedule`).run();
  return c.json({ ok: true });
});

// GET /api/transfers/answers?from=&to=
transfersRouter.get("/answers", (c) => {
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  if (!from || !to) return c.json({ error: "from and to required" }, 400);
  return c.json(getTransferPlayers(from, to));
});

// POST /api/transfers/verify
transfersRouter.post(
  "/verify",
  zValidator(
    "json",
    z.object({
      footballerName: z.string().min(1),
      footballerId: z.number().int().nullish(),
      fromClub: z.string().min(1),
      toClub: z.string().min(1),
    }),
  ),
  async (c) => {
    const { footballerName, footballerId, fromClub, toClub } =
      c.req.valid("json");

    const check = (stints: { club: string }[]) =>
      hasTransfer(stints, fromClub, toClub);

    // Resolve ALL footballers matching the typed name (or the given id).
    let candidates: {
      id: number;
      name: string;
      wikipedia_url: string;
      photo_url: string | null;
    }[] = [];

    if (footballerId != null) {
      const f = sqlite
        .prepare(
          `SELECT id, name, wikipedia_url, photo_url FROM footballers WHERE id = ?`,
        )
        .get(footballerId) as (typeof candidates)[number] | undefined;
      if (f) candidates = [f];
    }
    if (candidates.length === 0) {
      candidates = sqlite
        .prepare(
          `SELECT id, name, wikipedia_url, photo_url FROM footballers WHERE LOWER(normalize(name)) = LOWER(normalize(?))`,
        )
        .all(footballerName) as typeof candidates;
      if (candidates.length === 0) {
        const normalizedName = footballerName
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase();
        candidates = sqlite
          .prepare(
            `SELECT id, name, wikipedia_url, photo_url FROM footballers WHERE normalize(name) = ?`,
          )
          .all(normalizedName) as typeof candidates;
      }
    }

    // Step 1: any DB candidate already shows the transfer?
    for (const cand of candidates) {
      if (check(seniorStints(cand.id))) {
        return c.json({
          valid: true,
          footballer: {
            id: cand.id,
            name: cand.name,
            photo_url: cand.photo_url,
          },
          imported: false,
        });
      }
    }

    // Step 2: rescrape candidates (stints may be stale) and re-check.
    for (const cand of candidates) {
      if (!cand.wikipedia_url) continue;
      try {
        const scraped = await scrapeWikipedia(cand.wikipedia_url);
        const seniors = scraped.stints.filter((s) => s.stint_type === "senior");
        for (const s of seniors) {
          const exists = sqlite
            .prepare(
              `SELECT id FROM career_stints WHERE footballer_id = ? AND years = ? AND club = ? AND stint_type = 'senior' LIMIT 1`,
            )
            .get(cand.id, s.years, s.club);
          if (!exists) {
            const maxOrder = sqlite
              .prepare(
                `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM career_stints WHERE footballer_id = ?`,
              )
              .get(cand.id) as { next: number };
            await db.insert(career_stints).values({
              footballer_id: cand.id,
              sort_order: maxOrder.next,
              years: s.years,
              club: s.club,
              club_wikipedia_url: s.club_wikipedia_url ?? null,
              apps: s.apps ?? null,
              goals: s.goals ?? null,
              stint_type: "senior",
            });
          }
        }
        if (check(seniorStints(cand.id))) {
          return c.json({
            valid: true,
            footballer: {
              id: cand.id,
              name: cand.name,
              photo_url: cand.photo_url,
            },
            imported: true,
          });
        }
      } catch {
        // ignore and continue
      }
    }

    let fallback: {
      valid: false;
      foundName: string;
      imported: false;
      reason: string;
    } | null = candidates[0]
      ? {
          valid: false,
          foundName: candidates[0].name,
          imported: false,
          reason: "no_transfer",
        }
      : null;

    // Step 3: not resolvable from DB — Wikipedia name search (multi-candidate).
    try {
      const wikiHeaders = { "User-Agent": "GuessTheCareer-Admin/1.0" };
      const stripDiacritics = (s: string) =>
        s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const nameParts = stripDiacritics(footballerName)
        .split(/\s+/)
        .filter((p) => p.length > 2);
      function titleMatchesName(title: string) {
        const t = stripDiacritics(title);
        return nameParts.length > 0 && nameParts.every((p) => t.includes(p));
      }
      async function wikiSearch(query: string): Promise<string[]> {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;
        const res = await fetch(url, { headers: wikiHeaders });
        if (!res.ok) return [];
        const data = (await res.json()) as {
          query?: { search?: { title: string }[] };
        };
        return (data.query?.search ?? []).map((s) => s.title);
      }

      const candidateTitles: string[] = [];
      for (const query of [
        footballerName + " footballer",
        footballerName + " " + fromClub,
        footballerName,
      ]) {
        for (const title of await wikiSearch(query)) {
          if (titleMatchesName(title) && !candidateTitles.includes(title)) {
            candidateTitles.push(title);
          }
        }
      }

      if (candidateTitles.length === 0)
        return c.json(
          fallback ?? { valid: false, footballer: null, imported: false },
        );

      for (const title of candidateTitles.slice(0, 6)) {
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

        const byUrl = await db
          .select({
            id: footballers.id,
            name: footballers.name,
            photo_url: footballers.photo_url,
          })
          .from(footballers)
          .where(eq(footballers.wikipedia_url, wikiUrl))
          .limit(1)
          .then((r) => r[0]);

        if (byUrl && check(seniorStints(byUrl.id))) {
          return c.json({
            valid: true,
            footballer: {
              id: byUrl.id,
              name: byUrl.name,
              photo_url: byUrl.photo_url,
            },
            imported: false,
          });
        }

        await new Promise((r) => setTimeout(r, 300));
        let scraped;
        try {
          scraped = await scrapeWikipedia(wikiUrl);
        } catch {
          continue;
        }
        const seniors = scraped.stints.filter((s) => s.stint_type === "senior");

        if (!check(seniors)) {
          fallback ??= {
            valid: false,
            foundName: scraped.name,
            imported: false,
            reason: "no_transfer",
          };
          continue;
        }
        if (!isRetired(scraped.stints)) {
          return c.json({
            valid: false,
            foundName: scraped.name,
            imported: false,
            reason: "not_retired" as const,
          });
        }

        // Qualifies + retired — update an existing record (matched by URL) or insert.
        if (byUrl) {
          for (const s of seniors) {
            const exists = sqlite
              .prepare(
                `SELECT id FROM career_stints WHERE footballer_id = ? AND years = ? AND club = ? AND stint_type = 'senior' LIMIT 1`,
              )
              .get(byUrl.id, s.years, s.club);
            if (!exists) {
              const maxOrder = sqlite
                .prepare(
                  `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM career_stints WHERE footballer_id = ?`,
                )
                .get(byUrl.id) as { next: number };
              await db.insert(career_stints).values({
                footballer_id: byUrl.id,
                sort_order: maxOrder.next,
                years: s.years,
                club: s.club,
                club_wikipedia_url: s.club_wikipedia_url ?? null,
                apps: s.apps ?? null,
                goals: s.goals ?? null,
                stint_type: "senior",
              });
            }
          }
          return c.json({
            valid: true,
            footballer: {
              id: byUrl.id,
              name: byUrl.name,
              photo_url: scraped.photo_url ?? byUrl.photo_url,
            },
            imported: true,
          });
        }

        const [created] = await db
          .insert(footballers)
          .values({
            name: scraped.name,
            wikipedia_url: scraped.wikipedia_url,
            nationality: scraped.nationality,
            position: scraped.position,
            all_positions: scraped.all_positions ?? null,
            born: scraped.born,
            photo_url: scraped.photo_url ?? null,
          })
          .returning();

        if (seniors.length > 0) {
          await db.insert(career_stints).values(
            seniors.map((s, i) => ({
              footballer_id: created.id,
              sort_order: i,
              years: s.years,
              club: s.club,
              club_wikipedia_url: s.club_wikipedia_url ?? null,
              apps: s.apps ?? null,
              goals: s.goals ?? null,
              stint_type: "senior" as const,
            })),
          );
        }

        return c.json({
          valid: true,
          footballer: {
            id: created.id,
            name: created.name,
            photo_url: created.photo_url ?? null,
          },
          imported: true,
        });
      }

      return c.json(
        fallback ?? { valid: false, footballer: null, imported: false },
      );
    } catch {
      return c.json(
        fallback ?? { valid: false, footballer: null, imported: false },
      );
    }
  },
);
