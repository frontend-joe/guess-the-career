import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sqlite } from "../db/client.ts";
import {
  TENABLE_TYPES,
  candidatesForType,
  answersForRound,
  getType,
  MIN_ANSWERS,
  type Metric,
} from "../services/tenable.ts";

export const tenableRouter = new Hono();

const asMetric = (v: string): Metric => (v === "apps" ? "apps" : "goals");

// ── Admin: the card menu ─────────────────────────────────────────────────────
// GET /api/tenable/admin/types — one card per question type, with how many
// rounds currently have >= 10 answers and how many are already selected.
tenableRouter.get("/admin/types", (c) => {
  const enabledCounts = sqlite
    .prepare(`SELECT type, COUNT(*) AS n FROM tenable_rounds GROUP BY type`)
    .all() as { type: string; n: number }[];
  const enabledByType = new Map(enabledCounts.map((r) => [r.type, r.n]));

  const data = TENABLE_TYPES.map((t) => ({
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

tenableRouter.delete("/admin/rounds/:id", (c) => {
  sqlite.prepare(`DELETE FROM tenable_rounds WHERE id = ?`).run(parseInt(c.req.param("id"), 10));
  return c.json({ ok: true });
});

// GET /api/tenable/admin/rounds — everything selected (for the schedule picker).
tenableRouter.get("/admin/rounds", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT id, type, params, metric, title, answer_count, enabled
       FROM tenable_rounds ORDER BY type, title`,
    )
    .all() as { params: string }[];
  return c.json(rows.map((r) => ({ ...r, params: JSON.parse(r.params) })));
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

tenableRouter.delete("/schedule/:date", (c) => {
  sqlite.prepare(`DELETE FROM tenable_schedule WHERE date = ?`).run(c.req.param("date"));
  return c.json({ ok: true });
});

tenableRouter.delete("/schedule", (c) => {
  sqlite.prepare(`DELETE FROM tenable_schedule`).run();
  return c.json({ ok: true });
});

// ── Gameplay ─────────────────────────────────────────────────────────────────
// GET /api/tenable/schedule/rounds — scheduled rounds with their 10 answers.
tenableRouter.get("/schedule/rounds", (c) => {
  const rows = sqlite
    .prepare(
      `SELECT s.date, r.id AS round_id, r.type, r.params, r.metric, r.title
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
  }[];

  return c.json(
    rows.map((r) => {
      const metric = asMetric(r.metric);
      const answers = answersForRound(r.type, JSON.parse(r.params), metric);
      return {
        date: r.date,
        roundId: r.round_id,
        type: r.type,
        title: r.title,
        metric,
        answers: answers.map((a, i) => ({ ...a, rank: i + 1 })),
      };
    }),
  );
});
