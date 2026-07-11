import { sqlite } from "../db/client.ts";
import { normalizeClubAlias, type ScrapeResult } from "./scraper.ts";
import { reserveRe, isEnglishClub } from "./football.ts";

// ── Random Lists: bespoke, DB-derived player lists (one per round) ────────────
// Each list has a stable id + title/subtitle and a derive() that computes its
// player pool from the footballer DB. The whole pool are valid answers; how many
// you must find is the admin-set `target` (handled in the route).

export interface ListPlayer {
  id: number;
  name: string;
  photo_url: string | null;
  nationality: string | null;
  position: string | null;
  stat: string; // right-aligned display value (e.g. "6'2\"", "112 goals", "3 caps")
}

// A normalized view of a player used by every list's qualify/metric/stat, so the
// exact same rules apply to a DB row and to a freshly-scraped (not-yet-imported)
// player — which is what makes auto-scrape validation share the derive() logic.
export interface Candidate {
  id: number;
  name: string;
  photo_url: string | null;
  nationality: string | null;
  position: string | null;
  height_cm: number | null;
  seniorGoals: number;
  seniorApps: number;
  englandCaps: number;
  playedInEngland: boolean;
}

export interface ListDef {
  id: string;
  title: string;
  subtitle: string;
  qualifies: (c: Candidate) => boolean;
  metric: (c: Candidate) => number;
  dir: "asc" | "desc";
  stat: (c: Candidate) => string;
}

// ── Shared data loaders ───────────────────────────────────────────────────────

interface FRow {
  id: number;
  name: string;
  photo_url: string | null;
  nationality: string | null;
  position: string | null;
  height_cm: number | null;
}

function allFootballers(): FRow[] {
  return sqlite
    .prepare(
      `SELECT id, name, photo_url, nationality, position, height_cm FROM footballers`,
    )
    .all() as FRow[];
}

// Sum a per-footballer senior-stint numeric field, excluding reserve/B/youth
// teams (via reserveRe on the alias-normalized club name).
function sumSenior(field: "goals" | "apps"): Map<number, number> {
  const rows = sqlite
    .prepare(
      `SELECT footballer_id, club, ${field} AS v FROM career_stints WHERE stint_type = 'senior'`,
    )
    .all() as { footballer_id: number; club: string; v: number | null }[];
  const m = new Map<number, number>();
  for (const r of rows) {
    if (reserveRe.test(normalizeClubAlias(r.club).trim())) continue;
    m.set(r.footballer_id, (m.get(r.footballer_id) ?? 0) + (r.v ?? 0));
  }
  return m;
}

// England senior caps per footballer (international stints for the England
// senior side; youth/B sides are stored under distinct club names).
function englandCaps(): Map<number, number> {
  const rows = sqlite
    .prepare(
      `SELECT footballer_id, apps FROM career_stints WHERE stint_type = 'international' AND TRIM(club) = 'England'`,
    )
    .all() as { footballer_id: number; apps: number | null }[];
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.footballer_id, (m.get(r.footballer_id) ?? 0) + (r.apps ?? 0));
  return m;
}

// Footballers with at least one senior stint at an English club.
function englishClubPlayers(): Set<number> {
  const rows = sqlite
    .prepare(`SELECT footballer_id, club FROM career_stints WHERE stint_type = 'senior'`)
    .all() as { footballer_id: number; club: string }[];
  const s = new Set<number>();
  for (const r of rows) if (isEnglishClub(r.club)) s.add(r.footballer_id);
  return s;
}

// ── Position classifiers (free-text, hyphen-tolerant; multi-value strings) ────

const lc = (s: string | null) => (s ?? "").toLowerCase();
const isFullBack = (p: string | null) =>
  /\b(full|right|left|wing)[ -]?back\b/.test(lc(p)) || lc(p).includes("wingback");
const isCentreBack = (p: string | null) =>
  /cent(re|er)[ -]?back/.test(lc(p)) ||
  lc(p).includes("central defender") ||
  /cent(re|er)[ -]?half/.test(lc(p));
// A pure midfielder — has "midfield" but is not also listed as a forward/striker.
const isMidfielder = (p: string | null) =>
  lc(p).includes("midfield") && !lc(p).includes("forward") && !lc(p).includes("striker");
const isDefender = (p: string | null) => {
  const s = lc(p);
  const def =
    /back\b/.test(s) ||
    s.includes("defender") ||
    s.includes("sweeper") ||
    s.includes("libero") ||
    /cent(re|er)[ -]?half/.test(s);
  return def && !s.includes("midfield") && !s.includes("forward") && !s.includes("striker") && !s.includes("winger");
};

// ft'in" from centimetres, e.g. 188 → 6'2"
function heightLabel(cm: number): string {
  const inch = Math.round(cm / 2.54);
  return `${Math.floor(inch / 12)}'${inch % 12}"`;
}

// ── Name dictionaries (seed lists — refine over time) ─────────────────────────
// Matched as a substring of any alphabetic token in the player's name.

// Standard British wildlife (plus a few classic animals), matched as a substring
// of a name token. Very short / high-collision words (rat, bat, owl, eel, cod,
// ray, bee, ant, ox, mole, boar, newt, adder, moth, lark, dove, gull, tern) are
// intentionally omitted — they mostly produce false positives. Refine over time.
const ANIMAL_WORDS = [
  // mammals
  "fox", "wolf", "badger", "stoat", "weasel", "hare", "rabbit",
  "hedgehog", "shrew", "squirrel", "deer", "stag", "roe", "buck", "fawn",
  "seal", "ferret", "mink", "polecat", "bull", "lamb", "hart", "doe", "bunny",
  "colt", "bear", "dormouse",
  // birds
  "sparrow", "finch", "wren", "crow", "rook", "raven", "magpie", "jay",
  "jackdaw", "starling", "swift", "swallow", "swan", "drake", "mallard",
  "goose", "gander", "heron", "crane", "hawk", "kestrel", "falcon", "buzzard",
  "kite", "eagle", "pigeon", "partridge", "pheasant", "grouse", "woodcock",
  "snipe", "thrush", "blackbird", "robin", "nightingale", "peacock", "cuckoo",
  "plover", "curlew", "lapwing", "moorhen", "wagtail", "goldfinch", "bullfinch",
  "greenfinch", "kingfisher", "woodpecker", "nuthatch", "gannet", "cormorant",
  "puffin", "guillemot", "oystercatcher", "sandpiper", "stonechat", "linnet",
  "rook", "kestrel", "lion", "bird",
  // fish
  "fish", "salmon", "pike", "trout", "perch", "roach", "bream", "tench",
  "herring", "haddock", "plaice", "minnow", "mackerel",
  // amphibians / reptiles
  "frog", "toad", "lizard",
  // invertebrates
  "crab", "wasp", "beetle", "spider", "snail",
];

// Note: short colours like "red"/"amber" are omitted from the seed because they
// produce false positives (Fred, Chambers). Refine over time.
const COLOUR_WORDS = [
  "black", "white", "brown", "green", "gray", "grey", "gold", "silver",
  "scarlet", "blue",
];

function nameMatches(name: string, words: string[]): boolean {
  const tokens = name.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return tokens.some((t) => words.some((w) => t.includes(w)));
}

// ── Africa nationalities (no continent map exists in the codebase) ────────────
// Matched against the stored nationality noun/demonym, lowercased.
const AFRICA_NATIONS = new Set(
  [
    "Nigeria", "Nigerian", "Senegal", "Senegalese", "Ivory Coast", "Ivorian",
    "Cameroon", "Cameroonian", "Ghana", "Ghanaian", "Morocco", "Moroccan",
    "Mali", "Malian", "South Africa", "South African", "Algeria", "Algerian",
    "Egypt", "Egyptian", "Tunisia", "Tunisian", "DR Congo", "Congolese",
    "Congo", "Zimbabwe", "Zimbabwean", "Liberia", "Liberian", "Togo", "Togolese",
    "Sierra Leone", "Cape Verde", "Cape Verdean", "Guinea", "Guinean", "Gabon",
    "Gabonese", "Angola", "Angolan", "Zambia", "Zambian", "Kenya", "Kenyan",
    "Uganda", "Ugandan", "Burkina Faso", "Burkinabé", "Benin", "Beninese",
    "Mozambique", "Namibia", "Namibian", "Tanzania", "Tanzanian", "Sudan",
    "Sudanese", "Ethiopia", "Ethiopian", "Madagascar", "Malagasy", "Gambia",
    "Gambian", "Equatorial Guinea", "Guinea-Bissau", "Comoros", "Comorian",
  ].map((n) => n.toLowerCase()),
);
const isAfrican = (nat: string | null) => !!nat && AFRICA_NATIONS.has(nat.trim().toLowerCase());

// ── The 10 lists ──────────────────────────────────────────────────────────────

// Build Candidates for every footballer in the DB.
function dbCandidates(): Candidate[] {
  const goals = sumSenior("goals");
  const apps = sumSenior("apps");
  const caps = englandCaps();
  const english = englishClubPlayers();
  return allFootballers().map((f) => ({
    id: f.id,
    name: f.name,
    photo_url: f.photo_url,
    nationality: f.nationality,
    position: f.position,
    height_cm: f.height_cm,
    seniorGoals: goals.get(f.id) ?? 0,
    seniorApps: apps.get(f.id) ?? 0,
    englandCaps: caps.get(f.id) ?? 0,
    playedInEngland: english.has(f.id),
  }));
}

// Build a Candidate from a freshly-scraped player (before it's imported), so we
// can check list qualification without touching the DB.
export function candidateFromScrape(scraped: ScrapeResult): Candidate {
  let seniorGoals = 0;
  let seniorApps = 0;
  let caps = 0;
  let playedInEngland = false;
  for (const s of scraped.stints) {
    if (s.stint_type === "senior") {
      if (!reserveRe.test(normalizeClubAlias(s.club).trim())) {
        seniorGoals += s.goals ?? 0;
        seniorApps += s.apps ?? 0;
      }
      if (isEnglishClub(s.club)) playedInEngland = true;
    } else if (s.stint_type === "international" && s.club.trim() === "England") {
      caps += s.apps ?? 0;
    }
  }
  return {
    id: 0,
    name: scraped.name,
    photo_url: scraped.photo_url,
    nationality: scraped.nationality,
    position: scraped.position,
    height_cm: scraped.height_cm,
    seniorGoals,
    seniorApps,
    englandCaps: caps,
    playedInEngland,
  };
}

const heightStat = (c: Candidate) => (c.height_cm != null ? heightLabel(c.height_cm) : "");
const appsStat = (c: Candidate) => `${c.seniorApps} apps`;

export const LIST_DEFS: ListDef[] = [
  { id: "fullbacks-6ft", title: "Full-backs over 6ft", subtitle: "Full-backs taller than 6ft (183cm)",
    qualifies: (c) => c.height_cm != null && c.height_cm > 183 && isFullBack(c.position),
    metric: (c) => c.height_cm ?? 0, dir: "desc", stat: heightStat },
  { id: "centrebacks-under-6ft", title: "Centre-backs under 6ft", subtitle: "Centre-backs shorter than 6ft (183cm)",
    qualifies: (c) => c.height_cm != null && c.height_cm < 183 && isCentreBack(c.position),
    metric: (c) => c.height_cm ?? 0, dir: "asc", stat: heightStat },
  { id: "midfield-100-goals", title: "Midfield marksmen", subtitle: "Midfielders with 100+ senior career goals",
    qualifies: (c) => isMidfielder(c.position) && c.seniorGoals >= 100,
    metric: (c) => c.seniorGoals, dir: "desc", stat: (c) => `${c.seniorGoals} goals` },
  { id: "defender-50-goals", title: "Scoring defenders", subtitle: "Defenders with 50+ senior career goals",
    qualifies: (c) => isDefender(c.position) && c.seniorGoals >= 50,
    metric: (c) => c.seniorGoals, dir: "desc", stat: (c) => `${c.seniorGoals} goals` },
  { id: "africans-in-england", title: "Africans in England", subtitle: "African players who played in England",
    qualifies: (c) => isAfrican(c.nationality) && c.playedInEngland,
    metric: (c) => c.seniorApps, dir: "desc", stat: appsStat },
  { id: "animal-names", title: "An animal in their name", subtitle: "Players with an animal hiding in their name",
    qualifies: (c) => nameMatches(c.name, ANIMAL_WORDS),
    metric: (c) => c.seniorApps, dir: "desc", stat: appsStat },
  { id: "colour-names", title: "A colour in their name", subtitle: "Players with a colour in their name",
    qualifies: (c) => nameMatches(c.name, COLOUR_WORDS),
    metric: (c) => c.seniorApps, dir: "desc", stat: appsStat },
  { id: "england-under-5-caps", title: "England cameos", subtitle: "Players with fewer than 5 England caps",
    qualifies: (c) => c.englandCaps >= 1 && c.englandCaps < 5,
    metric: (c) => c.englandCaps, dir: "desc", stat: (c) => `${c.englandCaps} cap${c.englandCaps === 1 ? "" : "s"}` },
  { id: "under-5ft7", title: "Pocket rockets", subtitle: "Players 5'6\" (168cm) and under",
    qualifies: (c) => c.height_cm != null && c.height_cm <= 168,
    metric: (c) => c.height_cm ?? 0, dir: "asc", stat: heightStat },
  { id: "over-6ft5", title: "Giants", subtitle: "Players 6'6\" (197cm) and over",
    qualifies: (c) => c.height_cm != null && c.height_cm >= 197,
    metric: (c) => c.height_cm ?? 0, dir: "desc", stat: heightStat },
];

const LIST_BY_ID = new Map(LIST_DEFS.map((d) => [d.id, d]));

function toListPlayer(def: ListDef, c: Candidate): ListPlayer {
  return { id: c.id, name: c.name, photo_url: c.photo_url, nationality: c.nationality, position: c.position, stat: def.stat(c) };
}

export function deriveList(id: string): ListPlayer[] | null {
  const def = LIST_BY_ID.get(id);
  if (!def) return null;
  return dbCandidates()
    .filter((c) => def.qualifies(c))
    .sort((a, b) => (def.dir === "asc" ? def.metric(a) - def.metric(b) : def.metric(b) - def.metric(a)) || a.name.localeCompare(b.name))
    .map((c) => toListPlayer(def, c));
}

export function getListDef(id: string): ListDef | undefined {
  return LIST_BY_ID.get(id);
}

// Does a candidate qualify for a list? Returns the display ListPlayer (with the
// list's stat) when it does, else null. Used for auto-scrape validation.
export function qualifyCandidate(id: string, c: Candidate): ListPlayer | null {
  const def = LIST_BY_ID.get(id);
  if (!def || !def.qualifies(c)) return null;
  return toListPlayer(def, c);
}

// Lightweight summaries (id/title/subtitle + pool size) for admin + schedule.
export function listSummaries(): { id: string; title: string; subtitle: string; poolCount: number }[] {
  const cands = dbCandidates();
  return LIST_DEFS.map((d) => ({
    id: d.id,
    title: d.title,
    subtitle: d.subtitle,
    poolCount: cands.filter((c) => d.qualifies(c)).length,
  }));
}
