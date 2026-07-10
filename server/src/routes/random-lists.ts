import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sqlite } from "../db/client.ts";
import { deriveList, getListDef, listSummaries } from "../services/randomLists.ts";

export const randomListsRouter = new Hono();

// ── Config + difficulty helpers ───────────────────────────────────────────────

interface ListCfg {
  target: number | null;
  enabled: boolean;
}

function configMap(): Map<string, ListCfg> {
  const rows = sqlite
    .prepare(`SELECT list_id, target, enabled FROM random_lists_config`)
    .all() as { list_id: string; target: number | null; enabled: number }[];
  return new Map(rows.map((r) => [r.list_id, { target: r.target, enabled: r.enabled !== 0 }]));
}

const defaultTarget = (poolCount: number) => Math.min(poolCount, 10);
const resolveTarget = (cfg: ListCfg | undefined, poolCount: number) =>
  cfg?.target ?? defaultTarget(poolCount);

function difficulty(poolCount: number, target: number): { label: string; color: "red" | "amber" | "green" } {
  if (target <= 0) return { label: "Easy", color: "green" };
  const ratio = poolCount / target;
  if (ratio < 1.5) return { label: "Solid", color: "red" };
  if (ratio < 3) return { label: "Medium", color: "amber" };
  return { label: "Easy", color: "green" };
}

// ── Admin: the 10 lists ───────────────────────────────────────────────────────

// GET /api/random-lists/admin/lists
randomListsRouter.get("/admin/lists", (c) => {
  const cfg = configMap();
  const data = listSummaries().map((s) => {
    const lc = cfg.get(s.id);
    return {
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      poolCount: s.poolCount,
      target: resolveTarget(lc, s.poolCount),
      enabled: lc?.enabled ?? true,
    };
  });
  return c.json({ data });
});

// GET /api/random-lists/admin/lists/:id/players — accordion payload
randomListsRouter.get("/admin/lists/:id/players", (c) => {
  const players = deriveList(c.req.param("id"));
  if (players === null) return c.json({ error: "Unknown list" }, 404);
  return c.json(players);
});

// POST /api/random-lists/admin/lists/config — upsert target / enabled for a list
randomListsRouter.post(
  "/admin/lists/config",
  zValidator(
    "json",
    z.object({
      listId: z.string().min(1),
      target: z.number().int().min(0).nullable().optional(),
      enabled: z.boolean().optional(),
    }),
  ),
  (c) => {
    const { listId, target, enabled } = c.req.valid("json");
    if (!getListDef(listId)) return c.json({ error: "Unknown list" }, 404);

    const existing = sqlite
      .prepare(`SELECT id FROM random_lists_config WHERE list_id = ?`)
      .get(listId) as { id: number } | undefined;

    if (!existing) {
      sqlite
        .prepare(`INSERT INTO random_lists_config (list_id, target, enabled) VALUES (?, ?, ?)`)
        .run(listId, target ?? null, enabled === false ? 0 : 1);
    } else {
      if (target !== undefined) {
        sqlite.prepare(`UPDATE random_lists_config SET target = ? WHERE list_id = ?`).run(target, listId);
      }
      if (enabled !== undefined) {
        sqlite.prepare(`UPDATE random_lists_config SET enabled = ? WHERE list_id = ?`).run(enabled ? 1 : 0, listId);
      }
    }
    return c.json({ ok: true });
  },
);

// ── Schedule ──────────────────────────────────────────────────────────────────

// GET /api/random-lists/schedule — admin list
randomListsRouter.get("/schedule", (c) => {
  const rows = sqlite
    .prepare(`SELECT id, date, list_id, created_at FROM random_lists_schedule ORDER BY date ASC`)
    .all() as { id: number; date: string; list_id: string; created_at: string }[];
  return c.json(rows);
});

// GET /api/random-lists/schedule/rounds — game data (title/subtitle/counts/difficulty)
randomListsRouter.get("/schedule/rounds", (c) => {
  const scheduled = sqlite
    .prepare(`SELECT date, list_id FROM random_lists_schedule ORDER BY date ASC`)
    .all() as { date: string; list_id: string }[];
  if (scheduled.length === 0) return c.json([]);

  const cfg = configMap();
  const poolCounts = new Map(listSummaries().map((s) => [s.id, s.poolCount]));

  const rounds = scheduled
    .map((row) => {
      const def = getListDef(row.list_id);
      if (!def) return null;
      const poolCount = poolCounts.get(row.list_id) ?? 0;
      const target = resolveTarget(cfg.get(row.list_id), poolCount);
      return {
        date: row.date,
        listId: row.list_id,
        title: def.title,
        subtitle: def.subtitle,
        poolCount,
        target,
        difficulty: difficulty(poolCount, target),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return c.json(rounds);
});

// PUT /api/random-lists/schedule/:date
randomListsRouter.put(
  "/schedule/:date",
  zValidator("json", z.object({ listId: z.string().min(1) })),
  (c) => {
    const date = c.req.param("date");
    const { listId } = c.req.valid("json");
    if (!getListDef(listId)) return c.json({ error: "Unknown list" }, 404);
    const existing = sqlite.prepare(`SELECT id FROM random_lists_schedule WHERE date = ?`).get(date);
    if (existing) {
      sqlite.prepare(`UPDATE random_lists_schedule SET list_id = ? WHERE date = ?`).run(listId, date);
    } else {
      sqlite.prepare(`INSERT INTO random_lists_schedule (date, list_id) VALUES (?, ?)`).run(date, listId);
    }
    return c.json({ ok: true });
  },
);

// DELETE /api/random-lists/schedule/:date
randomListsRouter.delete("/schedule/:date", (c) => {
  sqlite.prepare(`DELETE FROM random_lists_schedule WHERE date = ?`).run(c.req.param("date"));
  return c.json({ ok: true });
});

// DELETE /api/random-lists/schedule — clear all
randomListsRouter.delete("/schedule", (c) => {
  sqlite.prepare(`DELETE FROM random_lists_schedule`).run();
  return c.json({ ok: true });
});

// GET /api/random-lists/answers?list=ID — the round's answer pool
randomListsRouter.get("/answers", (c) => {
  const players = deriveList(c.req.query("list") ?? "");
  if (players === null) return c.json({ error: "list required" }, 400);
  return c.json(players);
});
