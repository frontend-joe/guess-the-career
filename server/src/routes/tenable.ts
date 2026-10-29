import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sqlite } from "../db/client.ts";
import { dbFootballerByName, resolveOrCreateFootballer } from "../services/playerImport.ts";
import { replaceCareerStatistics } from "../services/footballers.ts";
import { scrapeWikipedia } from "../services/scraper.ts";
import {
  TENABLE_TYPES,
  TENABLE_CATEGORIES,
  getCategory,
  candidatesForType,
  answersForRound,
  getType,
  isOrdered,
  titleFor,
  rankOf,
  cluesForFootballers,
  impliedCluesFor,
  NEAR_MISS_WINDOW,
  MIN_ANSWERS,
  ROUND_SIZE,
  type Metric,
} from "../services/tenable.ts";
import {
  GENERAL_TOPICS,
  generalAnswers,
  generalRounds,
  saveGeneralRound,
  deleteGeneralRound,
} from "../services/general.ts";

export const tenableRouter = new Hono();

const asMetric = (v: string): Metric => (v === "apps" ? "apps" : "goals");

// ── Categories ───────────────────────────────────────────────────────────────
// GET /api/tenable/categories — the games Tenable is made of, with how many
// rounds each has ready to play. Served rather than hardcoded in the clients
// because there are four of them (web admin, web harness, iOS, Android) and a
// third category should not mean four releases.
tenableRouter.get("/categories", (c) => {
  const counts = new Map(
    (sqlite
      .prepare(`SELECT category, COUNT(*) AS n FROM tenable_rounds GROUP BY category`)
      .all() as { category: string; n: number }[]).map((r) => [r.category, r.n]),
  );
  return c.json(
    TENABLE_CATEGORIES.map((cat) => ({ ...cat, rounds: counts.get(cat.slug) ?? 0 })),
  );
});

// ── Admin: the card menu ─────────────────────────────────────────────────────
// GET /api/tenable/admin/types — one card per question type, with how many
// rounds currently have >= 10 answers and how many are already selected.
tenableRouter.get("/admin/types", (c) => {
  const category = c.req.query("category") ?? "football";
  const enabledCounts = sqlite
    .prepare(`SELECT type, COUNT(*) AS n FROM tenable_rounds GROUP BY type`)
    .all() as { type: string; n: number }[];
  const enabledByType = new Map(enabledCounts.map((r) => [r.type, r.n]));

  const data = TENABLE_TYPES.filter((t) => (t.category ?? "football") === category).map((t) => ({
    slug: t.slug,
    label: t.label,
    description: t.description,
    example: t.example,
    available: candidatesForType(t.slug).length,
    selected: enabledByType.get(t.slug) ?? 0,
  }));
  return c.json({ data, minAnswers: MIN_ANSWERS });
});

// GET /api/tenable/admin/types/:slug/candidates?q=
// Every round of this type with >= MIN_ANSWERS answers, flagged with whether
// it's already been selected for the schedule.
tenableRouter.get("/admin/types/:slug/candidates", (c) => {
  const slug = c.req.param("slug");
  if (!getType(slug)) return c.json({ error: "Unknown type" }, 404);
  const q = (c.req.query("q") ?? "").trim().toLowerCase();

  const selected = sqlite
    .prepare(`SELECT id, params, metric FROM tenable_rounds WHERE type = ?`)
    .all(slug) as { id: number; params: string; metric: string }[];
  const key = (p: string, m: string) => `${p}|${m}`;
  const selectedMap = new Map(selected.map((r) => [key(r.params, r.metric), r.id]));

  let data = candidatesForType(slug).map((cand) => {
    const params = JSON.stringify(cand.params);
    return {
      ...cand,
      roundId: selectedMap.get(key(params, cand.metric)) ?? null,
    };
  });
  if (q) data = data.filter((d) => d.title.toLowerCase().includes(q));

  return c.json({ data, total: data.length });
});

// GET /api/tenable/admin/preview?type=&params=&metric= — the 10 answers.
tenableRouter.get("/admin/preview", (c) => {
  const type = c.req.query("type") ?? "";
  const metric = asMetric(c.req.query("metric") ?? "goals");
  let params: Record<string, string> = {};
  try {
    params = JSON.parse(c.req.query("params") ?? "{}");
  } catch {
    return c.json({ error: "Invalid params" }, 400);
  }
  return c.json(answersForRound(type, params, metric));
});

// ── Admin: selecting rounds ──────────────────────────────────────────────────
tenableRouter.post(
  "/admin/rounds",
  zValidator(
    "json",
    z.object({
      type: z.string(),
      params: z.record(z.string(), z.string()),
      metric: z.string(),
      title: z.string(),
      answer_count: z.number().int(),
    }),
  ),
  (c) => {
    const b = c.req.valid("json");
    if (!getType(b.type)) return c.json({ error: "Unknown type" }, 400);
    const info = sqlite
      .prepare(
        `INSERT OR IGNORE INTO tenable_rounds (type, params, metric, title, answer_count)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(b.type, JSON.stringify(b.params), asMetric(b.metric), b.title, b.answer_count);
    const id = info.lastInsertRowid
      ? Number(info.lastInsertRowid)
      : (sqlite
          .prepare(
            `SELECT id FROM tenable_rounds WHERE type = ? AND params = ? AND metric = ?`,
          )
          .get(b.type, JSON.stringify(b.params), asMetric(b.metric)) as { id: number })?.id;
    return c.json({ ok: true, id });
  },
);

// POST /api/tenable/admin/rounds/bulk — select every available round, for one
// type or all of them. One transaction, because ticking 2000+ rounds one
// request at a time is unusable (and would never survive the proxy).
tenableRouter.post(
  "/admin/rounds/bulk",
  zValidator("json", z.object({ type: z.string().optional(), deselect: z.boolean().optional() })),
  (c) => {
    const { type, deselect } = c.req.valid("json");
    // Selecting "everything" means everything discoverable, which is a
    // football idea: an authored category has no pool of unselected rounds to
    // sweep up, and clearing one would delete the rounds themselves.
    const slugs = type
      ? [type]
      : TENABLE_TYPES.filter((t) => (t.category ?? "football") === "football").map((t) => t.slug);

    if (deselect) {
      let removed = 0;
      const tx = sqlite.transaction(() => {
        for (const slug of slugs) {
          removed += sqlite.prepare(`DELETE FROM tenable_rounds WHERE type = ?`).run(slug).changes;
        }
      });
      tx();
      return c.json({ removed });
    }

    const insert = sqlite.prepare(
      `INSERT OR IGNORE INTO tenable_rounds (type, params, metric, title, answer_count)
       VALUES (?, ?, ?, ?, ?)`,
    );
    let added = 0;
    let total = 0;
    // Candidate discovery is the expensive part, so do it outside the write tx.
    const all = slugs.flatMap((slug) => candidatesForType(slug));
    const tx = sqlite.transaction(() => {
      for (const cand of all) {
        total++;
        added += insert.run(
          cand.type, JSON.stringify(cand.params), cand.metric, cand.title, cand.answer_count,
        ).changes;
      }
    });
    tx();
    return c.json({ added, total });
  },
);

// POST /api/tenable/admin/rounds/prune — drop selected rounds that are no
// longer valid (fewer than MIN_ANSWERS answers), e.g. after the league
// allow-list changed. Also clears any schedule entries pointing at them, so a
// scheduled round can never serve an empty board.
tenableRouter.post("/admin/rounds/prune", (c) => {
  // Football only. Pruning asks "does this round still have ten answers?",
  // which is a question about a derivation that moves underneath you. An
  // authored round's answers are the round: one with nine answers is
  // half-written, not stale, and deleting it would throw away somebody's work
  // in progress.
  const rounds = sqlite
    .prepare(`SELECT id, type, params, metric FROM tenable_rounds WHERE category = 'football'`)
    .all() as { id: number; type: string; params: string; metric: string }[];

  const dead: number[] = [];
  for (const r of rounds) {
    let n = 0;
    try {
      n = answersForRound(r.type, JSON.parse(r.params), asMetric(r.metric)).length;
    } catch {
      n = 0;
    }
    if (n < MIN_ANSWERS) dead.push(r.id);
  }

  let unscheduled = 0;
  const tx = sqlite.transaction(() => {
    for (const id of dead) {
      unscheduled += sqlite.prepare(`DELETE FROM tenable_schedule WHERE round_id = ?`).run(id).changes;
      sqlite.prepare(`DELETE FROM tenable_rounds WHERE id = ?`).run(id);
    }
  });
  tx();

  return c.json({ checked: rounds.length, pruned: dead.length, unscheduled });
});

tenableRouter.delete("/admin/rounds/:id", (c) => {
  sqlite.prepare(`DELETE FROM tenable_rounds WHERE id = ?`).run(parseInt(c.req.param("id"), 10));
  return c.json({ ok: true });
});

// GET /api/tenable/admin/rounds — everything selected (for the schedule picker).
tenableRouter.get("/admin/rounds", (c) => {
  const category = c.req.query("category") ?? "football";
  const rows = sqlite
    .prepare(
      `SELECT id, type, params, metric, title, answer_count, enabled
       FROM tenable_rounds WHERE category = ? ORDER BY type, title`,
    )
    .all(category) as { type: string; params: string; metric: string; title: string }[];
  return c.json(
    rows.map((r) => {
      const params = JSON.parse(r.params);
      return { ...r, params, title: titleFor(r.type, params, asMetric(r.metric), r.title) };
    }),
  );
});

// ── Admin: General ───────────────────────────────────────────────────────────
//
// A different shape of admin from football's, because the rounds are a
// different shape. Football's screens browse a space of rounds the data already
// implies and tick the good ones; this one is an editor, because nothing
// implies the ten longest rivers until somebody writes them down.

tenableRouter.get("/admin/general/rounds", (c) =>
  c.json({ data: generalRounds(), topics: GENERAL_TOPICS }));

tenableRouter.get("/admin/general/rounds/:slug", (c) => {
  const slug = c.req.param("slug");
  const round = generalRounds().find((r) => r.slug === slug);
  if (!round) return c.json({ error: "Unknown round" }, 404);
  return c.json({ round, answers: generalAnswers(slug) });
});

const generalBody = z.object({
  slug: z.string().min(1),
  topic: z.string().min(1),
  title: z.string().min(1),
  ordered: z.boolean(),
  unit: z.string().nullable().optional(),
  answers: z.array(
    z.object({
      name: z.string(),
      aliases: z.array(z.string()).default([]),
      value: z.number().default(0),
      display: z.string().nullable().optional(),
    }),
  ),
});

tenableRouter.put("/admin/general/rounds/:slug", zValidator("json", generalBody), (c) => {
  const b = c.req.valid("json");
  try {
    const saved = saveGeneralRound({
      slug: c.req.param("slug") === "new" ? b.slug : c.req.param("slug"),
      topic: b.topic,
      title: b.title,
      ordered: b.ordered,
      unit: b.unit ?? null,
      answers: b.answers.map((a) => ({
        name: a.name,
        aliases: a.aliases,
        value: a.value,
        display: a.display ?? null,
      })),
    });
    return c.json({ ok: true, ...saved });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Could not save" }, 400);
  }
});

tenableRouter.delete("/admin/general/rounds/:slug", (c) => {
  deleteGeneralRound(c.req.param("slug"));
  return c.json({ ok: true });
});

// ── The pool a room picks from ───────────────────────────────────────────────
// GET /api/tenable/rounds?category=general
//
// Separate from /schedule/rounds, which is the solo web game's calendar and
// answers "what is today's round". A room does not want a calendar: the host
// picks any round of whichever category they fancy, and the new categories have
// no schedule at all.
//
// Football still comes back scheduled-first so the list opens on the rounds
// that have been vetted by being scheduled, with the rest behind them — there
// are a couple of thousand, and the picker is a search box.
tenableRouter.get("/rounds", (c) => {
  const category = c.req.query("category") ?? "football";
  if (!getCategory(category)) return c.json({ error: "Unknown category" }, 404);

  const rows = sqlite
    .prepare(
      `SELECT r.id AS round_id, r.type, r.params, r.metric, r.title, r.answer_count,
              s.date AS date
       FROM tenable_rounds r
       LEFT JOIN tenable_schedule s ON s.round_id = r.id
       WHERE r.category = ?
       ORDER BY s.date IS NULL, s.date ASC, r.title ASC`,
    )
    .all(category) as {
    round_id: number;
    type: string;
    params: string;
    metric: string;
    title: string;
    answer_count: number;
    date: string | null;
  }[];

  return c.json(
    rows.map((r) => {
      const params = JSON.parse(r.params) as Record<string, string>;
      return {
        roundId: r.round_id,
        category,
        date: r.date,
        type: r.type,
        title: titleFor(r.type, params, asMetric(r.metric), r.title),
        metric: asMetric(r.metric),
        ordered: isOrdered(r.type, params),
        target: ROUND_SIZE,
        answerCount: r.answer_count,
      };
    }),
  );
});

// ── Schedule ─────────────────────────────────────────────────────────────────
tenableRouter.get("/schedule", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT s.id, s.date, s.round_id, r.title, r.type, r.metric
       FROM tenable_schedule s
       LEFT JOIN tenable_rounds r ON r.id = s.round_id
       ORDER BY s.date ASC`,
    )
    .all();
  return c.json(rows);
});

tenableRouter.put(
  "/schedule/:date",
  zValidator("json", z.object({ roundId: z.number().int() })),
  (c) => {
    const date = c.req.param("date");
    const { roundId } = c.req.valid("json");
    const existing = sqlite.prepare(`SELECT id FROM tenable_schedule WHERE date = ?`).get(date);
    if (existing) {
      sqlite.prepare(`UPDATE tenable_schedule SET round_id = ? WHERE date = ?`).run(roundId, date);
    } else {
      sqlite.prepare(`INSERT INTO tenable_schedule (date, round_id) VALUES (?, ?)`).run(date, roundId);
    }
    return c.json({ ok: true });
  },
);

// POST /api/tenable/schedule/auto-assign — schedule every selected round that
// isn't already on the calendar, onto consecutive free days, in one
// transaction. The client used to issue one request per round, which took
// minutes through the proxy and aborted part-way on any blip or deploy.
tenableRouter.post(
  "/schedule/auto-assign",
  zValidator("json", z.object({ startDate: z.string().optional() }).optional()),
  (c) => {
    const scheduled = sqlite
      .prepare(`SELECT date, round_id FROM tenable_schedule`)
      .all() as { date: string; round_id: number | null }[];
    const takenDates = new Set(scheduled.map((s) => s.date));
    const scheduledRounds = new Set(scheduled.map((s) => s.round_id));

    const pool = (sqlite.prepare(`SELECT id FROM tenable_rounds`).all() as { id: number }[])
      .filter((r) => !scheduledRounds.has(r.id));
    if (pool.length === 0) return c.json({ assigned: 0, from: null, to: null });

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const today = new Date().toISOString().slice(0, 10);
    const latest = scheduled.length
      ? scheduled.map((s) => s.date).sort().at(-1)!
      : today;
    const addDays = (d: string, n: number) => {
      const dt = new Date(`${d}T00:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() + n);
      return dt.toISOString().slice(0, 10);
    };
    // A fresh schedule starts TODAY, so there's something playable immediately
    // (the gameplay endpoint only serves rounds dated today or earlier).
    // Otherwise carry on the day after the last scheduled round.
    const start = c.req.valid("json")?.startDate
      ?? (scheduled.length === 0 ? today : addDays(latest >= today ? latest : today, 1));

    const insert = sqlite.prepare(
      `INSERT INTO tenable_schedule (date, round_id) VALUES (?, ?)`,
    );
    let offset = 0;
    let first: string | null = null;
    let last: string | null = null;
    const tx = sqlite.transaction(() => {
      for (const r of pool) {
        let date: string;
        do { date = addDays(start, offset++); } while (takenDates.has(date));
        takenDates.add(date);
        insert.run(date, r.id);
        first ??= date;
        last = date;
      }
    });
    tx();

    return c.json({ assigned: pool.length, from: first, to: last });
  },
);

tenableRouter.delete("/schedule/:date", (c) => {
  sqlite.prepare(`DELETE FROM tenable_schedule WHERE date = ?`).run(c.req.param("date"));
  return c.json({ ok: true });
});

tenableRouter.delete("/schedule", (c) => {
  sqlite.prepare(`DELETE FROM tenable_schedule`).run();
  return c.json({ ok: true });
});

// POST /api/tenable/verify — a guess that isn't on the board yet.
//
// The player may be a genuine answer we simply haven't scraped. Resolve (or
// scrape) them, make sure they have career statistics, then RECOMPUTE the
// round. Because answers are derived live, a qualifying newcomer slots into
// their rightful rank and pushes the weakest answer off the board on its own.
tenableRouter.post(
  "/verify",
  zValidator("json", z.object({ roundId: z.number().int(), name: z.string().min(2) })),
  async (c) => {
    const { roundId, name } = c.req.valid("json");
    const round = sqlite
      .prepare(`SELECT type, params, metric FROM tenable_rounds WHERE id = ?`)
      .get(roundId) as { type: string; params: string; metric: string } | undefined;
    if (!round) return c.json({ error: "Unknown round" }, 404);

    const params = JSON.parse(round.params) as Record<string, string>;
    const metric = asMetric(round.metric);
    const clubHint = params.club ?? params.clubA ?? "";

    let fid: number | null = null;
    try {
      fid = dbFootballerByName(name);
      if (fid == null) {
        const resolved = await resolveOrCreateFootballer(name, clubHint);
        fid = resolved.id;
      }
    } catch {
      return c.json({ valid: false, reason: "lookup_failed" });
    }
    if (fid == null) return c.json({ valid: false, reason: "not_found" });

    // A player can exist without career statistics (scraped before that landed,
    // or their page had no table) — fill them in so they can qualify.
    const hasStats = (sqlite
      .prepare(`SELECT COUNT(*) AS n FROM career_statistics WHERE footballer_id = ?`)
      .get(fid) as { n: number }).n;
    if (!hasStats) {
      const row = sqlite
        .prepare(`SELECT wikipedia_url FROM footballers WHERE id = ?`)
        .get(fid) as { wikipedia_url: string } | undefined;
      if (row?.wikipedia_url) {
        try {
          const scraped = await scrapeWikipedia(row.wikipedia_url);
          await replaceCareerStatistics(fid, scraped.league_stats ?? []);
        } catch { /* fall through — they just won't qualify */ }
      }
    }

    const answers = answersForRound(round.type, params, metric);
    const ordered = isOrdered(round.type, params);
    const valid = answers.some((a) => a.footballer_id === fid);

    // Where they actually sit, so a guess just off the board can be told how
    // close it was ("12th, 54 goals") rather than a flat "not on the list".
    const placing = valid ? null : rankOf(round.type, params, metric, fid);
    const footballer = sqlite
      .prepare(`SELECT id, name, photo_url FROM footballers WHERE id = ?`)
      .get(fid) as { id: number; name: string; photo_url: string | null } | undefined;

    return c.json({
      valid,
      footballerId: fid,
      footballer,
      rank: placing?.rank ?? null,
      value: placing?.value ?? null,
      unit: placing?.unit ?? null,
      metric,
      nearMiss: placing ? placing.rank <= NEAR_MISS_WINDOW : false,
      // The refreshed board, so the client can re-render after a displacement.
      answers: answers.map((a, i) => ({ ...a, rank: ordered ? i + 1 : null })),
    });
  },
);

// ── Gameplay ─────────────────────────────────────────────────────────────────
// GET /api/tenable/schedule/rounds — every scheduled round, metadata only.
//
// Metadata only is the important part: computing answers for all of them took
// 40s and 3MB and blew the proxy timeout. Answers are fetched one round at a
// time below, so any day can be opened without paying for all of them.
tenableRouter.get("/schedule/rounds", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT s.date, r.id AS round_id, r.type, r.params, r.metric, r.title, r.answer_count
       FROM tenable_schedule s
       JOIN tenable_rounds r ON r.id = s.round_id
       ORDER BY s.date ASC`,
    )
    .all() as {
    date: string;
    round_id: number;
    type: string;
    params: string;
    metric: string;
    title: string;
    answer_count: number;
  }[];

  return c.json(
    rows.map((r) => ({
      date: r.date,
      roundId: r.round_id,
      type: r.type,
      title: titleFor(r.type, JSON.parse(r.params), asMetric(r.metric), r.title),
      metric: asMetric(r.metric),
      ordered: isOrdered(r.type, JSON.parse(r.params)),
      target: ROUND_SIZE,
      answerCount: r.answer_count,
    })),
  );
});

// GET /api/tenable/schedule/rounds/:roundId/answers — one round's answers.
tenableRouter.get("/schedule/rounds/:roundId/answers", (c) => {
  const roundId = parseInt(c.req.param("roundId"), 10);
  if (isNaN(roundId)) return c.json({ error: "Invalid round" }, 400);

  const row = sqlite
    .prepare(
      `SELECT r.type, r.params, r.metric, s.date
       FROM tenable_rounds r
       LEFT JOIN tenable_schedule s ON s.round_id = r.id
       WHERE r.id = ?`,
    )
    .get(roundId) as { type: string; params: string; metric: string; date: string | null } | undefined;
  if (!row) return c.json({ error: "Unknown round" }, 404);

  const metric = asMetric(row.metric);
  const params = JSON.parse(row.params) as Record<string, string>;
  const ordered = isOrdered(row.type, params);
  const answers = answersForRound(row.type, params, metric);

  const ids = answers.map((a) => a.footballer_id).filter((x): x is number => x != null);
  const clues = cluesForFootballers(ids);

  return c.json({
    roundId,
    ordered,
    target: ROUND_SIZE,
    impliedClues: impliedCluesFor(row.type),
    answers: answers.map((a, i) => ({
      ...a,
      rank: ordered ? i + 1 : null,
      clue: a.footballer_id != null ? clues.get(a.footballer_id) ?? null : null,
    })),
  });
});
