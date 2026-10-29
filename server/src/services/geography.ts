import { sqlite } from "../db/client.ts";
import type { Candidate, Metric, TenableAnswer, TenableType } from "./tenable.ts";

// Geography Tenable — rounds whose answers are authored rather than derived.
//
// Football's rounds are a query against the footballer database, so "the ten
// most capped Scots" improves every time the scraper runs. Nothing can derive
// the ten longest rivers, so a geography round IS its answer list: typed in
// through the admin section and stored in geography_rounds / geography_answers
// (see migration 0096).
//
// Everything downstream of a round — the registry row, the multiplayer freeze,
// the guess matching, the board — is shared with football. This file is only
// the part that differs: where the ten answers come from.

export interface GeographyTopic {
  slug: string;
  label: string;
}

// Topics group rounds in the admin list. They are deliberately a flat list of
// labels rather than a table: a topic carries no behaviour, and a round's topic
// is free to be one of these or something new an admin types in.
export const GEOGRAPHY_TOPICS: GeographyTopic[] = [
  { slug: "countries", label: "Countries" },
  { slug: "cities", label: "Cities" },
  { slug: "rivers", label: "Rivers" },
  { slug: "mountains", label: "Mountains" },
  { slug: "lakes", label: "Lakes" },
  { slug: "islands", label: "Islands" },
  { slug: "seas", label: "Seas & oceans" },
  { slug: "states", label: "States & regions" },
  { slug: "flags", label: "Flags & capitals" },
];

export interface GeographyAnswerInput {
  name: string;
  aliases: string[];
  value: number;
  display: string | null;
}

export interface GeographyAnswerRow extends GeographyAnswerInput {
  position: number;
}

export interface GeographyRoundRow {
  slug: string;
  topic: string;
  title: string;
  ordered: boolean;
  unit: string | null;
  answerCount: number;
  /** The registry row in tenable_rounds, which is how the game knows it. */
  roundId: number | null;
}

const PARAMS = (slug: string) => JSON.stringify({ round: slug });

// ── Reading ──────────────────────────────────────────────────────────────────

export function geographyRounds(): GeographyRoundRow[] {
  return sqlite
    .prepare(
      `SELECT g.slug, g.topic, g.title, g.ordered, g.unit,
              (SELECT COUNT(*) FROM geography_answers a WHERE a.round_slug = g.slug) AS answerCount,
              (SELECT t.id FROM tenable_rounds t
                WHERE t.category = 'geography' AND t.type = 'geography'
                  AND t.params = '{"round":"' || g.slug || '"}') AS roundId
       FROM geography_rounds g
       ORDER BY g.topic, g.title`,
    )
    .all()
    .map((r) => ({ ...(r as GeographyRoundRow), ordered: !!(r as { ordered: number }).ordered }));
}

export function geographyAnswers(slug: string): GeographyAnswerRow[] {
  const rows = sqlite
    .prepare(
      `SELECT position, name, aliases, value, display
       FROM geography_answers WHERE round_slug = ? ORDER BY position`,
    )
    .all(slug) as { position: number; name: string; aliases: string | null; value: number; display: string | null }[];
  return rows.map((r) => ({
    position: r.position,
    name: r.name,
    aliases: parseAliases(r.aliases),
    value: r.value,
    display: r.display,
  }));
}

export function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === "string") : [];
  } catch {
    return [];
  }
}

function roundBySlug(slug: string): { ordered: number; unit: string | null; title: string } | undefined {
  return sqlite
    .prepare(`SELECT ordered, unit, title FROM geography_rounds WHERE slug = ?`)
    .get(slug) as { ordered: number; unit: string | null; title: string } | undefined;
}

// ── Writing ──────────────────────────────────────────────────────────────────

export interface GeographyRoundInput {
  slug: string;
  topic: string;
  title: string;
  ordered: boolean;
  unit: string | null;
  answers: GeographyAnswerInput[];
}

/**
 * Create or replace a round and its answers, and keep its registry row in step.
 *
 * The answers are replaced wholesale rather than diffed: the admin edits the
 * list as a list, and a round of ten rows is cheaper to rewrite than to
 * reconcile. A frozen multiplayer instance is unaffected either way — it took
 * its own copy.
 */
export function saveGeographyRound(input: GeographyRoundInput): { slug: string; roundId: number } {
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("A round needs a slug");
  if (!input.title.trim()) throw new Error("A round needs a title");

  return sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO geography_rounds (slug, topic, title, ordered, unit)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (slug) DO UPDATE
           SET topic = excluded.topic, title = excluded.title,
               ordered = excluded.ordered, unit = excluded.unit`,
      )
      .run(slug, input.topic, input.title.trim(), input.ordered ? 1 : 0, input.unit || null);

    sqlite.prepare(`DELETE FROM geography_answers WHERE round_slug = ?`).run(slug);
    const insert = sqlite.prepare(
      `INSERT INTO geography_answers (round_slug, position, name, aliases, value, display)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    // An ordered round is a ranked list, so the stored order IS the board and
    // the admin's ordering is taken as given — no re-sorting by value behind
    // their back, which would silently disagree with what they just saw.
    input.answers.forEach((a, i) => {
      if (!a.name.trim()) return;
      insert.run(
        slug, i + 1, a.name.trim(),
        a.aliases.length ? JSON.stringify(a.aliases.map((x) => x.trim()).filter(Boolean)) : null,
        a.value || 0,
        a.display?.trim() || null,
      );
    });

    const answerCount = (sqlite
      .prepare(`SELECT COUNT(*) AS n FROM geography_answers WHERE round_slug = ?`)
      .get(slug) as { n: number }).n;

    sqlite
      .prepare(
        `INSERT INTO tenable_rounds (category, type, params, metric, title, answer_count)
         VALUES ('geography', 'geography', ?, 'none', ?, ?)
         ON CONFLICT (type, params, metric) DO UPDATE
           SET title = excluded.title, answer_count = excluded.answer_count`,
      )
      .run(PARAMS(slug), input.title.trim(), answerCount);

    const roundId = (sqlite
      .prepare(`SELECT id FROM tenable_rounds WHERE type = 'geography' AND params = ? AND metric = 'none'`)
      .get(PARAMS(slug)) as { id: number }).id;

    return { slug, roundId };
  })();
}

export function deleteGeographyRound(slug: string): void {
  sqlite.transaction(() => {
    // The registry row goes first: a round nobody can select is a better
    // half-deleted state than answers nobody can reach.
    sqlite
      .prepare(`DELETE FROM tenable_rounds WHERE type = 'geography' AND params = ?`)
      .run(PARAMS(slug));
    sqlite.prepare(`DELETE FROM geography_answers WHERE round_slug = ?`).run(slug);
    sqlite.prepare(`DELETE FROM geography_rounds WHERE slug = ?`).run(slug);
  })();
}

// ── The round type ───────────────────────────────────────────────────────────
//
// One Tenable type covers every geography round. Football needs a type per
// question shape because each shape is a different query; here the query is
// always "this round's answers, in order", and what differs between rounds is
// data, not code.

export const geographyType: TenableType = {
  slug: "geography",
  category: "geography",
  label: "Geography",
  description: "Authored list rounds — countries, cities, rivers, mountains.",
  example: "The 10 longest rivers in the world",
  metricless: true,

  title(params) {
    return roundBySlug(params.round ?? "")?.title ?? "Geography round";
  },

  orderedFor(params) {
    // Unknown rounds are treated as ranked, which is the stricter reading: a
    // board that reveals at a rank is wrong in a visible way, where one that
    // fills in guess order quietly accepts anything.
    return roundBySlug(params.round ?? "")?.ordered !== 0;
  },

  answers(params, _metric, limit = 10): TenableAnswer[] {
    const round = roundBySlug(params.round ?? "");
    if (!round) return [];
    const rows = sqlite
      .prepare(
        `SELECT name, aliases, value, display FROM geography_answers
         WHERE round_slug = ? ORDER BY position LIMIT ?`,
      )
      .all(params.round, limit) as {
      name: string; aliases: string | null; value: number; display: string | null;
    }[];
    return rows.map((r) => ({
      footballer_id: null,
      name: r.name,
      nationality: null,
      photo_url: null,
      value: r.value,
      unit: round.unit ?? undefined,
      display: r.display ?? undefined,
      aliases: parseAliases(r.aliases),
    }));
  },

  // Geography rounds are authored, not discovered: there is no space of
  // candidates to browse, because every round that could exist already does
  // the moment somebody writes it down. The admin section for this category is
  // an editor rather than a picker.
  candidates(_metric: Metric): Candidate[] {
    return [];
  },
};
